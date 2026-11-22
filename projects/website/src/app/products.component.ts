import './storefront.i18n';
import { Location } from '@angular/common';
import { Component, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, combineLatest, of, switchMap, tap } from 'rxjs';
import { I18nService } from '@shared/core/i18n.service';
import { PagedResult, ProductFacets, PublicProductListItem } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { PublicApiService } from '@shared/core/public-api.service';
import { SiteService } from '@shared/core/site.service';
import { RevealDirective } from './motion.directives';
import { PagerComponent } from '@shared/components/pager.component';
import { ProductCardComponent } from './product-card.component';

// The shop: a side panel of filters (price, categories, brands, every option of the products, availability, sale) and the products.
// The filters live in the address bar (a link to a filtered shop can be shared, and Back works).
import { PageKey, parseStorefront, pickText } from '@shared/core/storefront';
import { PageBannerComponent } from './page-banner.component';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe, PageBannerComponent, ProductCardComponent, PagerComponent, RevealDirective],
  templateUrl: './products.component.html',
})
export class ProductsComponent {
  private readonly api = inject(PublicApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);
  private readonly location = inject(Location);
  readonly site = inject(SiteService);

  readonly facets = signal<ProductFacets | null>(null);
  readonly result = signal<PagedResult<PublicProductListItem> | null>(null);
  readonly loading = signal(true);
  readonly filtersOpen = signal(false);
  readonly sortOpen = signal(false);

  readonly sortOptions = [
    { value: '', key: 'shop.sortDefault' },
    { value: 'bestsellers', key: 'home.best' },
    { value: 'newest', key: 'shop.sortNewest' },
    { value: 'price_asc', key: 'shop.sortPriceAsc' },
    { value: 'price_desc', key: 'shop.sortPriceDesc' },
    { value: 'name_asc', key: 'shop.sortNameAsc' },
    { value: 'name_desc', key: 'shop.sortNameDesc' },
  ];

  readonly collectionList = [
    { id: 'all', key: 'shop.all' },
    { id: 'new', key: 'nav.new' },
    { id: 'best', key: 'nav.best' },
    { id: 'offers', key: 'nav.offers' },
    { id: 'bundles', key: 'nav.bundles' },
  ];

  // The tab that is on: a collection (new, best sellers, offers, packages), one category, or everything
  readonly coll = computed(() => {
    if (this.bundles()) return 'bundles';
    if (this.onSale()) return 'offers';
    if (this.sort() === 'newest') return 'new';
    if (this.sort() === 'bestsellers') return 'best';
    if (this.selCats().length === 1) return 'cat:' + this.selCats()[0];

    return 'all';
  });

  readonly sortLabel = computed(() => {
    const o = this.sortOptions.find((x) => x.value === this.sort());

    return o && o.value ? this.i18n.t(o.key) : '';
  });

  // How many cards fit in a row (2 to 5): saved in the browser; the page holds 4 rows
  readonly densities = [3, 4, 5, 6];
  readonly cols = signal(this.savedCols());

  // What is chosen (read from the address bar)
  readonly selCats = signal<string[]>([]);
  readonly selBrands = signal<number[]>([]);
  readonly selAttrs = signal<string[]>([]);
  readonly inStock = signal(false);
  readonly onSale = signal(false);
  readonly bundles = signal(false);
  readonly sort = signal('');
  readonly minPrice = signal<number | null>(null);
  readonly maxPrice = signal<number | null>(null);

  // The two ends of the price slider while it is dragged
  priceFrom = 0;
  priceTo = 0;

  private readonly brandId = signal<number | null>(null);
  readonly activeBrand = computed(() => this.site.home()?.brands.find((b) => b.id === this.brandId()) ?? null);

  // How many filters are on (shown on the button of the mobile panel)
  readonly activeCount = computed(
    () => this.selCats().length + this.selBrands().length + this.selAttrs().length + (this.inStock() ? 1 : 0) + (this.onSale() ? 1 : 0) + (this.minPrice() !== null || this.maxPrice() !== null ? 1 : 0),
  );

  search = '';

