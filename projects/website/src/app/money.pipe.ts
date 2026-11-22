import { Pipe, PipeTransform, inject } from '@angular/core';
import { I18nService } from '@shared/core/i18n.service';
import { CartService } from './cart.service';

// 1250 -> "EGP 1,250.00" / "١٬٢٥٠٫٠٠ ج.م.‏" (store currency, current language). Impure: follows language and currency changes.
@Pipe({ name: 'money', standalone: true, pure: false })
export class MoneyPipe implements PipeTransform {
  private readonly cart = inject(CartService);
  private readonly i18n = inject(I18nService);

  transform(value: number | null | undefined): string {
    if (value === null || value === undefined) return '';

    const currency = this.cart.currency();

    try {
      return new Intl.NumberFormat(this.i18n.lang() === 'ar' ? 'ar-EG' : 'en-US', { style: 'currency', currency }).format(value);
    } catch {
      return `${value.toFixed(2)} ${currency}`;
    }
  }
}
