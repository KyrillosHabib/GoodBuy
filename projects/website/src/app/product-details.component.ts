import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, combineLatest, map, of, switchMap, tap } from 'rxjs';
import { I18nService } from '@shared/core/i18n.service';
import { isPlaceholderUrl, productIllustration } from '@shared/core/illustrations';
import { AuthService } from '@shared/core/auth.service';
import { AuthDrawerService } from './auth-drawer.service';
import { ProductReviews, PublicProductDetails,
  PublicVariant, PublicProductListItem } from '@shared/core/models';
import { GalleryComponent } from './gallery.component';
import { RevealDirective } from './motion.directives';
import { IconComponent } from '@shared/components/icon.component';
import { AssetUrlPipe, TranslatePipe } from '@shared/core/pipes';
import { PublicApiService } from '@shared/core/public-api.service';
import { SiteService } from '@shared/core/site.service';
import { ProductCardComponent } from './product-card.component';
import { ScrollerComponent } from './scroller.component';
import './storefront.i18n';
import { CartService } from './cart.service';
import { MoneyPipe } from './money.pipe';
import { ToastService } from '@shared/core/toast.service';

interface Loaded {
  product: PublicProductDetails;
  related: PublicProductListItem[];
}

@Component({
  selector: 'app-product-details',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe, AssetUrlPipe, IconComponent, ProductCardComponent, GalleryComponent, RevealDirective, MoneyPipe, ScrollerComponent],
  templateUrl: './product-details.component.html',
})
export class ProductDetailsComponent {
  private readonly api = inject(PublicApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly cart = inject(CartService);
  private readonly toast = inject(ToastService);
  private readonly i18nService = inject(I18nService);

  // Quantity picker of "Add to cart"
  readonly qty = signal(1);
  readonly fav = signal(false);

  // A light favourites list kept in this browser (no account needed), shared with the quick view
  toggleFav(id: number): void {
    let list: number[] = [];

    try {
      list = JSON.parse(localStorage.getItem('voltara.favs') ?? '[]');
    } catch {
      list = [];
    }

    const next = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];

    try {
      localStorage.setItem('voltara.favs', JSON.stringify(next));
    } catch {
      // storage can be blocked: the heart still shows for this visit
    }

    this.fav.set(next.includes(id));
  }

  isFav(id: number): boolean {
    try {
      return (JSON.parse(localStorage.getItem('voltara.favs') ?? '[]') as number[]).includes(id);
    } catch {
      return false;
    }
  }


  // The option values the shopper picked: option position -> value text (Size = "250 ml")
  readonly chosen = signal<Record<number, string>>({});

  // "Tell me when it is back" form
  readonly notifyEmail = signal('');
  readonly notifySent = signal(false);

  changeQty(delta: number, max: number | null): void {
    this.qty.update((q) => Math.max(1, Math.min(max ?? 99, 99, q + delta)));
  }

  discount(v: PublicVariant): number {
    return v.compareAtPrice && v.compareAtPrice > v.price ? Math.round((1 - v.price / v.compareAtPrice) * 100) : 0;
  }

  // Option groups (Size, Color ...) built from the variants' attributes
  optionGroups(p: PublicProductDetails): { index: number; name: string; values: { value: string; colorHex: string | null }[] }[] {
    const count = Math.max(0, ...p.variants.map((v) => v.attributes.length));
    const groups = [];

    for (let i = 0; i < count; i++) {
      const values: { value: string; colorHex: string | null }[] = [];

      for (const v of p.variants) {
        const a = v.attributes[i];
        if (a && !values.some((x) => x.value === a.value)) values.push({ value: a.value, colorHex: a.colorHex });
      }

      groups.push({ index: i, name: p.variants.find((v) => v.attributes[i])?.attributes[i].name ?? '', values });
    }

    return groups;
  }

  isChosen(index: number, value: string): boolean {
    return this.chosen()[index] === value;
  }

  // A value is dimmed when no variant with the other chosen values and this one can be bought
  canBuyWith(p: PublicProductDetails, index: number, value: string): boolean {
    const pick = { ...this.chosen(), [index]: value };

    return p.variants.some((v) => v.canBuy && v.attributes.every((a, i) => pick[i] === undefined || pick[i] === a.value));
  }

  choose(p: PublicProductDetails, index: number, value: string): void {
    const next = { ...this.chosen(), [index]: value };

    // If that combination does not exist, the other options jump to the closest one that does
    if (!this.match(p, next)) {
      const fallback = p.variants.find((v) => v.attributes[index]?.value === value);
      if (fallback) fallback.attributes.forEach((a, i) => (next[i] = a.value));
    }

    this.chosen.set(next);
    this.qty.set(1);
    this.notifySent.set(false);

    const image = this.match(p, next)?.imageUrl;
    if (image) this.selectedImage.set(image);
  }

  // The variant the shopper is looking at (null while the picked values match nothing)
  current(p: PublicProductDetails): PublicVariant | null {
    return this.match(p, this.chosen());
  }

  private match(p: PublicProductDetails, pick: Record<number, string>): PublicVariant | null {
    return p.variants.find((v) => v.attributes.every((a, i) => pick[i] === a.value)) ?? null;
  }

