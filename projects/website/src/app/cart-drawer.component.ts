import { Component, HostListener, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartLine } from '@shared/core/models';
import { ProductImagePipe, TranslatePipe } from '@shared/core/pipes';
import { CartService } from './cart.service';
import { MoneyPipe } from './money.pipe';

// The cart that slides in from the side when something is added (or when the cart icon is pressed),
// so the shopper never leaves the page they are on.
@Component({
  selector: 'app-cart-drawer',
  standalone: true,
  imports: [RouterLink, TranslatePipe, ProductImagePipe, MoneyPipe],
  templateUrl: './cart-drawer.component.html',
})
export class CartDrawerComponent {
  readonly cart = inject(CartService);

  @HostListener('document:keydown.escape')
  close(): void {
    this.cart.drawerOpen.set(false);
  }

  change(line: CartLine, delta: number): void {
    this.cart.setQuantity(line.variantId, Math.max(0, line.quantity + delta)).subscribe({ error: () => this.cart.load() });
  }
}
