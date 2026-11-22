import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { InventoryApiService } from '@shared/core/inventory-api.service';
import { InventoryManagerApiService } from '@shared/core/inventory-manager-api.service';
import { InventoryManagerDashboard, MgrReorder } from '@shared/core/inventory-manager.models';
import { Supplier, Warehouse } from '@shared/core/models';
import { ProductImagePipe, TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { IconComponent } from '@shared/components/icon.component';
import { ChartItem, DonutChartComponent, HBarChartComponent, PALETTE, themeColor } from './accounting/charts/charts';
import './inventory-manager.i18n';

interface Top { id: string; icon: string; label: string; value: string; sub: string; color: string; link: string; warn: boolean; anchor?: string }
interface Alert { level: 'bad' | 'warn' | 'info'; text: string; count: number; link: string }
interface Tile { label: string; value: number; link: string; warn?: boolean }
interface Report { label: string; icon: string; link?: string; anchor?: string }

// The dashboard of the manager of the warehouses and purchasing: the five numbers, what to buy now (reorder level -> purchase orders),
// stock status, purchase orders, warehouse operations, suppliers, alerts and quick reports
@Component({
  selector: 'app-inventory-home',
  standalone: true,
  imports: [RouterLink, DecimalPipe, DatePipe, TranslatePipe, ProductImagePipe, IconComponent, DonutChartComponent, HBarChartComponent],
  templateUrl: './inventory-home.component.html',
  styleUrl: './inventory-home.component.css',
})
export class InventoryHomeComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly api = inject(InventoryManagerApiService);
  private readonly inv = inject(InventoryApiService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly periods = [7, 30, 90, 180];
  readonly accent = themeColor();

  readonly d = signal<InventoryManagerDashboard | null>(null);
  readonly failed = signal(false);
  readonly days = signal(30);
  readonly warehouseId = signal<number | null>(null);
  readonly warehouses = signal<Warehouse[]>([]);
  readonly suppliers = signal<Supplier[]>([]);
  readonly creating = signal(false);

  // the ticked suggestions, the quantities and the suppliers the manager changed
  private readonly selected = signal<Record<string, boolean>>({});
  private readonly qtys = signal<Record<string, number>>({});
  private readonly sups = signal<Record<string, number | null>>({});

  readonly canOrder = computed(() => this.auth.can('purchaseOrders.manage'));

  readonly reports: Report[] = [
    { label: 'a.invmgr.rp.stock', icon: 'layers', link: '/inventory/reports/stock-items' },
    { label: 'a.invmgr.rp.move', icon: 'refresh', link: '/inventory/reports/movements' },
    { label: 'a.invmgr.rp.value', icon: 'bar-chart', link: '/inventory/reports/warehouse-inventory' },
    { label: 'a.invmgr.rp.stagnant', icon: 'clock', anchor: 'stagnant' },
    { label: 'a.invmgr.rp.reorder', icon: 'flag', link: '/inventory/reports/reorder' },
    { label: 'a.invmgr.rp.purchases', icon: 'file-text', link: '/inventory/reports/supplier-purchases' },
    { label: 'a.invmgr.rp.suppliers', icon: 'users', anchor: 'suppliers' },
    { label: 'a.invmgr.rp.transfers', icon: 'truck', link: '/inventory/transfers' },
    { label: 'a.invmgr.rp.counts', icon: 'check-circle', link: '/inventory/adjustments' },
  ];

  readonly tops = computed<Top[]>(() => {
    const x = this.d();

    if (!x) return [];

    const t = (key: string, n: number | string): string => this.i18n.t(key).replace('{n}', String(n));

    return [
      { id: 'value', icon: 'layers', label: 'a.invmgr.t.value', value: Math.round(x.stockValue).toLocaleString('en'), sub: t('a.invmgr.t.valueSub', x.itemsInStock), color: '#177a93', link: '/inventory/reports/stock-items', warn: false },
      { id: 'low', icon: 'flag', label: 'a.invmgr.t.low', value: x.lowStockItems.toLocaleString('en'), sub: t('a.invmgr.t.lowSub', x.outOfStockItems), color: '#e08a2e', link: '', anchor: 'reorder', warn: x.lowStockItems > 0 },
      { id: 'po', icon: 'file-text', label: 'a.invmgr.t.po', value: x.openPurchaseOrders.toLocaleString('en'), sub: t('a.invmgr.t.poSub', x.purchaseOrders.late), color: '#7c5cc4', link: '/inventory/purchase-orders', warn: x.purchaseOrders.late > 0 },
      { id: 'tr', icon: 'truck', label: 'a.invmgr.t.tr', value: x.pendingTransfers.toLocaleString('en'), sub: t('a.invmgr.t.trSub', x.operations.transfersInTransit), color: '#3f9e6a', link: '/inventory/transfers', warn: false },
      { id: 'buy', icon: 'bar-chart', label: 'a.invmgr.t.buy', value: Math.round(x.purchasesValue).toLocaleString('en'), sub: t('a.invmgr.t.buySub', x.purchaseOrdersInPeriod), color: '#c2446b', link: '/inventory/reports/supplier-purchases', warn: false },
    ];
  });

  readonly stockSplit = computed<ChartItem[]>(() => {
    const x = this.d();

    return x ? [{ label: this.i18n.t('a.invmgr.st.available'), value: x.availableUnits, color: PALETTE[3] }, { label: this.i18n.t('a.invmgr.st.reserved'), value: x.reservedUnits, color: PALETTE[1] }].filter((i) => i.value > 0) : [];
  });

  readonly poSplit = computed<ChartItem[]>(() => {
    const p = this.d()?.purchaseOrders;

    if (!p) return [];

    return [
      { label: this.i18n.t('a.invmgr.po.draft'), value: p.draft, color: PALETTE[5] },
      { label: this.i18n.t('a.invmgr.po.sent'), value: p.sent, color: PALETTE[0] },
      { label: this.i18n.t('a.invmgr.po.partial'), value: p.partiallyReceived, color: PALETTE[1] },
      { label: this.i18n.t('a.invmgr.po.received'), value: p.received, color: PALETTE[3] },
      { label: this.i18n.t('a.invmgr.po.cancelled'), value: p.cancelled, color: PALETTE[4] },
    ].filter((i) => i.value > 0);
  });

  readonly poTiles = computed<Tile[]>(() => {
    const p = this.d()?.purchaseOrders;

    return p ? [
      { label: 'a.invmgr.po.draft', value: p.draft, link: '' },
      { label: 'a.invmgr.po.sent', value: p.sent, link: '' },
      { label: 'a.invmgr.po.partial', value: p.partiallyReceived, link: '' },
      { label: 'a.invmgr.po.late', value: p.late, link: '', warn: p.late > 0 },
      { label: 'a.invmgr.po.received', value: p.received, link: '' },
    ] : [];
  });

  readonly opTiles = computed<Tile[]>(() => {
    const o = this.d()?.operations;

    return o ? [
      { label: 'a.invmgr.op.receipts', value: o.receiptsPending, link: '/inventory/purchase-orders' },
      { label: 'a.invmgr.op.issues', value: o.issuesPending, link: '/fulfilment' },
      { label: 'a.invmgr.op.trReq', value: o.transfersRequested, link: '/inventory/transfers' },
      { label: 'a.invmgr.op.trApproved', value: o.transfersApproved, link: '/inventory/transfers' },
      { label: 'a.invmgr.op.trTransit', value: o.transfersInTransit, link: '/inventory/transfers', warn: o.transfersInTransit > 0 },
      { label: 'a.invmgr.op.adj', value: o.adjustmentsPending, link: '/inventory/adjustments', warn: o.adjustmentsPending > 0 },
      { label: 'a.invmgr.op.counts', value: o.countsOpen, link: '/inventory/counts' },
      { label: 'a.invmgr.op.srPending', value: o.supplierReturnsPending, link: '/inventory/returns' },
      { label: 'a.invmgr.op.srDone', value: o.supplierReturnsDone, link: '/inventory/returns' },
      { label: 'a.invmgr.op.crPending', value: o.customerReturnsPending, link: '/customer-returns' },
      { label: 'a.invmgr.op.crDone', value: o.customerReturnsDone, link: '/customer-returns' },
    ] : [];
  });

  readonly supplierBars = computed<ChartItem[]>(() => (this.d()?.topSuppliers ?? []).map((s) => ({ label: s.name, value: Math.round(s.value) })));

  // What needs a person today, from the numbers above (only what is above zero)
  readonly alerts = computed<Alert[]>(() => {
    const x = this.d();

    if (!x) return [];

    const list: Alert[] = [
      { level: 'warn', text: 'a.invmgr.al.low', count: x.lowStockItems, link: '/inventory/reports/reorder' },
      { level: 'bad', text: 'a.invmgr.al.out', count: x.outOfStockItems, link: '/inventory/stock' },
      { level: 'bad', text: 'a.invmgr.al.late', count: x.purchaseOrders.late, link: '/inventory/purchase-orders' },
      { level: 'info', text: 'a.invmgr.al.draft', count: x.purchaseOrders.draft, link: '/inventory/purchase-orders' },
      { level: 'warn', text: 'a.invmgr.al.transit', count: x.operations.transfersInTransit, link: '/inventory/transfers' },
      { level: 'warn', text: 'a.invmgr.al.countDiff', count: x.operations.countAdjustmentsPending, link: '/inventory/adjustments' },
      { level: 'warn', text: 'a.invmgr.al.adj', count: x.operations.adjustmentsPending, link: '/inventory/adjustments' },
      { level: 'bad', text: 'a.invmgr.al.expired', count: x.expired, link: '/inventory/reports/expiry' },
    ];

    return list.filter((a) => a.count > 0);
  });

  ngOnInit(): void {
    this.inv.getWarehouses().subscribe({ next: (w) => this.warehouses.set(w) });

    if (this.canOrder()) this.inv.getSuppliers().subscribe({ next: (s) => this.suppliers.set(s.filter((x) => x.isActive)) });

    this.load();
  }

  load(): void {
    this.failed.set(false);
    this.api.get(this.days(), this.warehouseId()).subscribe({
      next: (x) => this.d.set(x),
      error: () => this.failed.set(true),
    });
  }

  setDays(n: number): void {
    this.days.set(n);
    this.load();
  }

  setWarehouse(v: string): void {
    this.warehouseId.set(v ? +v : null);
    this.load();
  }

  jump(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---- the reorder suggestions
  key(r: MgrReorder): string { return `${r.variantId}-${r.warehouseId}`; }
  isSel(r: MgrReorder): boolean { return !!this.selected()[this.key(r)]; }
  toggle(r: MgrReorder, on: boolean): void { this.selected.update((s) => ({ ...s, [this.key(r)]: on })); }
  qtyOf(r: MgrReorder): number { return this.qtys()[this.key(r)] ?? r.suggestedQuantity; }
  setQty(r: MgrReorder, v: number): void { this.qtys.update((q) => ({ ...q, [this.key(r)]: v })); }
  supplierOf(r: MgrReorder): number | null { const k = this.key(r); return k in this.sups() ? this.sups()[k] : r.supplierId; }
  setSupplier(r: MgrReorder, v: string): void { this.sups.update((s) => ({ ...s, [this.key(r)]: v ? +v : null })); }

  readonly selectedRows = computed(() => (this.d()?.reorder ?? []).filter((r) => this.isSel(r)));
  readonly allSelected = computed(() => { const l = this.d()?.reorder ?? []; return l.length > 0 && l.every((r) => this.isSel(r)); });
  readonly needSupplier = computed(() => this.selectedRows().some((r) => this.supplierOf(r) === null));

  toggleAll(on: boolean): void {
    this.selected.set(Object.fromEntries((this.d()?.reorder ?? []).map((r) => [this.key(r), on])));
  }

  // One draft purchase order for every supplier and warehouse among the ticked items
  create(): void {
    const rows = this.selectedRows();

    if (rows.length === 0 || this.needSupplier()) {
      if (rows.length > 0) this.toast.error(this.i18n.t('a.invmgr.r.needSupplier'));
      return;
    }

    const groups = new Map<string, { supplierId: number; warehouseId: number; lines: { variantId: number; quantity: number; unitCost: number }[] }>();

    for (const r of rows) {
      const supplierId = this.supplierOf(r) as number;
      const k = `${supplierId}|${r.warehouseId}`;
      const g = groups.get(k) ?? { supplierId, warehouseId: r.warehouseId, lines: [] };

      g.lines.push({ variantId: r.variantId, quantity: Math.max(1, Math.round(this.qtyOf(r))), unitCost: r.unitCost });
      groups.set(k, g);
    }

    this.creating.set(true);
    forkJoin([...groups.values()].map((g) => this.inv.createPurchaseOrder({ supplierId: g.supplierId, warehouseId: g.warehouseId, expectedAtUtc: null, notes: this.i18n.t('a.invmgr.r.note'), lines: g.lines }))).subscribe({
      next: () => {
        this.creating.set(false);
        this.toast.success(this.i18n.t('a.invmgr.r.created').replace('{n}', String(groups.size)));
        this.selected.set({});
        void this.router.navigateByUrl('/inventory/purchase-orders');
      },
      error: () => {
        this.creating.set(false);
        this.toast.error(this.i18n.t('a.invmgr.r.failed'));
      },
    });
  }
}
