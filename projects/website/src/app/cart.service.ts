import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { Cart, PaymentMethodInfo, StoreInfo } from '@shared/core/models';
import { ToastService } from '@shared/core/toast.service';
import { Observable, catchError, finalize, of, tap } from 'rxjs';
import { environment } from '@shared/environments/environment';

const TOKEN_KEY = 'voltara.cartToken';
const EMPTY: Cart = { guestToken: null, currency: 'EGP', items: [], itemCount: 0, subtotal: 0, savings: 0, hasIssues: false, couponCode: null, couponDiscount: 0, couponError: null, total: 0, promotionDiscount: 0, shippingFee: 0, appliedPromotions: [] };

// The shopping cart of the website.
//   Guest:    the API gives a token with the first item; it is kept in localStorage and sent as X-Cart-Token.
//   Customer: the cart belongs to the account; a guest cart is merged into it right after sign-in.
@Injectable({ providedIn: 'root' })
export class CartService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly url = `${environment.apiUrl}/api/cart`;

  readonly cart = signal<Cart>(EMPTY);
  readonly count = computed(() => this.cart().itemCount);
  readonly currency = signal('EGP');
  readonly busy = signal(false);
  readonly paymentMethods = signal<PaymentMethodInfo[]>([{ code: 'CashOnDelivery', enabled: true }]);

  // The slide-in cart that opens when something is added
  readonly drawerOpen = signal(false);

  constructor() {
    this.http.get<StoreInfo>(`${environment.apiUrl}/api/public/store`).subscribe({
      next: (s) => {
        this.currency.set(s.currency);
        this.paymentMethods.set(s.paymentMethods);
      },
      error: () => undefined,
    });

    // Signing in / out: merge the guest cart or reload
    effect(() => {
      const customer = this.auth.isCustomer();

      untracked(() => (customer && this.token() ? this.merge() : this.load()));
    });
  }

  load(): void {
    // A guest without a token has no cart yet: nothing to ask
    if (!this.auth.isCustomer() && !this.token()) {
      this.cart.set(EMPTY);
      return;
    }

    this.http
      .get<Cart>(this.url, this.options())
      .pipe(catchError(() => of(EMPTY)))
      .subscribe((c) => this.apply(c));
  }

  // `variantId` = the size / colour that is bought (a product without options has one variant)
  add(variantId: number, quantity = 1): Observable<Cart> {
    return this.run(this.http.post<Cart>(`${this.url}/items`, { variantId, quantity }, this.options()), true).pipe(
      tap(() => this.drawerOpen.set(true)),
    );
  }

  setQuantity(variantId: number, quantity: number): Observable<Cart> {
    return this.run(this.http.put<Cart>(`${this.url}/items/${variantId}`, { quantity }, this.options()));
  }

  remove(variantId: number): Observable<Cart> {
    return this.run(this.http.delete<Cart>(`${this.url}/items/${variantId}`, this.options()));
  }

  // The code the customer typed: the API checks it and answers with a clear reason when it does not work
  applyCoupon(code: string): Observable<Cart> {
    return this.run(this.http.post<Cart>(`${this.url}/coupon`, { code }, this.options()));
  }

  removeCoupon(): Observable<Cart> {
    return this.run(this.http.delete<Cart>(`${this.url}/coupon`, this.options()));
  }

  // After an order: the server emptied the cart, so forget the guest token too
  reset(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.cart.set(EMPTY);
  }

  // The guest's cart token (for the checkout request)
  guestToken(): string | null {
    return this.auth.isCustomer() ? null : this.token();
  }

  clear(): Observable<Cart> {
    return this.run(this.http.delete<Cart>(this.url, this.options()));
  }

  private merge(): void {
    this.http
      .post<Cart>(`${this.url}/merge`, {}, this.options())
      .pipe(catchError(() => of(null)))
      .subscribe((c) => {
        // The guest cart is gone (or was empty): its token is not needed any more
        localStorage.removeItem(TOKEN_KEY);

        if (c) this.apply(c);
        else this.load();
      });
  }

  private run(request: Observable<Cart>, toastOnError = false): Observable<Cart> {
    this.busy.set(true);

    return request.pipe(
      tap((c) => this.apply(c)),
      catchError((e: HttpErrorResponse) => {
        // The shared interceptor already shows the API's message (stock, limits ...); a 404 means "not for sale any more"
        if (toastOnError && e.status === 404) this.toast.error(this.i18n.t('cart.cannotAdd'));

        throw e;
      }),
      finalize(() => this.busy.set(false)),
    );
  }

  private apply(c: Cart): void {
    // Only guests keep a token
    if (c.guestToken && !this.auth.isCustomer()) localStorage.setItem(TOKEN_KEY, c.guestToken);

    this.currency.set(c.currency || this.currency());
    this.cart.set(c);
  }

  private token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  private options(): { headers?: Record<string, string> } {
    const token = this.token();

    return !this.auth.isCustomer() && token ? { headers: { 'X-Cart-Token': token } } : {};
  }
}
