import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { ModalComponent } from '@shared/components/modal.component';
import { AdminApiService } from '@shared/core/admin-api.service';
import { I18nService } from '@shared/core/i18n.service';
import { CategoryAdmin, Discount, DiscountInput, DiscountScope, DiscountType, VariantPick } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { Observable } from 'rxjs';
import { VariantPickerComponent } from './variant-picker.component';

import { IntroComponent } from './intro.component';
// ISO (UTC) <-> the value of <input type="datetime-local"> (the browser's local time)
export const toLocalInput = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');

  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const fromLocalInput = (v: string): string | null => (v ? new Date(v).toISOString() : null);

// Price reductions the owner controls: a percentage, an amount, or a new selling price. On everything, a category,
// a product or one item, for a period. When two discounts cover the same item the lower price wins.
@Component({
  selector: 'app-discounts-admin',
  standalone: true,
  imports: [IntroComponent, FormsModule, TranslatePipe, DataTableComponent, ModalComponent, VariantPickerComponent],
  templateUrl: './discounts-admin.component.html',
})
export class DiscountsAdminComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly items = signal<Discount[]>([]);
  readonly categories = signal<CategoryAdmin[]>([]);
  readonly open = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<Discount | null>(null);
  readonly targetLabel = signal('');

  f = this.blank();
  starts = '';
  ends = '';

  readonly columns: DtColumn[] = [
    { key: 'name', label: 'disc.name', value: (d: Discount) => d.name },
    { key: 'discount', label: 'disc.discount', value: (d: Discount) => this.summary(d), filter: 'none', width: '150px' },
    { key: 'covers', label: 'disc.covers', value: (d: Discount) => this.coverage(d) },
    { key: 'period', label: 'disc.period', value: (d: Discount) => this.period(d), filter: 'none', width: '210px' },
    { key: 'status', label: 'inv.status', value: (d: Discount) => d.status, filter: 'select', optionLabel: (v: string) => this.i18n.t('disc.status.' + v), width: '120px' },
    { key: 'actions', label: '', width: '170px' },
  ];

  ngOnInit(): void {
    this.load();
    this.api.getCategories().subscribe((c) => this.categories.set(c));
  }

  load(): void {
    this.api.getDiscounts().subscribe((d) => this.items.set(d));
  }

  private blank(): DiscountInput {
    return { name: '', type: 'Percent', value: 10, scope: 'AllProducts', categoryId: null, productId: null, variantId: null, startsAtUtc: null, endsAtUtc: null, isActive: true };
  }

  // ---------- reading the list
  summary(d: Discount): string {
    return d.type === 'Percent' ? `-${d.value}%` : d.type === 'FixedAmount' ? `-${d.value}` : `= ${d.value}`;
  }

  coverage(d: Discount): string {
    return d.scope === 'AllProducts' ? this.i18n.t('disc.scope.AllProducts') : `${this.i18n.t('disc.scope.' + d.scope)}: ${d.target}`;
  }

  period(d: Discount): string {
    const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(this.i18n.lang() === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '∞');

    return `${fmt(d.startsAtUtc)} → ${fmt(d.endsAtUtc)}`;
  }

  categoryName(c: CategoryAdmin): string {
    const lang = this.i18n.lang();

    return c.translations.find((t) => t.languageCode === lang)?.name || c.translations.find((t) => t.name)?.name || c.slug;
  }

  // ---------- form
  edit(d: Discount | null): void {
    this.editing.set(d);
    this.f = d
      ? { name: d.name, type: d.type, value: d.value, scope: d.scope, categoryId: d.categoryId, productId: d.productId, variantId: d.variantId, startsAtUtc: d.startsAtUtc, endsAtUtc: d.endsAtUtc, isActive: d.isActive }
      : this.blank();
    this.starts = toLocalInput(this.f.startsAtUtc);
    this.ends = toLocalInput(this.f.endsAtUtc);
    this.targetLabel.set(d && (d.scope === 'Product' || d.scope === 'Variant') ? d.target : '');
    this.open.set(true);
  }

  typeChanged(): void {
    // A new selling price belongs to one item
    if (this.f.type === 'SetPrice' && this.f.scope !== 'Variant') this.scopeTo('Variant');
  }

  scopeChanged(): void {
    this.scopeTo(this.f.scope);
  }

  private scopeTo(scope: DiscountScope): void {
    this.f.scope = scope;
    this.f.categoryId = null;
    this.f.productId = null;
    this.f.variantId = null;
    this.targetLabel.set('');
  }

  clearTarget(): void {
    this.f.productId = null;
    this.f.variantId = null;
    this.targetLabel.set('');
  }

  pick(v: VariantPick | null): void {
    if (!v) return;

    if (this.f.scope === 'Product') {
      this.f.productId = v.productId ?? null;
      this.targetLabel.set(v.productName);
    } else {
      this.f.variantId = v.id;
      this.targetLabel.set(`${v.productName} ${v.label}`.trim());
    }
  }

  save(): void {
    const f = this.f;
    const missingTarget = (f.scope === 'Category' && !f.categoryId) || (f.scope === 'Product' && !f.productId) || (f.scope === 'Variant' && !f.variantId);

    if (!f.name.trim() || !(Number(f.value) > 0) || missingTarget) {
      this.toast.error(this.i18n.t('inv.fixFields'));
      return;
    }

    const body: DiscountInput = { ...f, name: f.name.trim(), value: Number(f.value), startsAtUtc: fromLocalInput(this.starts), endsAtUtc: fromLocalInput(this.ends) };
    const e = this.editing();
    const request: Observable<unknown> = e ? this.api.updateDiscount(e.id, body) : this.api.createDiscount(body);

    this.saving.set(true);
    request.subscribe({
      next: () => { this.saving.set(false); this.open.set(false); this.toast.success(this.i18n.t('inv.saved')); this.load(); },
      error: () => this.saving.set(false),
    });
  }

  remove(d: Discount): void {
    if (!confirm(this.i18n.t('inv.confirmDelete'))) return;

    this.api.deleteDiscount(d.id).subscribe(() => this.load());
  }
}
