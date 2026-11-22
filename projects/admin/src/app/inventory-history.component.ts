import { Component, OnInit, inject, signal } from '@angular/core';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { I18nService } from '@shared/core/i18n.service';
import { InventoryApiService } from '@shared/core/inventory-api.service';
import { Batch, Movement, Warehouse } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';

const TYPES = ['Receipt', 'Sale', 'Return', 'Adjustment', 'Damage', 'TransferOut', 'TransferIn', 'CountCorrection', 'OpeningBalance', 'SupplierReturn'];

// The history of every quantity change (who, when, why) and the batches with their cost and expiry date
@Component({
  selector: 'app-inventory-history',
  standalone: true,
  imports: [TranslatePipe, DataTableComponent],
  templateUrl: './inventory-history.component.html',
})
export class InventoryHistoryComponent implements OnInit {
  private readonly api = inject(InventoryApiService);
  private readonly i18n = inject(I18nService);

  readonly types = TYPES;
  readonly tab = signal<'movements' | 'batches'>('movements');
  readonly warehouses = signal<Warehouse[]>([]);
  readonly movements = signal<Movement[]>([]);
  readonly batches = signal<Batch[]>([]);
  readonly loading = signal(true);
  readonly warehouseId = signal<number | null>(null);
  readonly type = signal<string | null>(null);
  readonly from = signal<string | null>(null);
  readonly to = signal<string | null>(null);
  readonly expiringOnly = signal(false);

  readonly movementColumns: DtColumn[] = [
    { key: 'date', label: 'inv.date', value: (m: Movement) => m.createdAtUtc, width: '140px' },
    { key: 'warehouse', label: 'inv.warehouse', value: (m: Movement) => m.warehouseName, filter: 'select' },
    { key: 'item', label: 'inv.item', value: (m: Movement) => `${m.productName} ${m.label} ${m.sku}` },
    { key: 'type', label: 'inv.typeCol', value: (m: Movement) => m.type, filter: 'select', optionLabel: (v: string) => this.i18n.t('inv.type.' + v), width: '130px' },
    { key: 'qty', label: 'inv.quantity', value: (m: Movement) => m.quantity, type: 'number', width: '80px' },
    { key: 'balance', label: 'inv.balance', value: (m: Movement) => m.balanceAfter, type: 'number', width: '80px' },
    { key: 'cost', label: 'inv.unitCost', value: (m: Movement) => m.unitCost, type: 'number', width: '90px' },
    { key: 'batch', label: 'inv.batch', value: (m: Movement) => m.batchNumber, width: '110px' },
    { key: 'ref', label: 'inv.reference', value: (m: Movement) => `${m.reference ?? ''} ${m.note ?? ''}` },
    { key: 'user', label: 'inv.by', value: (m: Movement) => m.userName },
  ];

  readonly batchColumns: DtColumn[] = [
    { key: 'warehouse', label: 'inv.warehouse', value: (b: Batch) => b.warehouseName, filter: 'select' },
    { key: 'item', label: 'inv.item', value: (b: Batch) => `${b.productName} ${b.label} ${b.sku}` },
    { key: 'batch', label: 'inv.batch', value: (b: Batch) => b.batchNumber },
    { key: 'received', label: 'inv.received', value: (b: Batch) => b.receivedAtUtc, width: '110px' },
    { key: 'expiry', label: 'inv.expiry', value: (b: Batch) => b.expiryDate, width: '110px' },
    { key: 'remaining', label: 'inv.remaining', value: (b: Batch) => b.quantityRemaining, type: 'number', width: '110px' },
    { key: 'cost', label: 'inv.unitCost', value: (b: Batch) => b.unitCost, type: 'number', width: '90px' },
  ];

  ngOnInit(): void {
    this.api.getWarehouses().subscribe((w) => this.warehouses.set(w));
    this.load();
  }

  load(): void {
    this.loading.set(true);

    if (this.tab() === 'movements') {
      this.api.getMovements({ warehouseId: this.warehouseId(), type: this.type(), from: this.from(), to: this.to() }).subscribe({
        next: (r) => { this.movements.set(r); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
    } else {
      this.api.getBatches({ warehouseId: this.warehouseId(), expiringInDays: this.expiringOnly() ? 30 : null }).subscribe({
        next: (r) => { this.batches.set(r); this.loading.set(false); },
        error: () => this.loading.set(false),
      });
    }
  }

  pickWarehouse(e: Event): void {
    const v = (e.target as HTMLSelectElement).value;
    this.warehouseId.set(v ? Number(v) : null);
    this.load();
  }

  pickType(e: Event): void {
    this.type.set((e.target as HTMLSelectElement).value || null);
    this.load();
  }

  toggleExpiring(e: Event): void {
    this.expiringOnly.set((e.target as HTMLInputElement).checked);
    this.load();
  }
}
