import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs';
import { I18nService } from '@shared/core/i18n.service';
import { Order } from '@shared/core/models';
import { OrdersApiService } from '@shared/core/orders-api.service';
import { TranslatePipe } from '@shared/core/pipes';
import { SiteService } from '@shared/core/site.service';
import { CustomerReturn, OrderOpsApi } from './order-ops.api';
import { formatStamp } from './order-events';
import './orders.i18n';

interface ReturnedLine { number: string; date: string; name: string; qty: number; value: number; }

// A plain invoice of one order: what the customer was charged, and under it what came back (customer returns that reached the stock).
// It opens outside the dashboard frame, so what is printed is only the invoice.
@Component({
  selector: 'app-order-invoice',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './order-invoice.component.html',
  styleUrl: './order-invoice.component.css',
})
export class OrderInvoiceComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(OrdersApiService);
  private readonly ops = inject(OrderOpsApi);
  private readonly site = inject(SiteService);
  readonly i18n = inject(I18nService);

  readonly order = signal<Order | null>(null);
  readonly returned = signal<ReturnedLine[]>([]);
  readonly orderId = signal(0);

  readonly company = computed(() => this.site.home()?.company.companyName || 'Voltara');
  readonly contact = computed(() => {
    const c = this.site.home()?.company;

    return c ? [c.address, c.phone, c.contactEmail].filter((x) => !!x).join(' · ') : '';
  });

  // What came back, taken off the total (the customer return of the lines that reached the stock)
  readonly net = computed(() => {
    const o = this.order();

    return o ? Math.round((o.total - this.returned().reduce((n, r) => n + r.value, 0)) * 100) / 100 : 0;
  });

  ngOnInit(): void {
    this.route.paramMap.subscribe((p) => {
      this.orderId.set(Number(p.get('id')) || 0);
      this.load();
    });
  }

  private load(): void {
    const id = this.orderId();

    if (!id) return;

    this.api.getOne(id).subscribe((o) => {
      this.order.set(o);
      this.ops.getTimeline(id).pipe(catchError(() => of(null))).subscribe((t) => {
        const list = t?.returns ?? [];

        if (list.length === 0) { this.returned.set([]); return; }

        forkJoin(list.map((r) => this.ops.getReturn(r.id).pipe(catchError(() => of(null))))).subscribe((all) => {
          const rows: ReturnedLine[] = [];

          for (const r of all) {
            if (r) rows.push(...this.valued(o, r));
          }

          this.returned.set(rows);
        });
      });
    });
  }

  private valued(o: Order, r: CustomerReturn): ReturnedLine[] {
    return r.lines
      .filter((l) => l.applied)
      .map((l) => {
        const item = o.items.find((i) => i.id === l.orderItemId);

        return {
          number: r.number,
          date: this.date(r.completedAtUtc ?? r.approvedAtUtc ?? r.createdAtUtc),
          name: item?.productName ?? l.productName,
          qty: l.quantity,
          value: Math.round((item?.unitPrice ?? 0) * l.quantity * 100) / 100,
        };
      });
  }

  date(iso: string | null): string { return formatStamp(iso).slice(0, 10); }

  money(n: number): string { return (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  address(o: Order): string {
    return [o.line1, o.line2, o.city, o.region, o.country].filter((x) => !!x).join('، ');
  }

  print(): void { window.print(); }
}
