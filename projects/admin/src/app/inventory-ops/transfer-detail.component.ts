import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { catchError } from 'rxjs';
import { I18nService } from '@shared/core/i18n.service';
import { InventoryApiService } from '@shared/core/inventory-api.service';
import { VariantPick } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { printArea } from '@shared/core/print';
import { ToastService } from '@shared/core/toast.service';
import { InventoryOpsApi, Transfer, TransferLine, TransferWarehouse } from './ops.api';
import './ops.i18n';

interface EditLine { variantId: number; name: string; sku: string; quantity: string; note: string; }

// One transfer: written here (new / draft), decided by the giving warehouse (approve with quantities, or reject), sent,
// and received. What the user sees and may press depends on the state of the transfer and on his warehouse.
@Component({
  selector: 'app-transfer-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './transfer-detail.component.html',
  styleUrl: './transfer-detail.component.css',
})
export class TransferDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(InventoryOpsApi);
  private readonly inventory = inject(InventoryApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly t = signal<Transfer | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly warehouses = signal<TransferWarehouse[]>([]);

  // the form
  readonly fromId = signal(0);
  readonly toId = signal(0);
  readonly note = signal('');
  readonly direct = signal(false);
  readonly lines = signal<EditLine[]>([]);

  // choosing items
  readonly typing = new Subject<string>();
  readonly results = signal<VariantPick[]>([]);

  // deciding / sending / receiving
  readonly approvedQty = signal<Record<number, string>>({});
  readonly receivedQty = signal<Record<number, string>>({});
  readonly rejectOpen = signal(false);
  readonly rejectReason = signal('');
  readonly shipping = signal('');
  readonly receiveNote = signal('');

  private id: number | null = null;

  // a new transfer, or a draft that its writer may still change
  readonly editing = computed(() => this.id === null || (this.t()?.can.edit ?? false));

  // The warehouse that gives is any warehouse; the one that asks is one of mine. For a direct transfer it is the other way round.
  readonly fromOptions = computed(() => this.warehouses().filter((w) => (this.direct() ? w.isMine : true) && w.id !== this.toId()));
  readonly toOptions = computed(() => this.warehouses().filter((w) => (this.direct() ? true : w.isMine) && w.id !== this.fromId()));

  ngOnInit(): void {
    const param = this.route.snapshot.paramMap.get('id');
    this.id = param && param !== 'new' ? Number(param) : null;

    this.api.getTransferWarehouses().subscribe((list) => {
      this.warehouses.set(list);

      // A branch usually has one warehouse: it is the one that asks
      const mine = list.filter((w) => w.isMine);
      if (this.id === null && mine.length === 1) this.toId.set(mine[0].id);
    });

    this.typing
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => this.inventory.searchVariants(q.trim()).pipe(catchError(() => of([])))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((list) => this.results.set(list));

    if (this.id === null) {
      this.loading.set(false);
      return;
    }

    this.reload();
  }

  private reload(): void {
    if (this.id === null) return;

    this.api.getTransfer(this.id).subscribe({
      next: (tr) => {
        this.t.set(tr);
        this.loading.set(false);
        this.saving.set(false);
        this.rejectOpen.set(false);

        this.fromId.set(tr.fromWarehouseId);
        this.toId.set(tr.toWarehouseId);
        this.note.set(tr.note ?? '');
        this.direct.set(tr.isDirect);

        this.lines.set(tr.lines.map((l) => ({ variantId: l.variantId, name: `${l.item} ${l.label}`.trim(), sku: l.sku, quantity: String(l.requested), note: l.note ?? '' })));

        // What the giving warehouse is going to agree to by default: as much as was asked, as far as it has it
        this.approvedQty.set(Object.fromEntries(tr.lines.map((l) => [l.id, String(Math.max(0, Math.min(l.requested, l.availableAtSource)))])));
        // What the receiving warehouse is going to confirm by default: everything that was sent
        this.receivedQty.set(Object.fromEntries(tr.lines.map((l) => [l.id, String(l.dispatched)])));
      },
      error: () => {
        this.loading.set(false);
        void this.router.navigate(['/inventory/transfers']);
      },
    });
  }

  // ---------------------------------------------------------------- writing the request

  setDirect(on: boolean): void {
    this.direct.set(on);

    // The warehouse that gives must be one of mine in a direct transfer, the warehouse that asks in a normal one
    const mine = new Set(this.warehouses().filter((w) => w.isMine).map((w) => w.id));

    if (on && !mine.has(this.fromId())) this.fromId.set(0);
    if (!on && !mine.has(this.toId())) this.toId.set(0);
  }

  // The scanner types the code and presses Enter: an exact code adds the item at once
  enter(text: string, input: HTMLInputElement): void {
    const q = text.trim();
    if (!q) return;

    this.inventory.searchVariants(q).pipe(catchError(() => of([] as VariantPick[]))).subscribe((list) => {
      const exact = list.find((v) => v.barcode === q || v.sku === q) ?? (list.length === 1 ? list[0] : undefined);

      if (exact) this.addVariant(exact, input);
      else this.results.set(list);
    });
  }

  addVariant(v: VariantPick, input: HTMLInputElement): void {
    const list = [...this.lines()];
    const at = list.findIndex((l) => l.variantId === v.id);

    if (at >= 0) list[at] = { ...list[at], quantity: String((Number(list[at].quantity) || 0) + 1) };
    else list.push({ variantId: v.id, name: `${v.productName} ${v.label}`.trim(), sku: v.sku, quantity: '1', note: '' });

    this.lines.set(list);
    this.results.set([]);
    input.value = '';
    input.focus();
  }

  setQty(i: number, value: string): void {
    this.lines.update((l) => l.map((x, n) => (n === i ? { ...x, quantity: value } : x)));
  }

  setLineNote(i: number, value: string): void {
    this.lines.update((l) => l.map((x, n) => (n === i ? { ...x, note: value } : x)));
  }

  removeLine(i: number): void {
    this.lines.update((l) => l.filter((_, n) => n !== i));
  }

  save(send: boolean): void {
    if (!this.fromId() || !this.toId()) {
      this.toast.error(this.i18n.t('tr.pickTwo'));
      return;
    }

    const lines = this.lines()
      .map((l) => ({ variantId: l.variantId, quantity: Math.floor(Number(l.quantity)), note: l.note.trim() || null }))
      .filter((l) => l.quantity > 0);

    if (lines.length === 0) {
      this.toast.error(this.i18n.t('tr.addOne'));
      return;
    }

    const body = { fromWarehouseId: this.fromId(), toWarehouseId: this.toId(), note: this.note().trim() || null, send, direct: this.direct(), lines };

    this.saving.set(true);

    if (this.id === null) {
      this.api.createTransfer(body).subscribe({
        next: (r) => {
          this.toast.success(this.i18n.t(send ? 'tr.ok.sent' : 'tr.ok.saved'));
          void this.router.navigate(['/inventory/transfers', r.id]);
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.api.updateTransfer(this.id, body).subscribe({
        next: () => {
          this.toast.success(this.i18n.t(send ? 'tr.ok.sent' : 'tr.ok.saved'));
          this.reload();
        },
        error: () => this.saving.set(false),
      });
    }
  }

  // ---------------------------------------------------------------- the steps after it is sent

  setApproved(lineId: number, value: string): void {
    this.approvedQty.update((m) => ({ ...m, [lineId]: value }));
  }

  setReceived(lineId: number, value: string): void {
    this.receivedQty.update((m) => ({ ...m, [lineId]: value }));
  }

  private quantities(source: Record<number, string>, lines: TransferLine[]): { lineId: number; quantity: number }[] {
    return lines.map((l) => ({ lineId: l.id, quantity: Math.max(0, Math.floor(Number(source[l.id]) || 0)) }));
  }

  approve(tr: Transfer): void {
    this.act(this.api.approveTransfer(tr.id, this.quantities(this.approvedQty(), tr.lines)), 'tr.ok.approved');
  }

  reject(): void {
    if (this.id !== null) this.act(this.api.rejectTransfer(this.id, this.rejectReason().trim()), 'tr.ok.rejected');
  }

  dispatch(): void {
    if (this.id !== null) this.act(this.api.dispatchTransfer(this.id, this.shipping().trim() || null), 'tr.ok.dispatched');
  }

  receive(tr: Transfer): void {
    const lines = this.quantities(this.receivedQty(), tr.lines);
    const short = tr.lines.some((l) => (lines.find((x) => x.lineId === l.id)?.quantity ?? 0) < l.dispatched);

    if (short && !this.receiveNote().trim()) {
      this.toast.error(this.i18n.t('tr.needNote'));
      return;
    }

    this.act(this.api.receiveTransfer(tr.id, lines, this.receiveNote().trim() || null), 'tr.ok.received');
  }

  cancel(): void {
    if (this.id === null || !confirm(this.i18n.t('tr.confirmCancel'))) return;

    this.act(this.api.cancelTransfer(this.id), 'tr.ok.cancelled');
  }

  private act(request: ReturnType<InventoryOpsApi['cancelTransfer']>, doneKey: string): void {
    this.saving.set(true);

    request.subscribe({
      next: () => {
        this.toast.success(this.i18n.t(doneKey));
        this.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  // ---------------------------------------------------------------- showing

  waitText(tr: Transfer): string {
    if (tr.status === 'Requested' && !tr.can.approve) return this.i18n.t('tr.wait.Requested');
    if (tr.status === 'Approved' && !tr.can.dispatch) return this.i18n.t('tr.wait.Approved');
    if (tr.status === 'InTransit' && !tr.can.receive) return this.i18n.t('tr.wait.InTransit');

    return '';
  }

  stamp(iso: string): string {
    return iso.slice(0, 16).replace('T', ' ');
  }

  money(value: number): string {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  print(): void {
    printArea();
  }
}
