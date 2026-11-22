import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@shared/core/pipes';
import { CartService } from './cart.service';
import { MoneyPipe } from './money.pipe';

export const WHEEL_COUPON_KEY = 'voltara_wheel_coupon';

// The coupon box: used in the cart page, the mini cart and the checkout. The code is checked by the server
// (it knows the cart, the customer and the limits): a code that does not work is explained in words.
@Component({
  selector: 'app-coupon-box',
  standalone: true,
  imports: [FormsModule, TranslatePipe, MoneyPipe],
  templateUrl: './coupon-box.component.html',
})
export class CouponBoxComponent implements OnInit {
  readonly cart = inject(CartService);

  code = '';

  ngOnInit(): void {
    // A coupon won on the wheel is waiting in the browser: it is put in the box
    try {
      this.code = localStorage.getItem(WHEEL_COUPON_KEY) ?? '';
    } catch {
      this.code = '';
    }
  }

  apply(): void {
    const value = this.code.trim();

    if (!value) return;

    this.cart.applyCoupon(value).subscribe({
      next: () => {
        this.code = '';

        try { localStorage.removeItem(WHEEL_COUPON_KEY); } catch { /* the browser blocks storage */ }
      },
      error: () => undefined,
    });
  }

  remove(): void {
    this.cart.removeCoupon().subscribe();
  }
}
