import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { ModalComponent } from '@shared/components/modal.component';
import { AdminApiService } from '@shared/core/admin-api.service';
import { I18nService } from '@shared/core/i18n.service';
import { CategoryAdmin, Promotion, PromotionInput, VariantPick } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { Observable } from 'rxjs';
import { fromLocalInput, toLocalInput } from './discounts-admin.component';
import { VariantPickerComponent } from './variant-picker.component';

import { IntroComponent } from './intro.component';
// Offers that apply to the cart by themselves (no code): "buy 2 get a gift", "buy 3 get 15% off", "a gift above 2000",
// "free shipping above 500".
@Component({
  selector: 'app-promotions-admin',
  standalone: true,
  imports: [IntroComponent, FormsModule, TranslatePipe, DataTableComponent, ModalComponent, VariantPickerComponent],
  templateUrl: './promotions-admin.component.html',
})
export class PromotionsAdminComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly items = signal<Promotion[]>([]);
  readonly categories = signal<CategoryAdmin[]>([]);
  readonly open = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<Promotion | null>(null);
  readonly triggerLabel = signal('');
  readonly rewardLabel = signal('');

  f = this.blank();
  starts = '';
  ends = '';

  readonly columns: DtColumn[] = [
    { key: 'name', label: 'disc.name', value: (p: Promotion) => p.name },
    { key: 'type', label: 'promo.kind', value: (p: Promotion) => p.type, filter: 'select', optionLabel: (v: string) => this.i18n.t('promo.type.' + v), width: '190px' },
    { key: 'what', label: 'promo.what', value: (p: Promotion) => this.describe(p), filter: 'none' },
    { key: 'period', label: 'disc.period', value: (p: Promotion) => this.period(p), filter: 'none', width: '210px' },
    { key: 'status', label: 'inv.status', value: (p: Promotion) => p.status, filter: 'select', optionLabel: (v: string) => this.i18n.t('disc.status.' + v), width: '120px' },
    { key: 'actions', label: '', width: '170px' },
  ];

  ngOnInit(): void {
    this.load();
    this.api.getCategories().subscribe((c) => this.categories.set(c));
  }

  load(): void {
    this.api.getPromotions().subscribe((p) => this.items.set(p));
  }

  private blank(): PromotionInput {
    return {
      name: '', type: 'BuyGet', triggerScope: 'Product', triggerCategoryId: null, triggerProductId: null, triggerVariantId: null, buyQuantity: 2,
      minSubtotal: null, rewardVariantId: null, rewardQuantity: 1, repeat: false, discountType: 'Percent', discountValue: 10,
      startsAtUtc: null, endsAtUtc: null, isActive: true,
    };
  }

  describe(p: Promotion): string {
    const buy = p.triggerScope === 'AllProducts' ? this.i18n.t('disc.scope.AllProducts') : p.triggerTarget;

    switch (p.type) {
      case 'BuyGet': return this.i18n.t('promo.d.BuyGet', { n: p.buyQuantity, what: buy, gift: p.rewardName, q: p.rewardQuantity });
      case 'QuantityDiscount': return this.i18n.t('promo.d.QuantityDiscount', { n: p.buyQuantity, what: buy, off: p.discountType === 'Percent' ? `${p.discountValue}%` : `${p.discountValue}` });
      case 'SpendGift': return this.i18n.t('promo.d.SpendGift', { amount: p.minSubtotal ?? 0, gift: p.rewardName, q: p.rewardQuantity });
      default: return p.minSubtotal ? this.i18n.t('promo.d.FreeShippingAbove', { amount: p.minSubtotal }) : this.i18n.t('promo.d.FreeShipping');
    }
  }

  period(p: Promotion): string {
    const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(this.i18n.lang() === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '∞');

    return `${fmt(p.startsAtUtc)} → ${fmt(p.endsAtUtc)}`;
  }

  categoryName(c: CategoryAdmin): string {
    const lang = this.i18n.lang();

    return c.translations.find((t) => t.languageCode === lang)?.name || c.translations.find((t) => t.name)?.name || c.slug;
  }

  edit(p: Promotion | null): void {
    this.editing.set(p);
    this.f = p
      ? {
          name: p.name, type: p.type, triggerScope: p.triggerScope, triggerCategoryId: p.triggerCategoryId, triggerProductId: p.triggerProductId,
          triggerVariantId: p.triggerVariantId, buyQuantity: p.buyQuantity, minSubtotal: p.minSubtotal, rewardVariantId: p.rewardVariantId,
          rewardQuantity: p.rewardQuantity, repeat: p.repeat, discountType: p.discountType, discountValue: p.discountValue,
          startsAtUtc: p.startsAtUtc, endsAtUtc: p.endsAtUtc, isActive: p.isActive,
        }
      : this.blank();
    this.starts = toLocalInput(this.f.startsAtUtc);
    this.ends = toLocalInput(this.f.endsAtUtc);
    this.triggerLabel.set(p && (p.triggerScope === 'Product' || p.triggerScope === 'Variant') ? p.triggerTarget : '');
    this.rewardLabel.set(p?.rewardVariantId ? p.rewardName : '');
    this.open.set(true);
  }

  typeChanged(): void {
    if (this.f.type === 'FreeShipping' || this.f.type === 'SpendGift') this.f.minSubtotal ??= this.f.type === 'SpendGift' ? 1000 : null;
  }

  scopeChanged(): void {
    this.f.triggerCategoryId = null;
    this.f.triggerProductId = null;
    this.f.triggerVariantId = null;
    this.triggerLabel.set('');
  }

  clearTrigger(): void {
    this.f.triggerProductId = null;
    this.f.triggerVariantId = null;
    this.triggerLabel.set('');
  }

  pickTrigger(v: VariantPick | null): void {
    if (!v) return;

    if (this.f.triggerScope === 'Product') {
      this.f.triggerProductId = v.productId ?? null;
      this.triggerLabel.set(v.productName);
    } else {
      this.f.triggerVariantId = v.id;
      this.triggerLabel.set(`${v.productName} ${v.label}`.trim());
    }
  }

  clearReward(): void {
    this.f.rewardVariantId = null;
    this.rewardLabel.set('');
  }

  pickReward(v: VariantPick | null): void {
    if (!v) return;

    this.f.rewardVariantId = v.id;
    this.rewardLabel.set(`${v.productName} ${v.label}`.trim());
  }

  save(): void {
    const f = this.f;
    const triggers = f.type === 'BuyGet' || f.type === 'QuantityDiscount';
    const gives = f.type === 'BuyGet' || f.type === 'SpendGift';
    const missingTrigger = triggers && ((f.triggerScope === 'Category' && !f.triggerCategoryId) || (f.triggerScope === 'Product' && !f.triggerProductId) || (f.triggerScope === 'Variant' && !f.triggerVariantId));
    const missingGift = gives && !f.rewardVariantId;
    const missingMin = f.type === 'SpendGift' && !(Number(f.minSubtotal) > 0);
    const missingDiscount = f.type === 'QuantityDiscount' && !(Number(f.discountValue) > 0);

    if (!f.name.trim() || missingTrigger || missingGift || missingMin || missingDiscount) {
      this.toast.error(this.i18n.t('inv.fixFields'));
      return;
    }

    const min = f.minSubtotal === null || (f.minSubtotal as unknown) === '' ? null : Number(f.minSubtotal);
    const body: PromotionInput = {
      ...f,
      name: f.name.trim(),
      buyQuantity: Number(f.buyQuantity) || 1,
      rewardQuantity: Number(f.rewardQuantity) || 1,
      discountValue: Number(f.discountValue) || 0,
      minSubtotal: min,
      startsAtUtc: fromLocalInput(this.starts),
      endsAtUtc: fromLocalInput(this.ends),
    };
    const e = this.editing();
    const request: Observable<unknown> = e ? this.api.updatePromotion(e.id, body) : this.api.createPromotion(body);

    this.saving.set(true);
    request.subscribe({
      next: () => { this.saving.set(false); this.open.set(false); this.toast.success(this.i18n.t('inv.saved')); this.load(); },
      error: () => this.saving.set(false),
    });
  }

  remove(p: Promotion): void {
    if (!confirm(this.i18n.t('inv.confirmDelete'))) return;

    this.api.deletePromotion(p.id).subscribe(() => this.load());
  }
}
