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
import { InventoryOpsApi, ReturnBatchOption, ReturnLookups, ReturnReason, SupplierReturn } from './ops.api';
import './ops.i18n';

const REASONS: ReturnReason[] = ['Damaged', 'Expired', 'WrongItem', 'Excess', 'Quality', 'Other'];

interface EditLine {
  variantId: number; name: string; sku: string; quantity: string; reason: ReturnReason; batchId: string; note: string; batches: ReturnBatchOption[];
}

// One return to a supplier: written here (new / draft), approved by the manager of the warehouse, then the goods are sent back
@Component({
  selector: 'app-supplier-return-detail',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './supplier-return-detail.component.html',
  styleUrl: './supplier-return-detail.component.css',
})
export class SupplierReturnDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly api = inject(InventoryOpsApi);
  private readonly inventory = inject(InventoryApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly reasons = REASONS;
  readonly t = signal<SupplierReturn | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly lookups = signal<ReturnLookups>({ warehouses: [], suppliers: [] });

  readonly warehouseId = signal(0);
  readonly supplierId = signal(0);
  readonly note = signal('');
  readonly lines = signal<EditLine[]>([]);

  readonly typing = new Subject<string>();
  readonly results = signal<VariantPick[]>([]);

  readonly rejectOpen = signal(false);
  readonly rejectReason = signal('');
  readonly supplierDoc = signal('');

  private id: number | null = null;

  readonly editing = computed(() => this.id === null || (this.t()?.can.edit ?? false));

  ngOnInit(): void {
    const param = this.route.snapshot.paramMap.get('id');
    this.id = param && param !== 'new' ? Number(param) : null;

    this.api.getReturnLookups().subscribe((l) => {
      this.lookups.set(l);

      // An employee of one warehouse: it is the one the goods leave
      if (this.id === null && l.warehouses.length === 1) this.warehouseId.set(l.warehouses[0].id);
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

    this.api.getSupplierReturn(this.id).subscribe({
      next: (r) => {
        this.t.set(r);
        this.loading.set(false);
        this.saving.set(false);
        this.rejectOpen.set(false);

        this.warehouseId.set(r.warehouseId);
        this.supplierId.set(r.supplierId);
        this.note.set(r.note ?? '');

        this.lines.set(r.lines.map((l) => ({
          variantId: l.variantId, name: `${l.item} ${l.label}`.trim(), sku: l.sku, quantity: String(l.quantity), reason: l.reason,
          batchId: l.batchId ? String(l.batchId) : '', note: l.note ?? '', batches: [],
        })));

        // A draft: the batches to choose from
        if (r.can.edit) this.lines().forEach((l) => this.loadBatches(l.variantId));
      },
      error: () => {
        this.loading.set(false);
        void this.router.navigate(['/inventory/returns']);
      },
    });
  }

  // ---------------------------------------------------------------- writing the return

  setWarehouse(id: number): void {
    this.warehouseId.set(id);

    // The batches belong to the warehouse: the choices are read again and a batch of the other warehouse is dropped
    this.lines.update((l) => l.map((x) => ({ ...x, batchId: '', batches: [] })));
    this.lines().forEach((l) => this.loadBatches(l.variantId));
  }

  private loadBatches(variantId: number): void {
    if (!this.warehouseId()) return;

    this.api.getReturnBatches(this.warehouseId(), variantId).pipe(catchError(() => of([] as ReturnBatchOption[]))).subscribe((batches) => {
      this.lines.update((l) => l.map((x) => (x.variantId === variantId ? { ...x, batches } : x)));
    });
  }

  batchText(b: ReturnBatchOption): string {
    const exp = b.expiryDate ? ` · ${this.i18n.t('sr.exp')} ${b.expiryDate.slice(0, 10)}` : '';
    const who = b.supplier ? ` · ${b.supplier}` : '';

    return `${b.batchNumber}${exp} · ${b.quantityRemaining} ${this.i18n.t('sr.left')}${who}`;
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
    const at = list.findIndex((l) => l.variantId === v.id && l.batchId === '');

    if (at >= 0) {
      list[at] = { ...list[at], quantity: String((Number(list[at].quantity) || 0) + 1) };
      this.lines.set(list);
    } else {
      list.push({ variantId: v.id, name: `${v.productName} ${v.label}`.trim(), sku: v.sku, quantity: '1', reason: 'Damaged', batchId: '', note: '', batches: [] });
      this.lines.set(list);
      this.loadBatches(v.id);
    }

    this.results.set([]);
    input.value = '';
    input.focus();
  }

  patch(i: number, change: Partial<EditLine>): void {
    this.lines.update((l) => l.map((x, n) => (n === i ? { ...x, ...change } : x)));
  }

  removeLine(i: number): void {
    this.lines.update((l) => l.filter((_, n) => n !== i));
  }

  save(submit: boolean): void {
    if (!this.warehouseId() || !this.supplierId()) {
      this.toast.error(this.i18n.t('sr.pick'));
      return;
    }

    const lines = this.lines()
      .map((l) => ({ variantId: l.variantId, quantity: Math.floor(Number(l.quantity)), reason: l.reason, batchId: l.batchId ? Number(l.batchId) : null, note: l.note.trim() || null }))
      .filter((l) => l.quantity > 0);

    if (lines.length === 0) {
      this.toast.error(this.i18n.t('sr.addOne'));
      return;
    }

    const body = { warehouseId: this.warehouseId(), supplierId: this.supplierId(), note: this.note().trim() || null, submit, lines };
    const okKey = submit ? 'sr.ok.submitted' : 'sr.ok.saved';

    this.saving.set(true);

    if (this.id === null) {
      this.api.createSupplierReturn(body).subscribe({
        next: (r) => {
          this.toast.success(this.i18n.t(okKey));
          void this.router.navigate(['/inventory/returns', r.id]);
        },
        error: () => this.saving.set(false),
      });
    } else {
      this.api.updateSupplierReturn(this.id, body).subscribe({
        next: () => {
          this.toast.success(this.i18n.t(okKey));
          this.reload();
        },
        error: () => this.saving.set(false),
      });
    }
  }

  // ---------------------------------------------------------------- the steps after it is written

  act(request: ReturnType<InventoryOpsApi['cancelSupplierReturn']>, doneKey: string): void {
    this.saving.set(true);

    request.subscribe({
      next: () => {
        this.toast.success(this.i18n.t(doneKey));
        this.reload();
      },
      error: () => this.saving.set(false),
    });
  }

  cancel(id: number): void {
    if (!confirm(this.i18n.t('sr.confirmCancel'))) return;

    this.act(this.api.cancelSupplierReturn(id), 'sr.ok.cancelled');
  }

  // ---------------------------------------------------------------- showing

  waitText(tr: SupplierReturn): string {
    if (tr.status === 'Submitted' && !tr.can.approve) return this.i18n.t('sr.wait.Submitted');
    if (tr.status === 'Approved' && !tr.can.execute) return this.i18n.t('sr.wait.Approved');

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