  // The choices that are on, as small chips with a cross (shown under the toolbar)
  readonly chips = computed(() => {
    const f = this.facets();
    const out: { key: string; label: string; remove: () => void }[] = [];

    for (const s of this.selCats()) out.push({ key: 'c' + s, label: f?.categories.find((c) => c.slug === s)?.name ?? s, remove: () => this.toggleCategory(s) });
    for (const b of this.selBrands()) out.push({ key: 'b' + b, label: f?.brands.find((x) => x.id === b)?.name ?? String(b), remove: () => this.toggleBrand(b) });
    for (const a of this.selAttrs()) out.push({ key: 'a' + a, label: a.replace('|', ': '), remove: () => this.navigate({ attr: this.selAttrs().filter((x) => x !== a), page: null }) });
    if (this.inStock()) out.push({ key: 'stock', label: this.i18n.t('shop.inStock'), remove: () => this.toggleFlag('inStock') });
    if (this.onSale()) out.push({ key: 'sale', label: this.i18n.t('shop.onSale'), remove: () => this.toggleFlag('onSale') });
    if (this.bundles()) out.push({ key: 'bundles', label: this.i18n.t('home.bundles'), remove: () => this.navigate({ bundles: null, page: null }) });
    if (this.minPrice() !== null || this.maxPrice() !== null) {
      out.push({ key: 'price', label: `${this.minPrice() ?? f?.minPrice ?? 0} – ${this.maxPrice() ?? f?.maxPrice ?? ''}`, remove: () => this.navigate({ min: null, max: null, page: null }) });
    }

    return out;
  });

  readonly activeCategoryName = computed(() => {
    const one = this.selCats().length === 1 ? this.selCats()[0] : null;

    return one ? (this.facets()?.categories.find((c) => c.slug === one)?.name ?? null) : null;
  });

  // The name of what is shown (the heading of the page)
  readonly title = computed(() => {
    const c = this.coll();

    if (c.startsWith('cat:')) return this.activeCategoryName() ?? this.i18n.t('nav.products');

    return this.i18n.t(c === 'new' ? 'nav.new' : c === 'best' ? 'nav.best' : c === 'offers' ? 'nav.offers' : c === 'bundles' ? 'nav.bundles' : 'nav.products');
  });

  // The picture / video the owner put over this page (dashboard: Storefront -> Page banners); none = the plain heading
  readonly banner = computed(() => {
    const c = this.coll();
    const key: PageKey = c === 'new' || c === 'best' || c === 'offers' || c === 'bundles' ? c : 'products';
    const b = parseStorefront(this.site.home()?.settings.storefrontJson).pages[key];

    return b.url ? b : null;
  });

  readonly bannerTitle = computed(() => {
    const b = this.banner();

    if (!b) return '';

    return this.coll().startsWith('cat:') ? this.title() : pickText(b.title, this.i18n.lang()) || this.title();
  });

  back(): void {
    if (window.history.length > 1) this.location.back();
    else void this.router.navigate(['/']);
  }

  closeFilters(): void {
    this.filtersOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeFilters();
  }

  // Apply = the choices already filter the shop (they are in the address bar): the panel only closes
  apply(): void {
    this.applySearch();
    this.closeFilters();
  }

  clearAndClose(): void {
    this.clearAll();
    this.navigate({ search: null, sort: null, bundles: null, page: null });
    this.search = '';
    this.closeFilters();
  }

  constructor() {
    const lang$ = toObservable(this.i18n.lang);
    const cols$ = toObservable(this.cols);

    // The things the shop can be filtered by (names depend on the language)
    lang$
      .pipe(
        switchMap(() => this.api.getFacets().pipe(catchError(() => of(null)))),
        takeUntilDestroyed(),
      )
      .subscribe((f) => {
        this.facets.set(f);

        if (f) {
          this.priceFrom = this.minPrice() ?? f.minPrice;
          this.priceTo = this.maxPrice() ?? f.maxPrice;
        }
      });

    // Products: reload when the address bar, the language or the number of cards per row changes
    combineLatest([this.route.queryParamMap, lang$, cols$])
      .pipe(
        tap(([params]) => {
          this.loading.set(true);

          const cats = (params.get('cats') ?? '').split(',').filter(Boolean);
          const single = params.get('category');

          this.selCats.set(single && !cats.includes(single) ? [...cats, single] : cats);
          this.selBrands.set((params.get('brands') ?? '').split(',').map(Number).filter((n) => n > 0));
          this.selAttrs.set(params.getAll('attr'));
          this.inStock.set(params.get('inStock') === '1');
          this.onSale.set(params.get('onSale') === '1');
          this.bundles.set(params.get('bundles') === '1');
          this.sort.set(params.get('sort') ?? '');
          this.minPrice.set(params.has('min') ? Number(params.get('min')) : null);
          this.maxPrice.set(params.has('max') ? Number(params.get('max')) : null);
          this.brandId.set(Number(params.get('brand')) || null);
          this.search = params.get('search') ?? '';

          const f = this.facets();

          if (f) {
            this.priceFrom = this.minPrice() ?? f.minPrice;
            this.priceTo = this.maxPrice() ?? f.maxPrice;
          }
        }),
        switchMap(([params]) =>
          this.api
            .getProducts({
              brand: Number(params.get('brand')) || undefined,
              search: params.get('search') ?? undefined,
              categories: this.selCats(),
              brands: this.selBrands(),
              attr: this.selAttrs(),
              inStock: this.inStock(),
              onSale: this.onSale(),
              bundles: this.bundles(),
              sort: this.sort() || undefined,
              minPrice: this.minPrice() ?? undefined,
              maxPrice: this.maxPrice() ?? undefined,
              page: Number(params.get('page')) || 1,
              pageSize: this.cols() * 4,
            })
            .pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.result.set(result);
        this.loading.set(false);
      });
  }

