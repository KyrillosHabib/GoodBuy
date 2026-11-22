import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { InventoryApiService } from '@shared/core/inventory-api.service';
import { I18nService } from '@shared/core/i18n.service';
import { VariantPick, Warehouse } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { VariantPickerComponent } from '../variant-picker.component';
import { AdjustmentReason, OrderOpsApi, StockAdjustment } from './order-ops.api';
import './adjustments.i18n';

const REASONS: AdjustmentReason[] = ['Shortage', 'Surplus', 'Damage', 'Expired', 'LostOrStolen', 'CountError', 'CustomerReturn', 'Other'];

interface EditLine {
  variantId: number; name: string; sku: string; books: number; found: string; reason: AdjustmentReason; note: string;
}

// One stock adjustment. New: the employee writes what the books say and what he really found. Existing: the head of the warehouse
// approves it (somebody else than the one who recorded it) and only then does the quantity change.
@Component({
  selector: 'app-stock-adjustment-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe, VariantPickerComponent],
  templateUrl: './stock-adjustment-detail.component.html',
  styleUrl: './stock-adjustment-detail.component.css',
})
export class StockAdjustmentDetailComponent implements OnInit {
  private readonly api = inject(OrderOpsApi);
  private readonly inventory = inject(InventoryApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly reasons = REASONS;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly adj = signal<StockAdjustment | null>(null);

  // ---- new adjustment
  readonly warehouses = signal<Warehouse[]>([]);
  readonly warehouseId = signal(0);
  readonly note = signal('');
  readonly lines = signal<EditLine[]>([]);
  private books = new Map<number, number>();

  readonly hasLines = computed(() => this.lines().length > 0);

  ngOnInit(): void {
    this.route.paramMap.subscribe((p) => this.init(p.get('id')));
  }

  private init(id: string | null): void {
    this.loading.set(true);
    this.adj.set(null);

    if (!id || id === 'new') {
      this.lines.set([]);
      this.note.set('');
      this.warehouseId.set(0);
      this.inventory.getWarehouses().subscribe({
        next: (w) => {
          this.warehouses.set(w.filter((x) => x.isActive));
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
      return;
    }

    this.api.getAdjustment(Number(id)).subscribe({
      next: (a) => {
        this.adj.set(a);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  // ---------------------------------------------------------------- new

  setWarehouse(id: number): void {
    this.warehouseId.set(id);
    this.books = new Map<number, number>();

    if (!id) return;

    // What the books say now in this warehouse (an item that is not in the list holds 0)
    this.inventory.getStock(id).subscribe((rows) => {
      this.books = new Map(rows.map((r) => [r.variantId, r.onHand]));
      this.lines.update((ls) => ls.map((l) => ({ ...l, books: this.books.get(l.variantId) ?? 0 })));
    });
  }

  addVariant(v: VariantPick | null): void {
    if (!v) return;

    if (this.lines().some((l) => l.variantId === v.id)) {
      this.toast.error(this.i18n.t('adj.duplicate'));
      return;
    }

    const books = this.books.get(v.id) ?? 0;

    this.lines.update((ls) => [
      ...ls,
      { variantId: v.id, name: v.label ? `${v.productName} · ${v.label}` : v.productName, sku: v.sku, books, found: String(books), reason: 'Shortage', note: '' },
    ]);
  }

  patch(index: number, change: Partial<EditLine>): void {
    this.lines.update((ls) => ls.map((l, i) => (i === index ? { ...l, ...change } : l)));
  }

  removeLine(index: number): void {
    this.lines.update((ls) => ls.filter((_, i) => i !== index));
  }

  diff(l: EditLine): number {
    const found = Number(l.found);
    return Number.isFinite(found) && l.found !== '' ? found - l.books : 0;
  }

  signed(n: number): string {
    return n > 0 ? `+${n}` : `${n}`;
  }

  save(): void {
    if (!this.warehouseId()) {
      this.toast.error(this.i18n.t('adj.pickWh'));
      return;
    }

    const lines = this.lines();

    if (lines.length === 0) {
      this.toast.error(this.i18n.t('adj.addOne'));
      return;
    }

    for (const l of lines) {
      const found = Number(l.found);

      if (l.found === '' || !Number.isFinite(found) || found < 0) {
        this.toast.error(this.i18n.t('adj.badQty', { item: l.name }));
        return;
      }
    }

    if (lines.every((l) => this.diff(l) === 0)) {
      this.toast.error(this.i18n.t('adj.needDiff'));
      return;
    }

    this.saving.set(true);

    this.api
      .createAdjustment({
        warehouseId: this.warehouseId(),
        note: this.note().trim() || null,
        lines: lines.map((l) => ({ variantId: l.variantId, actualQuantity: Math.floor(Number(l.found)), reason: l.reason, note: l.note.trim() || null })),
      })
      .subscribe({
        next: (r) => {
          this.saving.set(false);
          // The Admin's own adjustment is applied at once: the detail tells which one happened
          this.api.getAdjustment(r.id).subscribe({
            next: (a) => {
              this.toast.success(this.i18n.t(a.status === 'Approved' ? 'adj.ok.applied' : 'adj.ok.waiting'));
              void this.router.navigate(['/inventory/adjustments', r.id]);
            },
            error: () => void this.router.navigate(['/inventory/adjustments', r.id]),
          });
        },
        error: () => this.saving.set(false),
      });
  }

  // ---------------------------------------------------------------- decisions

  approve(a: StockAdjustment): void {
    if (!confirm(this.i18n.t('adj.confirmApprove'))) return;
    this.run(this.api.approveAdjustment(a.id), 'adj.ok.approved', a.id);
  }

  reject(a: StockAdjustment): void {
    const reason = prompt(this.i18n.t('adj.rejectPrompt'));

    if (!reason || !reason.trim()) return;

    this.run(this.api.rejectAdjustment(a.id, reason.trim()), 'adj.ok.rejected', a.id);
  }

  cancel(a: StockAdjustment): void {
    if (!confirm(this.i18n.t('adj.confirmCancel'))) return;
    this.run(this.api.cancelAdjustment(a.id), 'adj.ok.cancelled', a.id);
  }

  private run(call: { subscribe: (o: { next: () => void; error: () => void }) => unknown }, doneKey: string, id: number): void {
    this.saving.set(true);

    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.i18n.t(doneKey));
        this.init(String(id));
      },
      error: () => this.saving.set(false),
    });
  }
}
