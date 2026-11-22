import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatePipe, DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { environment } from '@shared/environments/environment';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { AccountingContext } from '@shared/core/accounting-context.service';
import { AccountingDashboard } from '@shared/core/accounting.models';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import { IconComponent } from '@shared/components/icon.component';
import { BarChartComponent, ChartItem, ChartSeries, DonutChartComponent, HBarChartComponent, LineChartComponent, SparklineComponent, themeColor } from './charts/charts';
import './analytics.i18n';
import './accounting-home.i18n';

interface Change { current: number; previous: number; changePct: number | null }
interface Aging { current: number; days1To30: number; days31To60: number; days61To90: number; over90: number; total: number; unappliedCredits: number }
interface Amount { id: number | null; key: string; name: string; amount: number }
interface Analytics {
  monthsCount: number;
  monthly: { months: string[]; revenue: number[]; costOfSales: number[]; expenses: number[]; netProfit: number[]; grossMarginPct: number[]; cashIn: number[]; cashOut: number[] };
  totalRevenue: number; totalExpenses: number; totalProfit: number; grossMarginPct: number; cashNow: number;
  receivables: Aging; payables: Aging; topCustomers: Amount[]; topSuppliers: Amount[]; expensesByAccount: Amount[];
  unsettled: { custody: number; gateway: number; accounts: Amount[] }; vat: { output: number; input: number; payable: number };
  pending: { documents: number; vouchers: number; journal: number; transfers: number; settlements: number; carrierSettlements: number; issues: number; gatewaySettlements: number };
  changes: { revenue: Change; expenses: Change; profit: Change };
}
interface Queue { key: string; pending: number; drafts: number; oldestDays: number }
interface Period { name: string; startDate: string; endDate: string; isClosed: boolean; overdue: boolean }
interface SettleRow { key: string; count: number; pending: number; received: number; fees: number; difference: number }
interface TeamRow { name: string; created: number; approved: number; rejected: number; late: number }
interface AuditRow { atUtc: string; entityType: string; number: string | null; action: string; userName: string | null }
interface Control { days: number; queues: Queue[]; rejectedEntries: number; openPeriods: number; periods: Period[]; settlements: SettleRow[]; team: TeamRow[]; audit: AuditRow[] }
interface Top { id: string; icon: string; label: string; value: number; sub: string; change: number | null; showChange: boolean; spark: number[]; color: string; link: string; warn: boolean }
interface CompareRow { label: string; cur: string; prev: string; change: number | null; good: boolean }

const QUEUE_LINKS: Record<string, string> = {
  journal: '/accounting/journal', vouchers: '/accounting/treasury', transfers: '/accounting/treasury', purchaseInvoices: '/accounting/purchases',
  otherDocuments: '/accounting/sales', settlements: '/accounting/settlements', carrierSettlements: '/accounting/settlements-hub', gatewaySettlements: '/accounting/settlements-hub',
};