  range(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  setCols(n: number): void {
    this.cols.set(n);

    try { localStorage.setItem('voltara_shop_cols', String(n)); } catch { /* storage blocked */ }
  }

  private savedCols(): number {
    try {
      const n = Number(localStorage.getItem('voltara_shop_cols'));

      return [3, 4, 5, 6].includes(n) ? n : 4;
    } catch {
      return 4;
    }
  }

  // ---------- choosing
  toggleCategory(slug: string): void {
    const list = this.selCats().includes(slug) ? this.selCats().filter((c) => c !== slug) : [...this.selCats(), slug];

    this.navigate({ cats: list.join(',') || null, category: null, page: null });
  }

  toggleBrand(id: number): void {
    const list = this.selBrands().includes(id) ? this.selBrands().filter((b) => b !== id) : [...this.selBrands(), id];

    this.navigate({ brands: list.join(',') || null, page: null });
  }

  attrKey(name: string, value: string): string {
    return `${name}|${value}`;
  }

  isAttr(name: string, value: string): boolean {
    return this.selAttrs().includes(this.attrKey(name, value));
  }

  toggleAttr(name: string, value: string): void {
    const key = this.attrKey(name, value);
    const list = this.selAttrs().includes(key) ? this.selAttrs().filter((a) => a !== key) : [...this.selAttrs(), key];

    this.navigate({ attr: list.length > 0 ? list : null, page: null });
  }

  toggleFlag(name: 'inStock' | 'onSale'): void {
    const on = name === 'inStock' ? this.inStock() : this.onSale();

    this.navigate({ [name]: on ? null : '1', page: null });
  }

  applyPrice(): void {
    const f = this.facets();
    const from = Math.min(this.priceFrom, this.priceTo);
    const to = Math.max(this.priceFrom, this.priceTo);

    this.navigate({
      min: f && from <= f.minPrice ? null : from,
      max: f && to >= f.maxPrice ? null : to,
      page: null,
    });
  }

  clearAll(): void {
    this.navigate({ cats: null, category: null, brands: null, attr: null, inStock: null, onSale: null, min: null, max: null, page: null });
  }

  // A tab or a collection of the panel: it resets the other choices that make a collection
  setCollection(id: string): void {
    const base = { cats: null, category: null, onSale: null, bundles: null, sort: null, page: null } as Record<string, string | number | null>;

    if (id === 'new') base['sort'] = 'newest';
    else if (id === 'best') base['sort'] = 'bestsellers';
    else if (id === 'offers') base['onSale'] = '1';
    else if (id === 'bundles') base['bundles'] = '1';
    else if (id.startsWith('cat:')) base['category'] = id.slice(4);

    this.navigate(base);
  }

  pickSort(value: string): void {
    this.sortOpen.set(false);
    this.setSort(value);
  }

  setSort(value: string): void {
    this.navigate({ sort: value || null, page: null });
  }

  clearBrand(): void {
    this.navigate({ brand: null, page: null });
  }

  applySearch(): void {
    this.navigate({ search: this.search.trim() || null, page: null });
  }

  goTo(page: number): void {
    this.navigate({ page });
  }

  private navigate(queryParams: Record<string, string | number | string[] | null>): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      queryParamsHandling: 'merge',
    });
  }
}
