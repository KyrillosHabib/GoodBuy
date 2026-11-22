import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { ModalComponent } from '@shared/components/modal.component';
import { AuthService } from '@shared/core/auth.service';
import { InventoryApiService } from '@shared/core/inventory-api.service';
import { I18nService } from '@shared/core/i18n.service';
import { StockRow, Supplier, VariantPick, Warehouse } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { emptyToNull } from '@shared/core/translation-forms';
import { VariantPickerComponent } from './variant-picker.component';
import './order-ops/adjustments.i18n';

type Dialog = 'receive' | 'adjust' | 'transfer' | 'level' | null;

// Stock of every item in every warehouse (an employee sees only their own warehouses) + the actions on it
@Component({
  selector: 'app-inventory-stock',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DataTableComponent, ModalComponent, VariantPickerComponent],
  templateUrl: './inventory-stock.component.html',
})
export class InventoryStockComponent implements OnInit {
  // The earliest expiry date that can be entered: goods that already expired cannot be received
  readonly today = new Date().toISOString().slice(0, 10);

  readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(InventoryApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly rows = signal<StockRow[]>([]);
  readonly warehouses = signal<Warehouse[]>([]);
  readonly suppliers = signal<Supplier[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly warehouseId = signal<number | null>(null);
  readonly lowOnly = signal(false);
  readonly dialog = signal<Dialog>(null);
  readonly target = signal<VariantPick | null>(null);
  readonly stockRow = signal<StockRow | null>(null);

  readonly allActive = signal<Warehouse[]>([]);

  readonly columns: DtColumn[] = [
    { key: 'warehouse', label: 'inv.warehouse', value: (r: StockRow) => r.warehouseName, filter: 'select' },
    { key: 'item', label: 'inv.item', value: (r: StockRow) => `${r.productName} ${r.label}` },
    { key: 'sku', label: 'SKU', value: (r: StockRow) => r.sku },
    { key: 'onHand', label: 'inv.onHand', value: (r: StockRow) => r.onHand, type: 'number', width: '90px' },
    { key: 'level', label: 'inv.reorderLevel', value: (r: StockRow) => r.reorderLevel, type: 'number', width: '90px' },
    { key: 'cost', label: 'inv.avgCost', value: (r: StockRow) => r.averageCost, type: 'number', width: '100px' },
    { key: 'value', label: 'inv.value', value: (r: StockRow) => r.value, type: 'number', width: '100px' },
    { key: 'price', label: 'a.prod.price', value: (r: StockRow) => r.price, type: 'number', width: '90px' },
    { key: 'actions', label: '', width: '200px' },
  ];

  readonly form = this.fb.group({
    warehouseId: [null as number | null],
    toWarehouseId: [null as number | null],
    quantity: [1],
    unitCost: [0],
    batchNumber: [''],
    expiryDate: [''],
    supplierId: [''],
    delta: [0],
    reason: ['adjustment'],
    level: [0],
    note: [''],
  });

  ngOnInit(): void {
    this.api.getWarehouses().subscribe((w) => {
      this.warehouses.set(w);
      this.allActive.set(w.filter((x) => x.isActive));
    });
    // The suppliers are only for the head who receives goods: a warehouse keeper has no permission to read them (it would show a "no permission" message)
    if (this.auth.can('suppliers', 'purchaseOrders.manage')) this.api.getSuppliers().subscribe({ next: (s) => this.suppliers.set(s.filter((x) => x.isActive)), error: () => undefined });
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getStock(this.warehouseId(), this.lowOnly()).subscribe({
      next: (r) => {
        this.rows.set(r);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  pickWarehouse(e: Event): void {
    const v = (e.target as HTMLSelectElement).value;
    this.warehouseId.set(v ? Number(v) : null);
    this.load();
  }

  toggleLow(e: Event): void {
    this.lowOnly.set((e.target as HTMLInputElement).checked);
    this.load();
  }

  open(kind: Exclude<Dialog, null>, row?: StockRow): void {
    this.stockRow.set(row ?? null);
    this.target.set(row ? { id: row.variantId, sku: row.sku, productName: row.productName, label: row.label, price: row.price } : null);

    const first = this.warehouses().find((w) => w.isActive)?.id ?? null;

    this.form.reset({
      warehouseId: row?.warehouseId ?? this.warehouseId() ?? first,
      toWarehouseId: this.allActive().find((w) => w.id !== (row?.warehouseId ?? this.warehouseId() ?? first))?.id ?? null,
      quantity: 1,
      unitCost: 0,
      batchNumber: '',
      expiryDate: '',
      supplierId: '',
      delta: 0,
      reason: 'adjustment',
      level: row?.reorderLevel ?? 0,
      note: '',
    });
    this.dialog.set(kind);
  }

  close(): void {
    this.dialog.set(null);
  }

  onPick(v: VariantPick | null): void {
    this.target.set(v);
  }

  submit(): void {
    const d = this.dialog();
    const item = this.target();
    const v = this.form.getRawValue();

    if (!item || !v.warehouseId) {
      this.toast.error(this.i18n.t('inv.pickItem'));
      return;
    }

    let request;

    switch (d) {
      case 'receive':
        if (v.expiryDate && v.expiryDate < this.today) {
          this.toast.error(this.i18n.t('inv.expiryPast'));
          return;
        }

        if (!v.note?.trim()) {
          this.toast.error(this.i18n.t('inv.receiveNeedsNote'));
          return;
        }

        request = this.api.receive({
          warehouseId: Number(v.warehouseId), variantId: item.id, quantity: Number(v.quantity), unitCost: Number(v.unitCost) || 0,
          batchNumber: emptyToNull(v.batchNumber), expiryDate: v.expiryDate || null, supplierId: v.supplierId ? Number(v.supplierId) : null,
          note: emptyToNull(v.note),
        });
        break;
      case 'adjust':
        if (!v.delta || !v.note?.trim()) {
          this.toast.error(this.i18n.t('inv.adjustNeeds'));
          return;
        }
        request = this.api.adjust({ warehouseId: Number(v.warehouseId), variantId: item.id, delta: Number(v.delta), reason: v.reason ?? 'adjustment', note: v.note.trim() });
        break;
      case 'transfer':
        request = this.api.transfer({
          fromWarehouseId: Number(v.warehouseId), toWarehouseId: Number(v.toWarehouseId), variantId: item.id, quantity: Number(v.quantity), note: emptyToNull(v.note),
        });
        break;
      default:
        request = this.api.setReorderLevel({ warehouseId: Number(v.warehouseId), variantId: item.id, level: Number(v.level) || 0 });
    }

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.close();
        // An adjustment is only written: it waits for the head of the warehouse before the quantity changes
        this.toast.success(this.i18n.t(d === 'adjust' ? 'adj.sentToHead' : 'inv.saved'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
