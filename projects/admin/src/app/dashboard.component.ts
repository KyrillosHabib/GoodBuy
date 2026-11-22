import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { environment } from '@shared/environments/environment';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import { IconComponent } from '@shared/components/icon.component';
import { BarChartComponent, ChartItem, ChartSeries, DonutChartComponent, HBarChartComponent, LineChartComponent, PALETTE, SparklineComponent, themeColor } from './accounting/charts/charts';
import { LiveEvent, LiveService } from './live.service';
import './dashboard.i18n';
import './dashboard3.i18n';

interface Change { current: number; previous: number; changePct: number | null }
interface Slice { key: string; value: number }
interface Overview {
  asOf: string;
  ordersToday: Change; revenueToday: Change; ordersMonth: Change; revenueMonth: Change; customers: Change;
  pending: number; confirmed: number; processing: number; shipped: number; unpaidCard: number; toShip: number;
  months: string[]; monthlyOrders: number[]; monthlyRevenue: number[];
  byStatus: Slice[]; byPaymentMethod: Slice[]; locations: Slice[];
  topProducts: { name: string; units: number; price: number; imageUrl: string | null }[];
  recent: { id: number; number: string; customer: string; total: number; currency: string; status: string; paymentStatus: string; paymentMethod: string; items: number; firstItem: string; imageUrl: string | null; createdAtUtc: string }[];
}
interface Aging { total: number; current: number; days1To30: number; days31To60: number; days61To90: number; over90: number }
interface Analytics {
  monthly: { months: string[]; netProfit: number[]; cashIn: number[]; cashOut: number[] };
  cashNow: number; receivables: Aging; payables: Aging;
  pending: { documents: number; vouchers: number; journal: number; transfers: number; settlements: number; carrierSettlements: number; issues: number; gatewaySettlements: number };
  changes: { revenue: Change; expenses: Change; profit: Change };
}
interface Stock {
  totalUnits: number; totalValue: number; lowStockItems: number; openPurchaseOrders: number; transfersToApprove: number;
  daily: { day: string; unitsIn: number; unitsOut: number }[];
  byWarehouse: { name: string; units: number }[];
  lowStock: { warehouseName: string; productName: string; label: string; onHand: number; reorderLevel: number }[];
}
interface Feed { area: string; kind: string; at: Date }
interface CashAcc { id: number; name: string; nameEn: string; nameAr: string | null; type: string; isActive: boolean; balance: number }
interface AccDash { cashBalance: number; dueFromCarriers: number; receivables: number; payables: number; overdueReceivables: number; overduePayables: number; cashAccounts: CashAcc[] }
interface JournalRow { id: number; number: string; entryDate: string; description: string; source: string; sourceNumber: string | null; totalAmount: number; status: string; isReversed: boolean }
interface MoveRow { id: number; createdAtUtc: string; warehouseName: string; productName: string; label: string; type: string; quantity: number; balanceAfter: number }
interface Kpi { id: string; icon: string; label: string; value: number; sub: string; change: number | null; showChange: boolean; spark: number[]; color: string; link: string; warn: boolean }

