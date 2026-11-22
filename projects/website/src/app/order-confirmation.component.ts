import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuctionOrderForm, Order } from '@shared/core/models';
import { OrdersApiService } from '@shared/core/orders-api.service';
import { TranslatePipe } from '@shared/core/pipes';
import { CartService } from './cart.service';
import { MoneyPipe } from './money.pipe';
import './payment.i18n';

// "Thank you": the order summary. A guest reaches it with the token in the link (kept in the e-mail / the browser history).
@Component({
  selector: 'app-order-confirmation',
  standalone: true,
  imports: [RouterLink, TranslatePipe, MoneyPipe],
  templateUrl: './order-confirmation.component.html',
})
export class OrderConfirmationComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(OrdersApiService);
  private readonly cart = inject(CartService);

  readonly order = signal<Order | null>(null);
  readonly failed = signal(false);
  readonly paying = signal(false);
  // Stripe sends the customer back with ?paid=1 or ?cancelled=1
  readonly paidBack = signal(false);
  readonly cancelledBack = signal(false);

  // ----- the winner of an auction finishes his ready order
  readonly form = signal({ fullName: '', phone: '', country: '', city: '', region: '', line1: '' });
  readonly method = signal<'CashOnDelivery' | 'Card'>('CashOnDelivery');
  readonly saving = signal(false);
  readonly formError = signal(false);
  readonly methods = computed(() => this.cart.paymentMethods().filter((m) => m.enabled && (m.code === 'CashOnDelivery' || m.code === 'Card')).map((m) => m.code as 'CashOnDelivery' | 'Card'));

  ngOnInit(): void {
    const number = this.route.snapshot.paramMap.get('number') ?? '';
    const token = this.route.snapshot.queryParamMap.get('token');

    this.paidBack.set(this.route.snapshot.queryParamMap.get('paid') === '1');
    this.cancelledBack.set(this.route.snapshot.queryParamMap.get('cancelled') === '1');

    this.api.get(number, token).subscribe({
      next: (o) => {
        this.order.set(o);
        this.fill(o);

        // The payment is confirmed by Stripe's message to the server, which can come a moment after the customer returns
        if (this.paidBack() && o.paymentStatus !== 'Paid') this.refresh(number, token, 0);
      },
      error: () => this.failed.set(true),
    });
  }

  // An order waiting for its winner: still unpaid, with a deadline
  awaiting(o: Order): boolean { return !!o.auctionId && !!o.payByUtc && o.status === 'Pending' && o.paymentStatus !== 'Paid'; }

  set(key: 'fullName' | 'phone' | 'country' | 'city' | 'region' | 'line1', value: string): void {
    this.form.update((f) => ({ ...f, [key]: value }));
  }

  confirm(o: Order): void {
    const f = this.form();
    if (!f.fullName.trim() || !f.phone.trim() || !f.country.trim() || !f.city.trim() || !f.line1.trim()) { this.formError.set(true); return; }

    this.formError.set(false);
    this.saving.set(true);

    const body: AuctionOrderForm = { paymentMethod: this.method(), fullName: f.fullName, phone: f.phone, country: f.country, city: f.city, region: f.region || null, line1: f.line1 };
    const token = this.route.snapshot.queryParamMap.get('token');

    this.api.completeAuction(o.number, token, body).subscribe({
      next: () => {
        if (this.method() === 'Card') {
          this.api.createStripeSession(o.number, token ?? '').subscribe({
            next: (s) => { window.location.href = s.url; },
            error: () => this.saving.set(false),
          });
          return;
        }

        this.saving.set(false);
        this.api.get(o.number, token).subscribe((fresh) => this.order.set(fresh));
      },
      error: () => this.saving.set(false),
    });
  }

  private fill(o: Order): void {
    this.form.set({ fullName: o.customerName, phone: o.phone, country: o.country, city: o.city, region: o.region ?? '', line1: o.line1 });
    const first = this.methods()[0];
    if (first) this.method.set(first);
  }

  payAgain(o: Order): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    if (!token) return;

    this.paying.set(true);
    this.api.createStripeSession(o.number, token).subscribe({
      next: (s) => { window.location.href = s.url; },
      error: () => this.paying.set(false),
    });
  }

  private refresh(number: string, token: string | null, attempt: number): void {
    if (attempt >= 6) return;

    setTimeout(() => {
      this.api.get(number, token).subscribe({
        next: (o) => {
          this.order.set(o);
          if (o.paymentStatus !== 'Paid') this.refresh(number, token, attempt + 1);
        },
        error: () => undefined,
      });
    }, 3000);
  }
}