// The dashboard of the head of accounts: the five numbers, then money, debts, settlements, approvals, performance, control, the team and quick reports
@Component({
  selector: 'app-accounting-home',
  standalone: true,
  imports: [RouterLink, DecimalPipe, DatePipe, TranslatePipe, IconComponent, LineChartComponent, BarChartComponent, DonutChartComponent, HBarChartComponent, SparklineComponent],
  templateUrl: './accounting-home.component.html',
  styleUrl: './accounting-home.component.css',
})
export class AccountingHomeComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly api = inject(AccountingApiService);
  private readonly ctx = inject(AccountingContext);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);

  readonly c0 = themeColor();
  readonly c1 = '#d08a2e';
  readonly monthOptions = [3, 6, 12];
  readonly months = signal(12);
  readonly dash = signal<AccountingDashboard | null>(null);
  readonly a = signal<Analytics | null>(null);
  readonly c = signal<Control | null>(null);
  readonly failed = signal(false);

  readonly reports = [
    { tab: 'trial', icon: 'layers' }, { tab: 'income', icon: 'bar-chart' }, { tab: 'balance', icon: 'file-text' },
    { tab: 'cash', icon: 'credit-card' }, { tab: 'ledger', icon: 'layers' }, { tab: 'aging', icon: 'clock' },
  ];

  // The five numbers at the top
  readonly tops = computed<Top[]>(() => {
    const an = this.a();
    const d = this.dash();
    const ctl = this.c();
    const t = (k: string) => this.i18n.t(k);
    const list: Top[] = [];

    const cash = d?.cashBalance ?? an?.cashNow;
    if (cash !== undefined) {
      list.push({ id: 'cash', icon: 'credit-card', label: 'a.accdash.t5.cash', value: cash, sub: t('a.accdash.t5.cashSub').replace('{n}', String((d?.cashAccounts ?? []).filter((x) => x.isActive).length)), change: null, showChange: false, spark: an?.monthly.cashIn ?? [], color: this.c0, link: '/accounting/treasury', warn: cash < 0 });
    }

    if (an) {
      const over = d?.overdueReceivables ?? 0;
      list.push({ id: 'ar', icon: 'users', label: 'a.accdash.t5.ar', value: an.receivables.total, sub: over > 0 ? t('a.accdash.t5.overdue').replace('{n}', Math.round(over).toLocaleString('en')) : t('a.accdash.t5.noOverdue'), change: null, showChange: false, spark: [], color: '#4a78d6', link: '/accounting/parties', warn: over > 0 });
      const overP = d?.overduePayables ?? 0;
      list.push({ id: 'ap', icon: 'truck', label: 'a.accdash.t5.ap', value: an.payables.total, sub: overP > 0 ? t('a.accdash.t5.overdue').replace('{n}', Math.round(overP).toLocaleString('en')) : t('a.accdash.t5.noOverdue'), change: null, showChange: false, spark: [], color: '#c2446b', link: '/accounting/parties', warn: overP > 0 });
      list.push({ id: 'profit', icon: 'bar-chart', label: 'a.accdash.t5.profit', value: an.totalProfit, sub: t('a.accdash.t5.profitSub').replace('{n}', String(an.monthsCount)), change: an.changes.profit.changePct, showChange: true, spark: an.monthly.netProfit, color: '#3f9e6a', link: '/accounting/reports', warn: an.totalProfit < 0 });
    }

    if (ctl) {
      const waiting = ctl.queues.reduce((s, q) => s + q.pending, 0);
      const oldest = Math.max(0, ...ctl.queues.map((q) => q.oldestDays));
      list.push({ id: 'approvals', icon: 'check-circle', label: 'a.accdash.t5.approvals', value: waiting, sub: waiting > 0 ? t('a.accdash.q.oldest').replace('{n}', String(oldest)) : t('a.accdash.q.none'), change: null, showChange: false, spark: [], color: '#e08a2e', link: '/accounting/inbox', warn: oldest >= 3 });
    }

    return list;
  });

  ngOnInit(): void {
    this.ctx.load();
    this.load();
  }

  setMonths(m: number): void {
    this.months.set(m);
    this.load();
  }

  load(): void {
    this.failed.set(false);
    const base = `${environment.apiUrl}/api/admin/accounting/dashboard`;

    this.api.getDashboard().subscribe({ next: (d) => this.dash.set(d), error: () => this.failed.set(true) });
    this.http.get<Analytics>(`${base}/analytics`, { params: { months: this.months() } }).subscribe({ next: (r) => this.a.set(r), error: () => this.failed.set(true) });
    this.http.get<Control>(`${base}/control`, { params: { days: 30 } }).subscribe({ next: (r) => this.c.set(r), error: () => this.failed.set(true) });
  }

  links(): { path: string; key: string; icon: string }[] {
    return [
      { path: '/accounting/inbox', key: 'acc.nav.inbox', icon: 'check-circle', perms: ['accounting', 'accounting.documents', 'accounting.approve', 'accounting.treasury'] },
      { path: '/accounting/sales', key: 'acc.nav.sales', icon: 'file-text', perms: ['accounting', 'accounting.documents', 'accounting.approve'] },
      { path: '/accounting/purchases', key: 'acc.nav.purchases', icon: 'file-text', perms: ['accounting', 'accounting.documents', 'accounting.approve'] },
      { path: '/accounting/treasury', key: 'acc.nav.treasury', icon: 'credit-card', perms: ['accounting', 'accounting.treasury', 'accounting.approve'] },
      { path: '/accounting/parties', key: 'acc.nav.parties', icon: 'users', perms: ['accounting', 'accounting.parties'] },
      { path: '/accounting/settlements-hub', key: 'acc.nav.settlementsHub', icon: 'check-circle', perms: ['accounting', 'accounting.settlements', 'accounting.settlements.approve', 'accounting.treasury', 'accounting.approve'] },
      { path: '/accounting/journal', key: 'acc.nav.journal', icon: 'layers', perms: ['accounting', 'accounting.journal', 'accounting.approve'] },
      { path: '/accounting/reports', key: 'acc.nav.reports', icon: 'bar-chart', perms: ['accounting.reports'] },
    ].filter((l) => this.auth.can(...l.perms));
  }

  // ---------------------------------------------------------------- helpers
  private t(key: string): string { return this.i18n.t(key); }
  sum(v: number[]): number { return v.reduce((x, y) => x + y, 0); }
  pct(v: number | null): string { return v === null ? '' : `${v > 0 ? '+' : ''}${v.toFixed(0)}%`; }
  link(key: string): string { return QUEUE_LINKS[key] ?? '/accounting/inbox'; }
  queueOf(ctl: Control, key: string): Queue { return ctl.queues.find((q) => q.key === key) ?? { key, pending: 0, drafts: 0, oldestDays: 0 }; }
  unsettledAccounts(): number { return this.a()?.unsettled.accounts.length ?? 0; }
  issues(): number { return this.a()?.pending.issues ?? 0; }
  draftEntries(ctl: Control): number { return this.queueOf(ctl, 'journal').drafts; }
  items(list: Amount[]): ChartItem[] { return list.map((x) => ({ label: x.name, value: x.amount })); }
  actionColor(a: string): string { return a === 'reject' || a === 'cancel' ? '#dc2626' : a === 'approve' ? '#3f9e6a' : '#4a78d6'; }

  // Balances of the cash boxes and banks
  private active() { return (this.dash()?.cashAccounts ?? []).filter((x) => x.isActive); }
  balanceTotal(): number { return this.active().reduce((s, x) => s + x.balance, 0); }
  balanceItems(): ChartItem[] {
    const ar = this.i18n.isRtl();
    return this.active().filter((x) => x.balance !== 0).sort((x, y) => y.balance - x.balance).map((x) => ({ label: ar ? (x.nameAr || x.name) : (x.nameEn || x.name), value: Math.max(0, x.balance) }));
  }
  balanceTypeItems(): ChartItem[] {
    const by = new Map<string, number>();
    for (const x of this.active()) by.set(x.type, (by.get(x.type) ?? 0) + Math.max(0, x.balance));
    return [...by.entries()].filter(([, v]) => v > 0).map(([k, v]) => ({ label: this.t('a.dash3.ct.' + k), value: v }));
  }

  // Series
  cashSeries(a: Analytics): ChartSeries[] { return [{ name: this.t('acc.an.s.cashIn'), values: a.monthly.cashIn, color: '#3f9e6a' }, { name: this.t('acc.an.s.cashOut'), values: a.monthly.cashOut, color: '#dc6b3f' }]; }
  revExpSeries(a: Analytics): ChartSeries[] {
    const exp = a.monthly.costOfSales.map((c, i) => c + (a.monthly.expenses[i] ?? 0));
    return [{ name: this.t('acc.an.s.revenue'), values: a.monthly.revenue, color: this.c0 }, { name: this.t('acc.an.s.expenses'), values: exp, color: this.c1 }];
  }
  profitSeries(a: Analytics): ChartSeries[] { return [{ name: this.t('acc.an.s.profit'), values: a.monthly.netProfit, color: '#3f9e6a' }]; }
  marginSeries(a: Analytics): ChartSeries[] { return [{ name: this.t('a.accdash.m.margin') + ' %', values: a.monthly.grossMarginPct, color: '#7c5cc4' }]; }
  cogsSeries(a: Analytics): ChartSeries[] { return [{ name: this.t('a.accdash.c.cogs'), values: a.monthly.costOfSales, color: '#c9a227' }, { name: this.t('acc.an.s.revenue'), values: a.monthly.revenue, color: this.c0 }]; }
  agingLabels(): string[] { return [this.t('acc.an.a.receivables'), this.t('acc.an.a.payables')]; }
  agingSeries(a: Analytics): ChartSeries[] {
    const r = a.receivables;
    const p = a.payables;
    return [
      { name: this.t('acc.an.a.current'), values: [r.current, p.current], color: '#3f9e6a' },
      { name: this.t('acc.an.a.d30'), values: [r.days1To30, p.days1To30], color: '#c9a227' },
      { name: this.t('acc.an.a.d60'), values: [r.days31To60, p.days31To60], color: '#e08a2e' },
      { name: this.t('acc.an.a.d90'), values: [r.days61To90, p.days61To90], color: '#dc2626' },
      { name: this.t('acc.an.a.over'), values: [r.over90, p.over90], color: '#8f1d3f' },
    ];
  }

  // The team
  teamLabels(ctl: Control): string[] { return ctl.team.map((m) => m.name); }
  teamSeries(ctl: Control): ChartSeries[] {
    return [
      { name: this.t('a.accdash.t.created'), values: ctl.team.map((m) => m.created), color: this.c0 },
      { name: this.t('a.accdash.t.approved'), values: ctl.team.map((m) => m.approved), color: '#3f9e6a' },
      { name: this.t('a.accdash.t.rejected'), values: ctl.team.map((m) => m.rejected), color: '#dc2626' },
    ];
  }

  // This month against the last one, and the last three months against the three before (the current month is still running)
  compare(a: Analytics): { title: string; rows: CompareRow[] }[] {
    const m = a.monthly;
    const n = m.months.length;
    const n2 = (v: number) => Math.round(v).toLocaleString('en');
    const groups: { title: string; rows: CompareRow[] }[] = [];

    const rows = (cur: (v: number[]) => number, prev: (v: number[]) => number): CompareRow[] => {
      const line = (label: string, v: number[], goodWhenUp: boolean): CompareRow => {
        const c = cur(v);
        const p = prev(v);
        const change = p === 0 ? null : ((c - p) / Math.abs(p)) * 100;

        return { label, cur: n2(c), prev: n2(p), change, good: change === null ? true : goodWhenUp ? change >= 0 : change <= 0 };
      };
      const cogs = (v: number[]) => v;

      return [
        line('a.accdash.m.revenue', m.revenue, true),
        line('a.accdash.c.cogs', cogs(m.costOfSales), false),
        line('a.accdash.m.expenses', m.expenses, false),
        line('a.accdash.m.profit', m.netProfit, true),
      ];
    };

    if (n >= 2) {
      groups.push({ title: 'a.accdash.cmp.month', rows: rows((v) => v[n - 1] ?? 0, (v) => v[n - 2] ?? 0) });
    }

    if (n >= 6) {
      groups.push({ title: 'a.accdash.cmp.quarter', rows: rows((v) => this.sum(v.slice(n - 3)), (v) => this.sum(v.slice(n - 6, n - 3))) });
    }

    return groups;
  }
}
