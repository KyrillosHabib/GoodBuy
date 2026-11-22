import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AccountApiService } from '@shared/core/account-api.service';
import { AuthService } from '@shared/core/auth.service';
import { OrdersApiService } from '@shared/core/orders-api.service';
import { ProductImagePipe, TranslatePipe } from '@shared/core/pipes';
import { emptyToNull } from '@shared/core/translation-forms';
import { PHONE_PATTERN } from './auth-shared';
import { CartService } from './cart.service';
import { MoneyPipe } from './money.pipe';
import './payment.i18n';
import { CouponBoxComponent } from './coupon-box.component';

// The "light" checkout: a guest only fills in who they are, where to deliver and how they pay. No account, no code.
// A signed-in customer gets the form pre-filled from their profile and default address.
@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CouponBoxComponent, ReactiveFormsModule, RouterLink, TranslatePipe, ProductImagePipe, MoneyPipe],
  templateUrl: './checkout.component.html',
})
export class CheckoutComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly orders = inject(OrdersApiService);
  private readonly account = inject(AccountApiService);
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);
  readonly cart = inject(CartService);

  readonly loading = signal(false);
  readonly firstPayable = computed(() => this.cart.paymentMethods().find((m) => m.enabled)?.code ?? 'CashOnDelivery');

  readonly form = this.fb.group({
    fullName: ['', Validators.required],
    phone: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
    email: ['', [Validators.required, Validators.email]],
    country: ['', Validators.required],
    city: ['', Validators.required],
    region: [''],
    line1: ['', Validators.required],
    line2: [''],
    postalCode: [''],
    notes: [''],
    paymentMethod: ['CashOnDelivery', Validators.required],
  });

  ngOnInit(): void {
    this.form.controls.paymentMethod.setValue(this.firstPayable());

    // A signed-in customer: the profile and the default address fill the form
    if (this.auth.isCustomer()) {
      this.account.getMe().subscribe((p) => this.form.patchValue({ fullName: p.fullName, email: p.email, phone: p.phone ?? '' }));
      this.account.getAddresses().subscribe((list) => {
        const a = list.find((x) => x.isDefault) ?? list[0];
        if (a) this.form.patchValue({ fullName: a.recipientName, phone: a.phone, country: a.country, city: a.city, region: a.region ?? '', line1: a.line1, line2: a.line2 ?? '', postalCode: a.postalCode ?? '' });
      });
    }
  }

  bad(control: 'fullName' | 'phone' | 'email' | 'country' | 'city' | 'line1'): boolean {
    const c = this.form.controls[control];
    return c.touched && c.invalid;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();

    this.loading.set(true);
    this.orders
      .place(
        {
          fullName: (v.fullName ?? '').trim(),
          email: (v.email ?? '').trim(),
          phone: (v.phone ?? '').trim(),
          country: (v.country ?? '').trim(),
          city: (v.city ?? '').trim(),
          region: emptyToNull(v.region),
          line1: (v.line1 ?? '').trim(),
          line2: emptyToNull(v.line2),
          postalCode: emptyToNull(v.postalCode),
          notes: emptyToNull(v.notes),
          paymentMethod: v.paymentMethod ?? 'CashOnDelivery',
        },
        this.cart.guestToken(),
      )
      .subscribe({
        next: (placed) => {
          this.cart.reset();

          const confirmation = () => this.router.navigate(['/order', placed.number], { queryParams: { token: placed.accessToken } });

          // Card: the customer pays on the Stripe page, which sends him back to the confirmation page of the order
          if (placed.paymentMethod === 'Card') {
            this.orders.createStripeSession(placed.number, placed.accessToken).subscribe({
              next: (s) => { window.location.href = s.url; },
              error: () => { this.loading.set(false); void confirmation(); },
            });

            return;
          }

          this.loading.set(false);
          void confirmation();
        },
        error: () => {
          this.loading.set(false);
          // Stock or prices may have changed while the shopper was typing
          this.cart.load();
        },
      });
  }
}