// The main dashboard of the person in charge: counts (not details) for orders, what accounting cares about, stock and places of the orders.
// Everything updates by itself: the server only says WHAT changed (SignalR) and each part re-reads its own numbers through the normal permission-checked endpoints.
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [DecimalPipe, DatePipe, RouterLink, TranslatePipe, IconComponent, LineChartComponent, BarChartComponent, DonutChartComponent, HBarChartComponent, SparklineComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);
  readonly live = inject(LiveService);

  readonly c0 = themeColor();
  readonly c1 = PALETTE[1];
  readonly c3 = PALETTE[3];
  readonly monthOptions = [6, 12];
  readonly months = signal(12);

  readonly showOrders = computed(() => this.auth.can('orders'));
  readonly showAccounting = computed(() => this.auth.can('accounting.dashboard'));
  readonly showStock = computed(() => this.auth.can('inventory.dashboard', 'inventory'));

  readonly ov = signal<Overview | null>(null);
  readonly an = signal<Analytics | null>(null);
  readonly st = signal<Stock | null>(null);
  readonly acc = signal<AccDash | null>(null);
  readonly journal = signal<JournalRow[]>([]);
  readonly moves = signal<MoveRow[]>([]);
  readonly salesTab = signal<'sales' | 'orders'>('sales');
  readonly loading = computed(() => (this.showOrders() || this.showAccounting() || this.showStock()) && !this.ov() && !this.an() && !this.st() && !this.failed());
  readonly failed = signal(false);

  readonly showJournal = computed(() => this.auth.can('accounting', 'accounting.journal', 'accounting.approve'));
  readonly showMoves = computed(() => this.auth.can('history', 'inventory'));
  readonly feed = signal<Feed[]>([]);

  // The eight numbers on top: each one shows only when the person may see where it comes from
  readonly kpis = computed<Kpi[]>(() => {
    const o = this.ov();
    const a = this.an();
    const c = this.acc();
    const s = this.st();
    const t = (k: string) => this.i18n.t(k);
    const list: Kpi[] = [];
    const sum = (v: number[]) => v.reduce((x, y) => x + y, 0);

    if (o) {
      list.push({ id: 'sales', icon: 'trending-up', label: 'a.dash3.k.sales', value: sum(o.monthlyRevenue), sub: t('a.dash3.k.lastN').replace('{n}', String(o.months.length)), change: o.revenueMonth.changePct, showChange: true, spark: o.monthlyRevenue, color: '#3f9e6a', link: '/orders', warn: false });
    }

    if (a) {
      list.push({ id: 'profit', icon: 'bar-chart', label: 'a.dash3.k.profit', value: a.changes.profit.current, sub: t('a.dash3.k.thisMonth'), change: a.changes.profit.changePct, showChange: true, spark: a.monthly.netProfit, color: '#4a78d6', link: '/accounting/reports', warn: a.changes.profit.current < 0 });
    }

    if (o) {
      list.push({ id: 'orders', icon: 'shopping-cart', label: 'a.dash3.k.orders', value: sum(o.monthlyOrders), sub: t('a.dash3.k.lastN').replace('{n}', String(o.months.length)), change: o.ordersMonth.changePct, showChange: true, spark: o.monthlyOrders, color: this.c0, link: '/orders', warn: false });
      list.push({ id: 'pending', icon: 'clock', label: 'a.dash3.k.pending', value: o.pending, sub: t('a.dash3.k.toShip').replace('{n}', String(o.toShip)), change: null, showChange: false, spark: [], color: '#e08a2e', link: '/orders', warn: false });
    }

    if (s) {
      list.push({ id: 'stock', icon: 'box', label: 'a.dash3.k.stock', value: s.totalValue, sub: t('a.dash3.k.units').replace('{n}', s.totalUnits.toLocaleString('en')), change: null, showChange: false, spark: [], color: '#7c5cc4', link: '/inventory/stock', warn: false });
    }

    const payables = c?.payables ?? a?.payables.total;
    if (payables !== undefined) {
      const over = c?.overduePayables ?? 0;
      list.push({ id: 'payables', icon: 'file-text', label: 'a.dash3.k.payables', value: payables, sub: over > 0 ? t('a.dash3.k.overdue').replace('{n}', over.toLocaleString('en')) : t('a.dash3.k.noOverdue'), change: null, showChange: false, spark: [], color: '#c2446b', link: '/accounting/parties', warn: over > 0 });
    }

    if (c) {
      list.push({ id: 'carriers', icon: 'truck', label: 'a.dash3.k.carriers', value: c.dueFromCarriers, sub: t('a.dash3.k.carriersSub'), change: null, showChange: false, spark: [], color: '#c9a227', link: '/accounting/settlements-hub', warn: false });
      list.push({ id: 'cash', icon: 'credit-card', label: 'a.dash3.k.cash', value: c.cashBalance, sub: t('a.dash3.k.cashSub').replace('{n}', String(c.cashAccounts.filter((x) => x.isActive).length)), change: null, showChange: false, spark: a?.monthly.cashIn ?? [], color: '#177a93', link: '/accounting/treasury', warn: c.cashBalance < 0 });
    } else if (a) {
      list.push({ id: 'cash', icon: 'credit-card', label: 'a.dash3.k.cash', value: a.cashNow, sub: '', change: null, showChange: false, spark: a.monthly.cashIn, color: '#177a93', link: '/accounting/treasury', warn: a.cashNow < 0 });
    }

    return list;
  });

  // Performance: a few ratios worked out from the numbers above
  readonly perf = computed(() => {
    const o = this.ov();
    const a = this.an();
    const list: { label: string; value: string; change?: number | null }[] = [];
    const n = (v: number) => Math.round(v).toLocaleString('en');

    if (o) {
      const revenue = o.monthlyRevenue.reduce((x, y) => x + y, 0);
      const orders = o.monthlyOrders.reduce((x, y) => x + y, 0);

      list.push({ label: 'a.dash3.p.aov', value: orders > 0 ? n(revenue / orders) : '—' });
      list.push({ label: 'a.dash3.p.ordersToday', value: n(o.ordersToday.current), change: o.ordersToday.changePct });
      list.push({ label: 'a.dash3.p.revenueToday', value: n(o.revenueToday.current), change: o.revenueToday.changePct });
      list.push({ label: 'a.dash3.p.revenueMonth', value: n(o.revenueMonth.current), change: o.revenueMonth.changePct });
      list.push({ label: 'a.dash3.p.customers', value: n(o.customers.current), change: o.customers.changePct });
    }

    if (a && a.changes.revenue.current > 0) {
      list.push({ label: 'a.dash3.p.margin', value: ((a.changes.profit.current / a.changes.revenue.current) * 100).toFixed(1) + '%' });
    }

    return list;
  });

  private activeBalances(): CashAcc[] {
    return (this.acc()?.cashAccounts ?? []).filter((x) => x.isActive);
  }

  balanceTotal(): number {
    return this.activeBalances().reduce((sum, x) => sum + x.balance, 0);
  }

  balanceItems(): ChartItem[] {
    const ar = this.i18n.isRtl();

    return this.activeBalances()
      .filter((x) => x.balance !== 0)
      .sort((x, y) => y.balance - x.balance)
      .map((x) => ({ label: ar ? (x.nameAr || x.name) : (x.nameEn || x.name), value: Math.max(0, x.balance) }));
  }

  balanceTypeItems(): ChartItem[] {
    const by = new Map<string, number>();

    for (const x of this.activeBalances()) by.set(x.type, (by.get(x.type) ?? 0) + Math.max(0, x.balance));

    return [...by.entries()].filter(([, v]) => v > 0).map(([k, v]) => ({ label: this.i18n.t('a.dash3.ct.' + k), value: v }));
  }

  levelPct(onHand: number, reorder: number): number {
    return reorder > 0 ? Math.min(100, Math.max(3, (onHand / reorder) * 100)) : 3;
  }

  moveType(k: string): string {
    return this.label('inv.type.', k);
  }

  // Work waiting for the person: only what he is allowed to see and only when there is something
  readonly work = computed(() => {
    const list: { key: string; count: number; link: string; warn?: boolean }[] = [];
    const o = this.ov();
    const a = this.an();
    const s = this.st();

    if (o) {
      list.push({ key: 'a.dash2.w.pending', count: o.pending, link: '/orders' });
      list.push({ key: 'a.dash2.w.toShip', count: o.toShip, link: '/fulfilment' });
      list.push({ key: 'a.dash2.w.shipped', count: o.shipped, link: '/orders' });
      list.push({ key: 'a.dash2.w.unpaid', count: o.unpaidCard, link: '/orders', warn: true });
    }

    if (a) {
      const p = a.pending;
      list.push({ key: 'a.dash2.w.approvals', count: p.documents + p.vouchers + p.journal + p.transfers + p.settlements + p.carrierSettlements + p.gatewaySettlements, link: '/accounting/inbox' });
      list.push({ key: 'a.dash2.w.issues', count: p.issues, link: '/accounting/inbox', warn: true });
    }

    if (s) {
      list.push({ key: 'a.dash2.w.lowStock', count: s.lowStockItems, link: '/inventory', warn: true });
      list.push({ key: 'a.dash2.w.po', count: s.openPurchaseOrders, link: '/inventory/purchase-orders' });
      list.push({ key: 'a.dash2.w.transfers', count: s.transfersToApprove, link: '/inventory' });
    }

    return list.filter((w) => w.count > 0);
  });

  private readonly dirty = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.live.events.pipe(takeUntilDestroyed()).subscribe((e) => this.onLive(e));
    this.destroyRef.onDestroy(() => { if (this.timer) clearTimeout(this.timer); this.live.stop(); });
  }

  ngOnInit(): void {
    this.reloadAll();

    if (this.showOrders() || this.showAccounting() || this.showStock()) this.live.start();
  }

  reloadAll(): void {
    this.failed.set(false);
    this.loadOrders();
    this.loadAccounting();
    this.loadStock();
    this.loadLatest();
  }

  setMonths(m: number): void {
    this.months.set(m);
    this.loadOrders();
  }

  private onLive(e: LiveEvent): void {
    this.feed.update((f) => [{ area: e.area, kind: e.kind, at: new Date(e.at) }, ...f].slice(0, 12));

    // An order changes the orders numbers and also what accounting and stock show
    this.dirty.add(e.area);
    if (e.area === 'orders' || e.kind === 'Reconnected') { this.dirty.add('accounting'); this.dirty.add('inventory'); }

    if (this.timer) return;

    // Several events in a row are one refresh
    this.timer = setTimeout(() => {
      this.timer = null;
      const areas = new Set(this.dirty);
      this.dirty.clear();

      if (areas.has('orders')) this.loadOrders();
      if (areas.has('accounting')) this.loadAccounting();
      if (areas.has('inventory')) this.loadStock();
      if (areas.has('accounting') || areas.has('inventory')) this.loadLatest();
    }, 600);
  }

  private loadOrders(): void {
    if (!this.showOrders()) return;

    this.http.get<Overview>(`${environment.apiUrl}/api/admin/dashboard/orders`, { params: { months: this.months() } }).subscribe({
      next: (r) => this.ov.set(r),
      error: () => this.failed.set(true),
    });
  }

  private loadAccounting(): void {
    if (!this.showAccounting()) return;

    this.http.get<AccDash>(`${environment.apiUrl}/api/admin/accounting/dashboard`).subscribe({
      next: (r) => this.acc.set(r),
      error: () => this.failed.set(true),
    });

    this.http.get<Analytics>(`${environment.apiUrl}/api/admin/accounting/dashboard/analytics`, { params: { months: 6 } }).subscribe({
      next: (r) => this.an.set(r),
      error: () => this.failed.set(true),
    });
  }

  private loadStock(): void {
    if (!this.showStock()) return;

    this.http.get<Stock>(`${environment.apiUrl}/api/admin/inventory/dashboard`, { params: { days: 30 } }).subscribe({
      next: (r) => this.st.set(r),
      error: () => this.failed.set(true),
    });
  }

  // The latest money entries and stock movements (only for people allowed to open those screens)
  private loadLatest(): void {
    const since = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

    if (this.showJournal()) {
      this.http.get<JournalRow[]>(`${environment.apiUrl}/api/admin/accounting/journal`, { params: { from: since(30) } }).subscribe({
        next: (r) => this.journal.set([...r].sort((x, y) => y.entryDate.localeCompare(x.entryDate) || y.id - x.id).slice(0, 8)),
        error: () => this.journal.set([]),
      });
    }

    if (this.showMoves()) {
      this.http.get<MoveRow[]>(`${environment.apiUrl}/api/admin/inventory/movements`, { params: { from: since(14) } }).subscribe({
        next: (r) => this.moves.set([...r].sort((x, y) => y.createdAtUtc.localeCompare(x.createdAtUtc)).slice(0, 8)),
        error: () => this.moves.set([]),
      });
    }
  }

  // ---------------------------------------------------------------- shaping the data for the charts
  pct(v: number | null): string {
    return v === null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
  }

  salesSeries(o: Overview): ChartSeries[] {
    return [{ name: this.i18n.t('a.dash2.s.revenue'), values: o.monthlyRevenue, color: this.c0 }];
  }

  orderSeries(o: Overview): ChartSeries[] {
    return [{ name: this.i18n.t('a.dash3.tab.orders'), values: o.monthlyOrders, color: this.c0 }];
  }

  statusItems(o: Overview): ChartItem[] {
    return o.byStatus.filter((x) => x.value > 0).map((x) => ({ label: this.statusLabel(x.key), value: x.value }));
  }

  methodItems(o: Overview): ChartItem[] {
    return o.byPaymentMethod.filter((x) => x.value > 0).map((x) => ({ label: this.methodLabel(x.key), value: x.value }));
  }

  placeItems(o: Overview): ChartItem[] {
    return o.locations.filter((x) => x.value > 0).map((x, i) => ({ label: x.key || this.i18n.t('a.dash2.c.other'), value: x.value, color: PALETTE[i % PALETTE.length] }));
  }

  placePct(o: Overview, v: number): string {
    const total = o.locations.reduce((s, x) => s + x.value, 0);

    return total > 0 ? ((v / total) * 100).toFixed(0) : '0';
  }

  profitSeries(a: Analytics): ChartSeries[] {
    return [{ name: this.i18n.t('a.dash2.s.profit'), values: a.monthly.netProfit, color: PALETTE[3] }];
  }

  cashSeries(a: Analytics): ChartSeries[] {
    return [
      { name: this.i18n.t('a.dash2.s.cashIn'), values: a.monthly.cashIn, color: PALETTE[3] },
      { name: this.i18n.t('a.dash2.s.cashOut'), values: a.monthly.cashOut, color: PALETTE[1] },
    ];
  }

  agingLabels(): string[] {
    return ['a.dash2.a.receivables', 'a.dash2.a.payables'].map((k) => this.i18n.t(k));
  }

  agingSeries(a: Analytics): ChartSeries[] {
    const pick = (f: (x: Aging) => number) => [f(a.receivables), f(a.payables)];

    return [
      { name: this.i18n.t('a.dash2.a.current'), values: pick((x) => x.current), color: PALETTE[3] },
      { name: this.i18n.t('a.dash2.a.d30'), values: pick((x) => x.days1To30), color: PALETTE[7] },
      { name: this.i18n.t('a.dash2.a.d60'), values: pick((x) => x.days31To60), color: PALETTE[6] },
      { name: this.i18n.t('a.dash2.a.d90'), values: pick((x) => x.days61To90), color: PALETTE[1] },
      { name: this.i18n.t('a.dash2.a.over'), values: pick((x) => x.over90), color: PALETTE[4] },
    ];
  }

  stockDays(s: Stock): string[] {
    return s.daily.map((d) => d.day.slice(5, 10));
  }

  stockSeries(s: Stock): ChartSeries[] {
    return [
      { name: this.i18n.t('a.dash2.s.in'), values: s.daily.map((d) => d.unitsIn), color: PALETTE[3] },
      { name: this.i18n.t('a.dash2.s.out'), values: s.daily.map((d) => d.unitsOut), color: PALETTE[1] },
    ];
  }

  warehouseItems(s: Stock): ChartItem[] {
    return s.byWarehouse.map((w) => ({ label: w.name, value: w.units }));
  }

  statusLabel(k: string): string { return this.label('a.dash2.st.', k); }
  payLabel(k: string): string { return this.label('a.dash2.pay.', k); }
  methodLabel(k: string): string { return this.label('a.dash2.pm.', k); }

  // A key we have no text for is shown as it is
  private label(prefix: string, k: string): string {
    const t = this.i18n.t(prefix + k);

    return t === prefix + k ? k : t;
  }

  areaColor(area: string): string {
    return area === 'orders' ? PALETTE[0] : area === 'accounting' ? PALETTE[1] : PALETTE[3];
  }
}
