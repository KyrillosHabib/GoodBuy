import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { AuthService } from '@shared/core/auth.service';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { ModalComponent } from '@shared/components/modal.component';
import { I18nService } from '@shared/core/i18n.service';
import { InventoryApiService } from '@shared/core/inventory-api.service';
import { PurchaseOrder, Supplier, VariantPick, Warehouse } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { VariantPickerComponent } from './variant-picker.component';

import { IntroComponent } from './intro.component';
interface EditLine { variantId: number; text: string; quantity: number; unitCost: number; }
interface ReceiveRow { lineId: number; text: string; remaining: number; quantity: number; batchNumber: string; expiryDate: string; }

// Purchase orders: draft -> send to the supplier -> receive (all or part). Receiving creates batches with their cost and
// expiry date. An employee can only receive orders delivered to their own warehouses.
@Component({
  selector: 'app-purchase-orders-admin',
  standalone: true,
  imports: [IntroComponent, FormsModule, TranslatePipe, DataTableComponent, ModalComponent, VariantPickerComponent],
  templateUrl: './purchase-orders-admin.component.html',
})
export class PurchaseOrdersAdminComponent implements OnInit {
  readonly today = new Date().toISOString().slice(0, 10);

  readonly auth = inject(AuthService);
  private readonly api = inject(InventoryApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly orders = signal<PurchaseOrder[]>([]);
  readonly suppliers = signal<Supplier[]>([]);
  readonly warehouses = signal<Warehouse[]>([]);
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly receiving = signal<PurchaseOrder | null>(null);

  editId: number | null = null;
  supplierId: number | null = null;
  warehouseId: number | null = null;
  expectedAt = '';
  notes = '';
  lines: EditLine[] = [];
  receiveRows: ReceiveRow[] = [];

  // The row that is being filled in to add the next item
  draftPick: VariantPick | null = null;
  draftQty: number | null = 1;
  draftCost: number | null = null;

  readonly columns: DtColumn[] = [
    { key: 'number', label: '#', value: (o: PurchaseOrder) => o.number, width: '110px' },
    { key: 'supplier', label: 'inv.supplier', value: (o: PurchaseOrder) => o.supplierName, filter: 'select' },
    { key: 'warehouse', label: 'inv.warehouse', value: (o: PurchaseOrder) => o.warehouseName, filter: 'select' },
    { key: 'status', label: 'inv.status', value: (o: PurchaseOrder) => o.status, filter: 'select', optionLabel: (v: string) => this.i18n.t('inv.po.' + v), width: '140px' },
    { key: 'total', label: 'inv.total', value: (o: PurchaseOrder) => o.total, type: 'number', width: '100px' },
    { key: 'date', label: 'inv.date', value: (o: PurchaseOrder) => o.createdAtUtc, width: '110px' },
    { key: 'actions', label: '', width: '300px' },
  ];

  ngOnInit(): void {
    this.api.getWarehouses().subscribe((w) => this.warehouses.set(w.filter((x) => x.isActive)));
    if (this.auth.can('purchaseOrders.manage')) this.api.getSuppliers().subscribe((s) => this.suppliers.set(s.filter((x) => x.isActive)));
    this.load();
  }

  load(): void {
    this.api.getPurchaseOrders().subscribe((o) => this.orders.set(o));
  }

  total(): number {
    return Math.round(this.lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0), 0) * 100) / 100;
  }

  newOrder(): void {
    this.editId = null;
    this.supplierId = null;
    this.warehouseId = this.warehouses()[0]?.id ?? null;
    this.expectedAt = '';
    this.notes = '';
    this.lines = [];
    this.draftPick = null;
    this.draftQty = 1;
    this.draftCost = null;
    this.editing.set(true);
  }

  edit(o: PurchaseOrder): void {
    this.editId = o.id;
    this.supplierId = o.supplierId;
    this.warehouseId = o.warehouseId;
    this.expectedAt = o.expectedAtUtc?.slice(0, 10) ?? '';
    this.notes = o.notes ?? '';
    this.lines = o.lines.map((l) => ({ variantId: l.variantId, text: `${l.productName} ${l.label} (${l.sku})`, quantity: l.quantityOrdered, unitCost: l.unitCost }));
    this.editing.set(true);
  }

  // Puts the item of the entry row in the list, and empties the row for the next one
  addDraft(picker: { reset(): void }): void {
    const v = this.draftPick;

    if (!v || !(Number(this.draftQty) >= 1) || !(Number(this.draftCost) > 0)) {
      this.toast.error(this.i18n.t('inv.lineIncomplete'));
      return;
    }

    const existing = this.lines.find((l) => l.variantId === v.id);

    if (existing) {
      // The same item twice = one line with the sum of the quantities
      existing.quantity = Number(existing.quantity) + Number(this.draftQty);
      existing.unitCost = Number(this.draftCost);
    } else {
      this.lines = [...this.lines, { variantId: v.id, text: `${v.productName} ${v.label} (${v.sku})`, quantity: Number(this.draftQty), unitCost: Number(this.draftCost) }];
    }

    this.draftPick = null;
    this.draftQty = 1;
    this.draftCost = null;
    picker.reset();
  }

  save(): void {
    if (!this.supplierId || !this.warehouseId || this.lines.length === 0 || this.lines.some((l) => !(l.quantity >= 1))) {
      this.toast.error(this.i18n.t('inv.poIncomplete'));
      return;
    }

    if (this.lines.some((l) => !(Number(l.unitCost) > 0))) {
      this.toast.error(this.i18n.t('inv.costRequired'));
      return;
    }

    if (this.expectedAt && this.expectedAt < this.today) {
      this.toast.error(this.i18n.t('inv.expectedPast'));
      return;
    }

    const body = {
      supplierId: this.supplierId,
      warehouseId: this.warehouseId,
      expectedAtUtc: this.expectedAt || null,
      notes: this.notes.trim() || null,
      lines: this.lines.map((l) => ({ variantId: l.variantId, quantity: Number(l.quantity), unitCost: Number(l.unitCost) || 0 })),
    };

    this.saving.set(true);
    const request: Observable<unknown> = this.editId ? this.api.updatePurchaseOrder(this.editId, body) : this.api.createPurchaseOrder(body);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(false);
        this.toast.success(this.i18n.t('inv.saved'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  send(o: PurchaseOrder): void {
    this.api.changePurchaseOrderStatus(o.id, 'order').subscribe(() => this.load());
  }

  cancel(o: PurchaseOrder): void {
    if (!confirm(this.i18n.t('inv.confirmCancelPo'))) return;
    this.api.changePurchaseOrderStatus(o.id, 'cancel').subscribe(() => this.load());
  }

  canReceive(o: PurchaseOrder): boolean {
    return o.status === 'Ordered' || o.status === 'PartiallyReceived';
  }

  openReceive(o: PurchaseOrder): void {
    this.receiveRows = o.lines.map((l) => ({
      lineId: l.id,
      text: `${l.productName} ${l.label} (${l.sku})`,
      remaining: l.quantityOrdered - l.quantityReceived,
      quantity: l.quantityOrdered - l.quantityReceived,
      batchNumber: '',
      expiryDate: '',
    }));
    this.receiving.set(o);
  }

  receive(o: PurchaseOrder): void {
    const lines = this.receiveRows
      .filter((r) => Number(r.quantity) > 0)
      .map((r) => ({ lineId: r.lineId, quantity: Number(r.quantity), batchNumber: r.batchNumber.trim() || null, expiryDate: r.expiryDate || null }));

    if (lines.length === 0) {
      this.toast.error(this.i18n.t('inv.nothingToReceive'));
      return;
    }

    if (lines.some((l) => l.expiryDate && l.expiryDate < this.today)) {
      this.toast.error(this.i18n.t('inv.expiryPast'));
      return;
    }

    this.saving.set(true);
    this.api.receivePurchaseOrder(o.id, lines).subscribe({
      next: () => {
        this.saving.set(false);
        this.receiving.set(null);
        this.toast.success(this.i18n.t('inv.received'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
