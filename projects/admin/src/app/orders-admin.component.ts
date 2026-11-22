import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { I18nService } from '@shared/core/i18n.service';
import { Order } from '@shared/core/models';
import { OrdersApiService } from '@shared/core/orders-api.service';
import { TranslatePipe } from '@shared/core/pipes';
import { stageClass, stageKey } from './order-ops/order-stage';
import './order-ops/fulfilment.i18n';
import './order-ops/orders.i18n';

type KpiKey = 'today' | 'review' | 'preparing' | 'shipping' | 'delivered' | 'closed';

const PAGE_SIZE = 20;

const utc = (s: string): number => Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z');

// The orders of the shop, as a list: numbers on top (each one filters), filters, one row per order.
// "View" opens the page of the order (order-detail), where everything is done.
@Component({
  selector: 'app-orders-admin',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './orders-admin.component.html',
  styleUrl: './orders-admin.component.css',
})
export class OrdersAdminComponent implements OnInit {
  private readonly api = inject(OrdersApiService);
  private readonly i18n = inject(I18nService);
  private readonly router = inject(Router);

  readonly orders = signal<Order[]>([]);
  readonly search = signal('');
  readonly stage = signal('');
  readonly method = signal('');
  readonly city = signal('');
  readonly range = signal<'today' | '7' | '30' | 'all'>('30');
  readonly kpi = signal<KpiKey | ''>('');
  readonly page = signal(1);

  ngOnInit(): void {
    this.api.getAll().subscribe((o) => this.orders.set([...o].sort((a, b) => utc(b.createdAtUtc) - utc(a.createdAtUtc))));
  }

  stageOf(o: Order): string { return stageKey(o.status, o.fulfilmentStatus); }
  stageCls(o: Order): string { return stageClass(o.status, o.fulfilmentStatus); }

  payCls(o: Order): string {
    return o.paymentStatus === 'Paid' ? 'c-ready' : o.paymentStatus === 'Unpaid' ? 'c-new' : o.paymentStatus === 'Failed' ? 'fs-Problem' : 'c-gray';
  }

  // Money held by the shipping company / the gateway that did not reach us yet, or that did
  settleText(o: Order): string | null {
    if (o.settlementStatus === 'Pending') return 'ord2.settle.Pending';
    if (o.settlementStatus === 'Settled') return 'ord2.settle.Settled';
    return null;
  }

  private inKpi(o: Order, k: KpiKey): boolean {
    switch (k) {
      case 'today': return new Date(utc(o.createdAtUtc)).toDateString() === new Date().toDateString();
      case 'review': return o.status === 'Pending' || o.fulfilmentStatus === 'Problem';
      case 'preparing': return (o.status === 'Confirmed' || o.status === 'Processing') && o.fulfilmentStatus !== 'ReadyToShip';
      case 'shipping': return o.status === 'Shipped';
      case 'delivered': return o.status === 'Delivered';
      case 'closed': return o.status === 'Cancelled' || o.paymentStatus === 'Refunded';
    }
  }

  readonly kpis = computed(() => {
    const all = this.orders();
    const defs: { key: KpiKey; label: string }[] = [
      { key: 'today', label: 'ord2.kpi.today' },
      { key: 'review', label: 'ord2.kpi.review' },
      { key: 'preparing', label: 'ord2.kpi.preparing' },
      { key: 'shipping', label: 'ord2.kpi.shipping' },
      { key: 'delivered', label: 'ord2.kpi.delivered' },
      { key: 'closed', label: 'ord2.kpi.closed' },
    ];
    return defs.map((d) => ({ ...d, value: all.filter((o) => this.inKpi(o, d.key)).length }));
  });

  readonly stageOptions = computed(() => [...new Set(this.orders().map((o) => this.stageOf(o)))]);
  readonly methodOptions = computed(() => [...new Set(this.orders().map((o) => o.paymentMethod))]);
  readonly cityOptions = computed(() => [...new Set(this.orders().map((o) => o.city).filter(Boolean))].sort());

  readonly filtered = computed(() => {
    const q = this.search().trim().toLowerCase();
    const days = this.range();
    const since = days === 'all' ? 0 : days === 'today' ? new Date().setHours(0, 0, 0, 0) : Date.now() - Number(days) * 86400000;
    const k = this.kpi();

    return this.orders().filter((o) =>
      (!k || this.inKpi(o, k)) &&
      (!this.stage() || this.stageOf(o) === this.stage()) &&
      (!this.method() || o.paymentMethod === this.method()) &&
      (!this.city() || o.city === this.city()) &&
      utc(o.createdAtUtc) >= since &&
      (!q || `${o.number} ${o.customerName} ${o.phone} ${o.email}`.toLowerCase().includes(q)));
  });

  readonly pages = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));
  readonly pageRows = computed(() => this.filtered().slice((Math.min(this.page(), this.pages()) - 1) * PAGE_SIZE, Math.min(this.page(), this.pages()) * PAGE_SIZE));
  readonly from = computed(() => (this.filtered().length === 0 ? 0 : (Math.min(this.page(), this.pages()) - 1) * PAGE_SIZE + 1));
  readonly to = computed(() => Math.min(this.filtered().length, Math.min(this.page(), this.pages()) * PAGE_SIZE));

  // At most 5 page buttons around the current page
  readonly pageNumbers = computed(() => {
    const total = this.pages();
    const start = Math.max(1, Math.min(this.page() - 2, total - 4));
    return Array.from({ length: Math.min(5, total) }, (_, i) => start + i);
  });

  toggleKpi(k: KpiKey): void {
    this.kpi.set(this.kpi() === k ? '' : k);
    // The number counts every order: the date filter must not hide the ones it counted
    if (this.kpi()) this.range.set('all');
    this.page.set(1);
  }

  open(o: Order): void {
    void this.router.navigate(['/orders', o.id]);
  }

  // The orders on the screen (after the filters) as a CSV file that opens in Excel
  exportCsv(): void {
    const head = ['#', this.i18n.t('inv.date'), this.i18n.t('ord.customerCol'), this.i18n.t('ord2.col.phone'), this.i18n.t('ord2.col.city'), this.i18n.t('inv.total'), this.i18n.t('ord.paymentCol'), this.i18n.t('inv.status')];
    const cell = (v: string | number): string => `"${String(v).replace(/"/g, '""')}"`;
    const rows = this.filtered().map((o) => [
      o.number, o.createdAtUtc.slice(0, 16).replace('T', ' '), o.customerName, o.phone, o.city, o.total,
      `${this.i18n.t('pay.' + o.paymentMethod)} · ${this.i18n.t('ord.pay.' + o.paymentStatus)}`, this.i18n.t(this.stageOf(o)),
    ]);
    const csv = '﻿' + [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
}
