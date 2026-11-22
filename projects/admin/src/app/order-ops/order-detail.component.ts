import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Observable, concat, last } from 'rxjs';
import { I18nService } from '@shared/core/i18n.service';
import { InventoryApiService } from '@shared/core/inventory-api.service';
import { Order, Warehouse } from '@shared/core/models';
import { OrdersApiService } from '@shared/core/orders-api.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { OrderEvent, OrderOpsApi, OrderTimeline } from './order-ops.api';
import { formatStamp, translateEvent, visibleEvents } from './order-events';
import { stageClass, stageKey } from './order-stage';
import './fulfilment.i18n';
import './orders.i18n';

type Action = 'confirm' | 'fulfilment' | 'ship' | 'deliver' | null;

const STEPS = ['new', 'confirmed', 'preparing', 'ready', 'shipped', 'delivered'];

// One order: where it stands, what to do next, the lines, the money (read only), shipping, returns (after shipping), the timeline.
// Everything the order needs is done here; the lists only open it.
@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.css',
})
export class OrderDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(OrdersApiService);
  private readonly ops = inject(OrderOpsApi);
  private readonly inventory = inject(InventoryApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly order = signal<Order | null>(null);
  readonly timeline = signal<OrderTimeline | null>(null);
  readonly carriers = signal<{ id: number; name: string }[]>([]);
  readonly warehouses = signal<Warehouse[]>([]);
  readonly failed = signal(false);
  readonly saving = signal(false);

  // Shipping
  carrierId: number | null = null;
  tracking = '';
  deliveryDays: number | null = 3;
  sendEmail = true;
  // Return being asked for
  returnQty: Record<number, number> = {};
  returnReason = '';
  returnNote = '';
  // The gateway payout, the internal note
  payoutRef = '';
  refundAmount: number | null = null;
  refundReason = '';
  noteText = '';

  private readonly orderId = signal(0);

  ngOnInit(): void {
    this.ops.getCarriers().subscribe({ next: (c) => this.carriers.set(c), error: () => undefined });
    this.inventory.getWarehouses().subscribe({ next: (w) => this.warehouses.set(w), error: () => undefined });

    this.route.paramMap.subscribe((p) => {
      this.orderId.set(Number(p.get('id')) || 0);
      this.order.set(null);
      this.failed.set(false);
      this.load();
    });
  }

  load(): void {
    const id = this.orderId();
    if (!id) { this.failed.set(true); return; }

    this.api.getOne(id).subscribe({
      next: (o) => {
        this.order.set(o);
        this.carrierId = o.shippingCarrierId ?? this.carrierId;
        this.tracking = o.trackingNumber ?? '';
        this.deliveryDays = o.estimatedDeliveryDays ?? this.deliveryDays ?? 3;
        this.returnQty = {};
        this.loadTimeline();
      },
      error: () => this.failed.set(true),
    });
  }

  private loadTimeline(): void {
    this.ops.getTimeline(this.orderId()).subscribe({ next: (t) => this.timeline.set(t), error: () => this.timeline.set(null) });
  }

  // ------------------------------------------------------------------ what the page shows

  stageOf(o: Order): string { return stageKey(o.status, o.fulfilmentStatus); }
  stageCls(o: Order): string { return stageClass(o.status, o.fulfilmentStatus); }

  payCls(o: Order): string {
    return o.paymentStatus === 'Paid' ? 'c-ready' : o.paymentStatus === 'Unpaid' ? 'c-new' : o.paymentStatus === 'Failed' ? 'fs-Problem' : 'c-gray';
  }

  itemCls(status: string): string { return 'is-' + status; }

  due(o: Order): number {
    return Math.max(0, Math.round((o.total - (o.paidAmount ?? 0) + (o.refundedAmount ?? 0)) * 100) / 100);
  }

  warehouseName(id: number | null | undefined): string {
    return id ? (this.warehouses().find((w) => w.id === id)?.name ?? '') : this.i18n.t('ord2.notAllocated');
  }

  private ready(o: Order): boolean {
    return ['ReadyToShip', 'NotRequired'].includes(o.fulfilmentStatus ?? 'NotRequired');
  }

  // The six steps: done / now / later
  steps(o: Order): { key: string; mark: string; state: string; last: boolean }[] {
    let now: number;

    switch (o.status) {
      case 'Pending': now = 0; break;
      case 'Shipped': now = 4; break;
      case 'Delivered': now = STEPS.length; break;
      case 'Cancelled': now = -1; break;
      default:
        now = this.ready(o) ? 3 : ['InProgress', 'Partial', 'Allocated'].includes(o.fulfilmentStatus ?? '') || o.status === 'Processing' ? 2 : 1;
    }

    return STEPS.map((key, i) => {
      const state = i < now ? 'done' : i === now ? 'now' : 'later';
      return { key, mark: state === 'done' ? '✓' : String(i + 1), state, last: i === STEPS.length - 1 };
    });
  }

  // The one thing to do next
  action(o: Order): Action {
    if (o.status === 'Pending') return 'confirm';
    if (o.status === 'Shipped') return 'deliver';
    if (o.status === 'Confirmed' || o.status === 'Processing') return this.ready(o) ? 'ship' : 'fulfilment';
    return null;
  }

  canCancel(o: Order): boolean {
    return ['Pending', 'Confirmed', 'Processing'].includes(o.status);
  }

  // Only goods that left a warehouse can come back
  returnable(o: Order): Order['items'] {
    return o.items.filter((i) => i.fulfilmentStatus === 'Fulfilled' && i.id !== undefined);
  }

  events(): OrderEvent[] { return visibleEvents(this.timeline()?.events); }

  say(message: string): string { return translateEvent(message, this.i18n.lang()); }

  stamp(iso: string): string { return formatStamp(iso); }

  // ------------------------------------------------------------------ actions

  private run(call: Observable<unknown>, done: string): void {
    this.saving.set(true);
    call.subscribe({
      next: () => { this.saving.set(false); this.toast.success(this.i18n.t(done)); this.load(); },
      error: () => this.saving.set(false),
    });
  }

  confirmOrder(o: Order): void {
    this.run(this.api.update(o.id, { status: 'Confirmed', paymentStatus: null, sendEmail: true }), 'inv.saved');
  }

  deliver(o: Order): void {
    if (!confirm(this.i18n.t('ord2.deliverConfirm', { email: o.email }))) return;

    this.run(this.api.update(o.id, { status: 'Delivered', paymentStatus: null, sendEmail: true }), 'inv.saved');
  }

  cancelOrder(o: Order): void {
    if (!confirm(this.i18n.t('ord2.cancelConfirm'))) return;

    this.run(this.api.update(o.id, { status: 'Cancelled', paymentStatus: null, sendEmail: true }), 'inv.saved');
  }

  // The order goes to the shipping company. A status moves one step at a time, so a "Pending" / "Confirmed" order passes "Being prepared" first (no e-mail for that step)
  ship(o: Order): void {
    if (!this.carrierId) {
      this.toast.error(this.i18n.t('ord2.chooseCarrierFirst'));
      return;
    }

    if (!confirm(this.i18n.t('ord2.shipConfirm', { email: o.email }))) return;

    const steps: Observable<unknown>[] = [];

    if (o.status !== 'Processing') steps.push(this.api.update(o.id, { status: 'Processing', paymentStatus: null, sendEmail: false }));

    steps.push(this.api.update(o.id, {
      status: 'Shipped',
      paymentStatus: null,
      deliveryDays: this.deliveryDays ? Number(this.deliveryDays) : null,
      sendEmail: this.sendEmail,
      carrierId: this.carrierId,
      trackingNumber: this.tracking.trim() || null,
    }));

    this.run(concat(...steps).pipe(last()), 'ord2.shipDone');
  }

  saveTracking(o: Order): void {
    this.run(this.api.update(o.id, { status: null, paymentStatus: null, sendEmail: false, carrierId: o.shippingCarrierId ?? null, trackingNumber: this.tracking.trim() || null }), 'inv.saved');
  }

  markPayout(o: Order): void {
    if (!confirm(this.i18n.t('ord2.payoutConfirm'))) return;

    this.run(this.api.markPayout([o.id], this.payoutRef.trim() || null), 'ord2.payoutDone');
  }

  refundable(o: Order): number {
    return Math.max(0, Math.round(((o.paidAmount ?? 0) - (o.refundedAmount ?? 0)) * 100) / 100);
  }

  refundToCard(o: Order): void {
    const amount = this.refundAmount !== null && Number(this.refundAmount) > 0 ? Number(this.refundAmount) : null;

    if (amount !== null && amount > this.refundable(o)) {
      this.toast.error(this.i18n.t('ord2.refundTooMuch'));
      return;
    }

    if (!confirm(this.i18n.t('ord2.refundConfirm'))) return;

    this.saving.set(true);
    this.ops.refundToCard(o.id, { amount, reason: this.refundReason.trim() || null }).subscribe({
      next: () => { this.saving.set(false); this.refundAmount = null; this.refundReason = ''; this.toast.success(this.i18n.t('ord2.refundDone')); this.load(); },
      error: () => this.saving.set(false),
    });
  }

  requestReturn(o: Order): void {
    const lines = this.returnable(o)
      .map((i) => ({ orderItemId: i.id!, quantity: Number(this.returnQty[i.id!]) || 0 }))
      .filter((l) => l.quantity > 0);

    if (lines.length === 0) {
      this.toast.error(this.i18n.t('ord2.retPick'));
      return;
    }

    if (!confirm(this.i18n.t('ord2.retConfirm'))) return;

    this.run(this.ops.requestReturn(o.id, { lines, reason: this.returnReason.trim() || null, note: this.returnNote.trim() || null }), 'ord2.retDone');
    this.returnReason = '';
    this.returnNote = '';
  }

  addNote(o: Order): void {
    const text = this.noteText.trim();
    if (!text) return;

    this.saving.set(true);
    this.api.addNote(o.id, text).subscribe({
      next: () => { this.saving.set(false); this.noteText = ''; this.toast.success(this.i18n.t('inv.saved')); this.loadTimeline(); },
      error: () => this.saving.set(false),
    });
  }
}
