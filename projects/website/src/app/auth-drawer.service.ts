import { Injectable, signal } from '@angular/core';

// Sign in / create account open in a drawer at the side (like the cart): the shopper never leaves the products.
@Injectable({ providedIn: 'root' })
export class AuthDrawerService {
  readonly isOpen = signal(false);
  readonly tab = signal<'login' | 'register'>('login');

  // Where to go after signing in (a page that asked for an account, e.g. the checkout)
  returnUrl: string | null = null;
  prefillEmail = '';

  open(tab: 'login' | 'register' = 'login', returnUrl: string | null = null, email = ''): void {
    this.tab.set(tab);
    this.returnUrl = returnUrl;
    this.prefillEmail = email;
    this.isOpen.set(true);
  }

  close(): void {
    this.isOpen.set(false);
  }
}
