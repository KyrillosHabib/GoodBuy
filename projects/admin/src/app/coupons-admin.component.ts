import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { ModalComponent } from '@shared/components/modal.component';
import { AdminApiService } from '@shared/core/admin-api.service';
import { I18nService } from '@shared/core/i18n.service';
import { CategoryAdmin, Coupon, CouponInput, CouponUsage, VariantPick } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { Observable } from 'rxjs';
import { fromLocalInput, toLocalInput } from './discounts-admin.component';
import { VariantPickerComponent } from './variant-picker.component';

import { IntroComponent } from './intro.component';
// Coupon codes: the customer types the code in the cart. The owner decides the discount, the period, how many times it can
// be used (in total and by one customer), who can use it, the minimum order and what it applies to.
@Component({
  selector: 'app-coupons-admin',
  standalone: true,
  imports: [IntroComponent, FormsModule, TranslatePipe, DataTableComponent, ModalComponent, VariantPickerComponent],
  templateUrl: './coupons-admin.component.html',
})
export class CouponsAdminComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly items = signal<Coupon[]>([]);
  readonly categories = signal<CategoryAdmin[]>([]);
  readonly open = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<Coupon | null>(null);
  readonly productLabel = signal('');
  readonly usagesOf = signal<Coupon | null>(null);
  readonly usages = signal<CouponUsage[]>([]);

  f = this.blank();
  starts = '';
  ends = '';
  appliesTo: 'all' | 'category' | 'product' = 'all';

  readonly columns: DtColumn[] = [
    { key: 'code', label: 'cpn.code', value: (c: Coupon) => `${c.code} ${c.name}` },
    { key: 'discount', label: 'disc.discount', value: (c: Coupon) => c.value, type: 'number', filter: 'none', width: '110px' },
    { key: 'used', label: 'cpn.used', value: (c: Coupon) => c.usedCount, type: 'number', filter: 'none', width: '110px' },
    { key: 'audience', label: 'cpn.audience', value: (c: Coupon) => c.audience, filter: 'select', optionLabel: (v: string) => this.i18n.t('cpn.audience.' + v), width: '160px' },
    { key: 'status', label: 'inv.status', value: (c: Coupon) => c.status, filter: 'select', optionLabel: (v: string) => this.i18n.t('cpn.status.' + v), width: '120px' },
    { key: 'actions', label: '', width: '260px' },
  ];

  ngOnInit(): void {
    this.load();
    this.api.getCategories().subscribe((c) => this.categories.set(c));
  }

  load(): void {
    this.api.getCoupons().subscribe((c) => this.items.set(c));
  }

  private blank(): CouponInput {
    return {
      code: '', name: '', type: 'Percent', value: 10, minOrderAmount: null, maxDiscountAmount: null, startsAtUtc: null, endsAtUtc: null,
      isActive: true, totalUsageLimit: null, perCustomerLimit: 1, audience: 'Everyone', allowedEmails: null, excludeDiscountedItems: false,
      categoryId: null, productId: null,
    };
  }

  categoryName(c: CategoryAdmin): string {
    const lang = this.i18n.lang();

    return c.translations.find((t) => t.languageCode === lang)?.name || c.translations.find((t) => t.name)?.name || c.slug;
  }

  // A random code that is easy to read out loud: no 0/O or 1/I
  generate(): void {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const array = new Uint32Array(8);
    crypto.getRandomValues(array);
    this.f.code = Array.from(array, (n) => letters[n % letters.length]).join('');
  }

  edit(c: Coupon | null): void {
    this.editing.set(c);
    this.f = c
      ? {
          code: c.code, name: c.name, type: c.type, value: c.value, minOrderAmount: c.minOrderAmount, maxDiscountAmount: c.maxDiscountAmount,
          startsAtUtc: c.startsAtUtc, endsAtUtc: c.endsAtUtc, isActive: c.isActive, totalUsageLimit: c.totalUsageLimit, perCustomerLimit: c.perCustomerLimit,
          audience: c.audience, allowedEmails: c.allowedEmails, excludeDiscountedItems: c.excludeDiscountedItems, categoryId: c.categoryId, productId: c.productId,
        }
      : this.blank();
    this.starts = toLocalInput(this.f.startsAtUtc);
    this.ends = toLocalInput(this.f.endsAtUtc);
    this.appliesTo = this.f.categoryId ? 'category' : this.f.productId ? 'product' : 'all';
    this.productLabel.set(c?.productId ? c.target : '');
    this.open.set(true);
  }

  appliesChanged(): void {
    this.f.categoryId = null;
    this.f.productId = null;
    this.productLabel.set('');
  }

  pickProduct(v: VariantPick | null): void {
    if (!v) return;

    this.f.productId = v.productId ?? null;
    this.productLabel.set(v.productName);
  }

  clearProduct(): void {
    this.f.productId = null;
    this.productLabel.set('');
  }

  save(): void {
    const f = this.f;
    const target = (this.appliesTo === 'category' && !f.categoryId) || (this.appliesTo === 'product' && !f.productId);

    if (f.code.trim().length < 3 || !f.name.trim() || (f.type !== 'FreeShipping' && !(Number(f.value) > 0)) || target) {
      this.toast.error(this.i18n.t('inv.fixFields'));
      return;
    }

    const num = (v: number | null) => (v === null || (v as unknown) === '' ? null : Number(v));
    const body: CouponInput = {
      ...f,
      code: f.code.trim().toUpperCase(),
      name: f.name.trim(),
      value: f.type === 'FreeShipping' ? 0 : Number(f.value),
      minOrderAmount: num(f.minOrderAmount),
      maxDiscountAmount: f.type === 'Percent' ? num(f.maxDiscountAmount) : null,
      totalUsageLimit: num(f.totalUsageLimit),
      perCustomerLimit: num(f.perCustomerLimit),
      allowedEmails: f.audience === 'SpecificCustomers' ? (f.allowedEmails ?? '').trim() : null,
      startsAtUtc: fromLocalInput(this.starts),
      endsAtUtc: fromLocalInput(this.ends),
    };
    const e = this.editing();
    const request: Observable<unknown> = e ? this.api.updateCoupon(e.id, body) : this.api.createCoupon(body);

    this.saving.set(true);
    request.subscribe({
      next: () => { this.saving.set(false); this.open.set(false); this.toast.success(this.i18n.t('inv.saved')); this.load(); },
      error: () => this.saving.set(false),
    });
  }

  showUsages(c: Coupon): void {
    this.usagesOf.set(c);
    this.usages.set([]);
    this.api.getCouponUsages(c.id).subscribe((u) => this.usages.set(u));
  }

  remove(c: Coupon): void {
    if (!confirm(this.i18n.t('inv.confirmDelete'))) return;

    this.api.deleteCoupon(c.id).subscribe(() => this.load());
  }
}
