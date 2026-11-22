import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { environment } from '@shared/environments/environment';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import { BarChartComponent, ChartItem, ChartSeries, DonutChartComponent, HBarChartComponent, LineChartComponent, PALETTE, SparklineComponent } from './charts/charts';
import './analytics.i18n';

interface Change { current: number; previous: number; changePct: number | null }
interface Aging { current: number; days1To30: number; days31To60: number; days61To90: number; over90: number; total: number; unappliedCredits: number }
interface Amount { id: number | null; key: string; name: string; amount: number }
interface Analytics {
  asOf: string; monthsCount: number;
  monthly: { months: string[]; revenue: number[]; costOfSales: number[]; expenses: number[]; netProfit: number[]; grossMarginPct: number[]; cashIn: number[]; cashOut: number[] };
  totalRevenue: number; totalExpenses: number; totalProfit: number; grossMarginPct: number; cashNow: number;
  receivables: Aging; payables: Aging; topCustomers: Amount[]; topSuppliers: Amount[]; expensesByAccount: Amount[]; salesByPaymentMethod: Amount[];
  unsettled: { custody: number; gateway: number; accounts: Amount[] }; vat: { output: number; input: number; payable: number };
  dailySales: { date: string; amount: number }[];
  pending: { documents: number; vouchers: number; journal: number; transfers: number; settlements: number; carrierSettlements: number; issues: number; gatewaySettlements: number };
  changes: { revenue: Change; expenses: Change; profit: Change };
}

// The charts of the head of accounts: what happened, where the money is, who owes whom, and what waits for approval
@Component({
  selector: 'app-accounting-analytics',
  standalone: true,
  imports: [DecimalPipe, RouterLink, TranslatePipe, LineChartComponent, BarChartComponent, DonutChartComponent, HBarChartComponent, SparklineComponent],
  templateUrl: './accounting-analytics.component.html',
  styleUrl: './accounting-analytics.component.css',
})
export class AccountingAnalyticsComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(I18nService);

  readonly c0 = PALETTE[0];
  readonly c1 = PALETTE[1];
  readonly c3 = PALETTE[3];
  readonly monthOptions = [3, 6, 12];
  readonly months = signal(12);
  readonly d = signal<Analytics | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);

  ngOnInit(): void {
    this.load();
  }

  setMonths(m: number): void {
    this.months.set(m);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.failed.set(false);
    this.http.get<Analytics>(`${environment.apiUrl}/api/admin/accounting/dashboard/analytics`, { params: { months: this.months() } }).subscribe({
      next: (a) => { this.d.set(a); this.loading.set(false); },
      error: () => { this.loading.set(false); this.failed.set(true); },
    });
  }

  private t(key: string): string { return this.i18n.t(key); }

  pct(v: number | null): string { return v === null ? '' : `${v > 0 ? '+' : ''}${v.toFixed(0)}%`; }
  isGood(v: number | null, higherIsBetter: boolean): boolean { return v !== null && (higherIsBetter ? v > 0 : v < 0); }
  isBad(v: number | null, higherIsBetter: boolean): boolean { return v !== null && (higherIsBetter ? v < 0 : v > 0); }

  profitSeries(a: Analytics): ChartSeries[] { return [{ name: this.t('acc.an.s.profit'), values: a.monthly.netProfit, color: PALETTE[3] }]; }
  revExpSeries(a: Analytics): ChartSeries[] {
    const exp = a.monthly.costOfSales.map((c, i) => c + (a.monthly.expenses[i] ?? 0));
    return [{ name: this.t('acc.an.s.revenue'), values: a.monthly.revenue, color: PALETTE[0] }, { name: this.t('acc.an.s.expenses'), values: exp, color: PALETTE[1] }];
  }
  cashSeries(a: Analytics): ChartSeries[] {
    return [{ name: this.t('acc.an.s.cashIn'), values: a.monthly.cashIn, color: PALETTE[3] }, { name: this.t('acc.an.s.cashOut'), values: a.monthly.cashOut, color: PALETTE[4] }];
  }
  dayLabels(a: Analytics): string[] { return a.dailySales.map((x) => x.date.substring(8, 10)); }
  dailySeries(a: Analytics): ChartSeries[] { return [{ name: this.t('acc.an.s.sales'), values: a.dailySales.map((x) => x.amount), color: PALETTE[0] }]; }
  agingLabels(): string[] { return [this.t('acc.an.a.receivables'), this.t('acc.an.a.payables')]; }
  agingSeries(a: Analytics): ChartSeries[] {
    const r = a.receivables;
    const p = a.payables;
    return [
      { name: this.t('acc.an.a.current'), values: [r.current, p.current], color: PALETTE[3] },
      { name: this.t('acc.an.a.d30'), values: [r.days1To30, p.days1To30], color: PALETTE[6] },
      { name: this.t('acc.an.a.d60'), values: [r.days31To60, p.days31To60], color: PALETTE[1] },
      { name: this.t('acc.an.a.d90'), values: [r.days61To90, p.days61To90], color: PALETTE[4] },
      { name: this.t('acc.an.a.over'), values: [r.over90, p.over90], color: '#8f1d3f' },
    ];
  }
  items(list: Amount[]): ChartItem[] { return list.map((x) => ({ label: x.name, value: x.amount })); }
  methodItems(a: Analytics): ChartItem[] {
    return a.salesByPaymentMethod.map((x) => {
      const key = `acc.an.method.${x.key}`;
      const label = this.t(key);
      return { label: label === key ? x.key : label, value: x.amount };
    });
  }
  pendingTotal(a: Analytics): number {
    const p = a.pending;
    return p.documents + p.vouchers + p.journal + p.transfers + p.settlements + p.carrierSettlements + p.gatewaySettlements + p.issues;
  }
}
