import { Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PublicApiService } from '@shared/core/public-api.service';
import { PublicProductDetails, PublicProductListItem, PublicVariant } from '@shared/core/models';
import { ProductImagePipe, TranslatePipe } from '@shared/core/pipes';
import { CartService } from './cart.service';
import { MoneyPipe } from './money.pipe';
import './storefront.i18n';

// "Show options": a window over the page where the shopper picks colour, size and quantity and adds to the cart
// without leaving the list.
@Component({
  selector: 'app-quick-view',
  standalone: true,
  imports: [RouterLink, ProductImagePipe, TranslatePipe, MoneyPipe],
  templateUrl: './quick-view.component.html',
})
export class QuickViewComponent implements OnInit, OnDestroy {
  private readonly host = inject(ElementRef<HTMLElement>);
  @Input({ required: true }) product!: PublicProductListItem;
  @Output() closed = new EventEmitter<void>();

  private readonly api = inject(PublicApiService);
  private readonly cart = inject(CartService);

  readonly details = signal<PublicProductDetails | null>(null);
  readonly chosen = signal<Record<number, string>>({});
  readonly qty = signal(1);
  readonly adding = signal(false);
  readonly fav = signal(false);

  ngOnInit(): void {
    // Moved to the page body: a card inside a scrolling row must not trap the window
    document.body.appendChild(this.host.nativeElement);
    this.fav.set(this.favs().includes(this.product.id));

    this.api.getProduct(this.product.slug).subscribe({
      next: (p) => {
        const best = p.variants.find((v) => v.id === this.product.defaultVariantId && v.canBuy) ?? p.variants.find((v) => v.canBuy) ?? p.variants[0];
        const pick: Record<number, string> = {};

        best?.attributes.forEach((a, i) => (pick[i] = a.value));
        this.chosen.set(pick);
        this.details.set(p);
      },
      error: () => this.closed.emit(),
    });
  }

  ngOnDestroy(): void {
    this.host.nativeElement.remove();
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closed.emit();
  }

  private match(pick: Record<number, string>): PublicVariant | null {
    return this.details()?.variants.find((v) => v.attributes.every((a, i) => pick[i] === a.value)) ?? null;
  }

  current(): PublicVariant | null {
    return this.match(this.chosen());
  }

  image(): string | null {
    return this.current()?.imageUrl || this.details()?.mainImageUrl || this.product.mainImageUrl;
  }

  discount(v: PublicVariant): number {
    return v.compareAtPrice && v.compareAtPrice > v.price ? Math.round((1 - v.price / v.compareAtPrice) * 100) : 0;
  }

  groups(): { index: number; name: string; values: { value: string; colorHex: string | null }[] }[] {
    const p = this.details();

    if (!p) return [];

    const count = Math.max(0, ...p.variants.map((v) => v.attributes.length));
    const out = [];

    for (let i = 0; i < count; i++) {
      const values: { value: string; colorHex: string | null }[] = [];

      for (const v of p.variants) {
        const a = v.attributes[i];
        if (a && !values.some((x) => x.value === a.value)) values.push({ value: a.value, colorHex: a.colorHex });
      }

      out.push({ index: i, name: p.variants.find((v) => v.attributes[i])?.attributes[i].name ?? '', values });
    }

    return out;
  }

  canBuyWith(index: number, value: string): boolean {
    const pick = { ...this.chosen(), [index]: value };

    return !!this.details()?.variants.some((v) => v.canBuy && v.attributes.every((a, i) => pick[i] === undefined || pick[i] === a.value));
  }

  choose(index: number, value: string): void {
    const p = this.details()!;
    const next = { ...this.chosen(), [index]: value };

    if (!this.match(next)) {
      const fallback = p.variants.find((v) => v.attributes[index]?.value === value);
      if (fallback) fallback.attributes.forEach((a, i) => (next[i] = a.value));
    }

    this.chosen.set(next);
    this.qty.set(Math.min(this.qty(), this.max()));
  }

  max(): number {
    const v = this.current();

    return v && !v.preorder && v.lowStock !== null ? Math.max(1, v.lowStock) : 99;
  }

  step(delta: number): void {
    this.qty.set(Math.min(this.max(), Math.max(1, this.qty() + delta)));
  }

  add(): void {
    const v = this.current();

    if (!v || !v.canBuy || this.adding()) return;

    this.adding.set(true);
    this.cart.add(v.id, this.qty()).subscribe({
      next: () => {
        this.adding.set(false);
        this.closed.emit();
      },
      error: () => this.adding.set(false),
    });
  }

  // A light favourites list kept in this browser (no account needed)
  private favs(): number[] {
    try {
      return JSON.parse(localStorage.getItem('voltara.favs') ?? '[]');
    } catch {
      return [];
    }
  }

  toggleFav(): void {
    const list = this.favs();
    const next = list.includes(this.product.id) ? list.filter((x) => x !== this.product.id) : [...list, this.product.id];

    try {
      localStorage.setItem('voltara.favs', JSON.stringify(next));
    } catch {
      // storage can be blocked: the heart still shows for this visit
    }

    this.fav.set(next.includes(this.product.id));
  }
}
