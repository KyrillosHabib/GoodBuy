import { Component, Input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicProductListItem } from '@shared/core/models';
import { ProductImagePipe, TranslatePipe } from '@shared/core/pipes';
import { QuickViewComponent } from './quick-view.component';
import { MoneyPipe } from './money.pipe';

@Component({
  selector: 'app-product-card',
  standalone: true,
  imports: [RouterLink, ProductImagePipe, TranslatePipe, MoneyPipe, QuickViewComponent],
  templateUrl: './product-card.component.html',
})
export class ProductCardComponent {
  @Input({ required: true }) product!: PublicProductListItem;

  // "Show options": the window with colour / size / quantity
  readonly open = signal(false);

  // The discount shown on the picture: how much cheaper the price is than the old price
  discount(): number {
    const p = this.product;

    return p.price !== null && p.compareAtPrice && p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0;
  }

  // The card is a link: nothing inside the box may open the product page
  stop(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
  }

  show(event: Event): void {
    this.stop(event);
    this.open.set(true);
  }
}
