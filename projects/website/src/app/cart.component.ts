import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@shared/core/auth.service';
import { CartLine } from '@shared/core/models';
import { ProductImagePipe, TranslatePipe } from '@shared/core/pipes';
import { CartService } from './cart.service';
import { MoneyPipe } from './money.pipe';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe, ProductImagePipe, MoneyPipe],
  templateUrl: './cart.component.html',
})
export class CartComponent {
  readonly cart = inject(CartService);
  readonly auth = inject(AuthService);

  change(line: CartLine, delta: number): void {
    // Going below 1 asks the API to remove the line
    this.cart.setQuantity(line.variantId, Math.max(0, line.quantity + delta)).subscribe({ error: () => this.cart.load() });
  }

  remove(line: CartLine): void {
    this.cart.remove(line.variantId).subscribe();
  }

  clear(): void {
    this.cart.clear().subscribe();
  }

  couponCode = '';

  applyCoupon(): void {
    const code = this.couponCode.trim();

    if (!code) return;

    // A coupon that does not work is explained by the message of the API (the shared interceptor shows it)
    this.cart.applyCoupon(code).subscribe({ next: () => (this.couponCode = ''), error: () => undefined });
  }

  removeCoupon(): void {
    this.cart.removeCoupon().subscribe();
  }
}