  // First view: the best variant is pre-selected (one you can buy, else the first)
  private preselect(p: PublicProductDetails): void {
    const best = p.variants.find((v) => v.canBuy) ?? p.variants[0];
    const pick: Record<number, string> = {};

    best?.attributes.forEach((a, i) => (pick[i] = a.value));
    this.chosen.set(pick);
    this.qty.set(1);
    this.notifySent.set(false);
  }

  addToCart(v: PublicVariant): void {
    this.cart.add(v.id, this.qty()).subscribe({
      next: () => this.qty.set(1),
      error: () => undefined,
    });
  }

  notifyMe(v: PublicVariant): void {
    const email = this.notifyEmail().trim();

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      this.toast.error(this.i18nService.t('contact.invalidEmail'));
      return;
    }

    this.api.requestStockNotification(v.id, email).subscribe({
      next: () => {
        this.notifySent.set(true);
        this.toast.success(this.i18nService.t('product.notifyDone'));
      },
      error: () => undefined,
    });
  }

  private readonly i18n = inject(I18nService);
  private readonly site = inject(SiteService);

  readonly product = signal<PublicProductDetails | null>(null);

  // The tab that is open (the first available one until the visitor chooses)
  // ---- reviews
  readonly reviews = signal<ProductReviews | null>(null);
  readonly auth = inject(AuthService);
  readonly authDrawer = inject(AuthDrawerService);
  rating = 5;
  reviewText = '';
  readonly sending = signal(false);
  readonly stars = [1, 2, 3, 4, 5];

  // The tabs under the product: only the ones that have something to show
  readonly tab = signal<'desc' | 'specs' | 'ship' | 'reviews'>('desc');

  tabs(p: PublicProductDetails): ('desc' | 'specs' | 'ship' | 'reviews')[] {
    const list: ('desc' | 'specs' | 'ship' | 'reviews')[] = [];

    if (p.description || (p.isBundle && p.bundleItems?.length)) list.push('desc');
    if (p.specifications.length > 0) list.push('specs');
    list.push('ship');
    if (this.reviews()?.enabled) list.push('reviews');

    return list;
  }

  activeTab(p: PublicProductDetails): 'desc' | 'specs' | 'ship' | 'reviews' {
    const list = this.tabs(p);

    return list.includes(this.tab()) ? this.tab() : list[0];
  }

  tabLabel(t: string): string {
    return { desc: 'product.description', specs: 'product.specs', ship: 'pd.shipReturn', reviews: 'review.title' }[t] ?? t;
  }

  loadReviews(slug: string): void {
    this.api.getReviews(slug).subscribe({ next: (r) => this.reviews.set(r), error: () => this.reviews.set(null) });
  }

  sendReview(p: PublicProductDetails): void {
    if (!this.reviewText.trim() || this.sending()) return;

    this.sending.set(true);
    this.api.submitReview(p.slug, this.rating, this.reviewText.trim()).subscribe({
      next: (published) => {
        this.sending.set(false);
        this.reviewText = '';
        this.toast.success(this.i18nService.t(published ? 'review.published' : 'review.pending'));
        this.loadReviews(p.slug);
      },
      error: () => this.sending.set(false),
    });
  }

  barWidth(r: ProductReviews, star: number): number {
    return r.count === 0 ? 0 : Math.round((r.distribution[star - 1] / r.count) * 100);
  }

  readonly related = signal<PublicProductListItem[]>([]);
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly selectedImage = signal<string>('');

  // First three "why choose us" points of the company
  readonly trust = computed(() => (this.site.home()?.features ?? []).slice(0, 3));

  // Real photos first; when the product has none, the matching illustration
  readonly images = computed(() => {
    const p = this.product();
    if (!p) return [];

    const real = [p.mainImageUrl, ...p.gallery.map((g) => g.url)].filter((u): u is string => !isPlaceholderUrl(u));

    return real.length > 0 ? [...new Set(real)] : [productIllustration(p.slug, p.categorySlug)];
  });

  constructor() {
    combineLatest([this.route.paramMap, toObservable(this.i18n.lang)])
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.notFound.set(false);
        }),
        switchMap(([params]) =>
          this.api.getProduct(params.get('slug') ?? '').pipe(
            switchMap((product) =>
              this.api.getProducts({ category: product.categorySlug, pageSize: 9 }).pipe(
                map((result): Loaded => ({
                  product,
                  related: result.items.filter((i) => i.slug !== product.slug).slice(0, 8),
                })),
                catchError(() => of<Loaded>({ product, related: [] })),
              ),
            ),
            catchError((error: HttpErrorResponse) => {
              this.notFound.set(error.status === 404);
              return of<Loaded | null>(null);
            }),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((loaded) => {
        this.product.set(loaded?.product ?? null);
        if (loaded?.product) this.loadReviews(loaded.product.slug);
        this.related.set(loaded?.related ?? []);
        this.selectedImage.set(this.images()[0] ?? '');
        if (loaded?.product) this.preselect(loaded.product);
        this.loading.set(false);
      });
  }
}
