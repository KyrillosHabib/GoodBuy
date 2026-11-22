import { HeroSlide } from '@shared/core/models';
import { NgTemplateOutlet } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { I18nService } from '@shared/core/i18n.service';
import { RevealDirective } from './motion.directives';
import { ScrollerComponent } from './scroller.component';
import { SliderComponent } from './slider.component';
import { IconComponent } from '@shared/components/icon.component';
import { AssetUrlPipe, CategoryImagePipe, ImageOrPipe, ProductImagePipe, TranslatePipe } from '@shared/core/pipes';
import { COLLAGE_LAYOUTS, Bi, LinkTarget, SectionCfg, isDarkColor, parseStorefront, pickText, resolveLink } from '@shared/core/storefront';
import { MoneyPipe } from './money.pipe';
import { SiteService } from '@shared/core/site.service';
import { ProductCardComponent } from './product-card.component';
import { CountdownComponent } from './countdown.component';
import { PublicApiService } from '@shared/core/public-api.service';
import { PublicProductListItem } from '@shared/core/models';
import './storefront.i18n';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, TranslatePipe, AssetUrlPipe, ImageOrPipe, CategoryImagePipe, IconComponent, ProductCardComponent, ScrollerComponent, SliderComponent, RevealDirective, CountdownComponent, NgTemplateOutlet, ProductImagePipe, MoneyPipe],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit, OnDestroy {

  readonly site = inject(SiteService);
  readonly i18n = inject(I18nService);

  private readonly api = inject(PublicApiService);
  private readonly sanitizer = inject(DomSanitizer);

  // The layout chosen in the dashboard (Website -> Storefront)
  readonly cfg = computed(() => parseStorefront(this.site.home()?.settings.storefrontJson));
  // The offer shown now in the strip: they follow each other
  readonly msgIdx = signal(0);
  private msgTimer: ReturnType<typeof setInterval> | null = null;
  readonly stripCol = computed(() => {
    const list = this.cfg().strip.columns.filter((c) => this.t(c.head));

    return list.length ? list[this.msgIdx() % list.length] : null;
  });

  togglePlay(v: HTMLVideoElement): void {
    if (v.paused) void v.play();
    else v.pause();
  }

  fullscreen(v: HTMLVideoElement): void {
    void (v.parentElement ?? v).requestFullscreen?.();
  }

  readonly offerProducts = signal<PublicProductListItem[]>([]);

  readonly stripEnds = computed(() => (this.cfg().strip.showCountdown ? (this.cfg().strip.endsAt || this.offerEnds()) : null));

  // The offer tiles: one per category that has products on sale - the best discount, else the lowest price
  readonly offerTiles = computed(() => {
    const map = new Map<string, { slug: string; name: string; image: string | null; maxOff: number; minPrice: number }>();

    for (const p of this.offerProducts()) {
      const off = p.price !== null && p.compareAtPrice && p.compareAtPrice > p.price ? Math.round((1 - p.price / p.compareAtPrice) * 100) : 0;
      const cur = map.get(p.categorySlug);

      if (!cur) map.set(p.categorySlug, { slug: p.categorySlug, name: p.categoryName, image: p.mainImageUrl, maxOff: off, minPrice: p.price ?? 0 });
      else {
        cur.maxOff = Math.max(cur.maxOff, off);
        cur.minPrice = Math.min(cur.minPrice, p.price ?? cur.minPrice);
        if (!cur.image) cur.image = p.mainImageUrl;
      }
    }

    return [...map.values()].slice(0, 8);
  });

  t(texts: Bi | null | undefined): string {
    return pickText(texts, this.i18n.lang());
  }

  // The pictures a shape uses (a 3-picture shape shows the first three)
  collageImages(s: SectionCfg) {
    const n = COLLAGE_LAYOUTS.find((l) => l.id === s.collage.layout)?.count ?? 0;

    const filled = s.collage.images.filter((i) => i.imageUrl);

    return n > 0 ? filled.slice(0, n) : filled;
  }

  go(l: LinkTarget) {
    return resolveLink(l);
  }

  // The background of a section: its colour, or its picture under a white / dark screen
  secBg(s: SectionCfg): string | null {
    if (s.bgImage) {
      const a = Math.min(100, Math.max(0, s.bgStrength ?? 55)) / 100;
      const screen = s.bgTone === 'light' ? `rgba(255,255,255,${a})` : `rgba(24,16,10,${a})`;
      const url = new AssetUrlPipe().transform(s.bgImage).replace(/["')]/g, (c) => encodeURIComponent(c));

      return `linear-gradient(${screen}, ${screen}), url("${url}") center / cover no-repeat`;
    }

    return s.bg || null;
  }

  // Light text over a dark colour or a dark screen
  secDark(s: SectionCfg): boolean {
    if (s.bgImage) return s.bgTone !== 'light';

    return !!s.bg && isDarkColor(s.bg);
  }

  // The offers block is dark by default
  secDarkOffers(s: SectionCfg): boolean {
    return !s.bg && !s.bgImage ? true : this.secDark(s);
  }

  isDark(color: string): boolean {
    return isDarkColor(color);
  }

  // A YouTube link plays inside the page; any other address is a video file
  embed(url: string): SafeResourceUrl | null {
    const m = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/i.exec(url);

    return m ? this.sanitizer.bypassSecurityTrustResourceUrl(`https://www.youtube.com/embed/${m[1]}?autoplay=1&mute=1&loop=1&playlist=${m[1]}&controls=0&rel=0`) : null;
  }

  // The product rows of a shop: new arrivals, offers, best sellers and packages (each shows only when it has products)
  readonly newArrivals = signal<PublicProductListItem[]>([]);
  readonly onSale = signal<PublicProductListItem[]>([]);
  readonly bestSellers = signal<PublicProductListItem[]>([]);
  readonly bundles = signal<PublicProductListItem[]>([]);
  readonly offerEnds = signal<string | null>(null);
  // How many auctions are running or coming: with none, the Auctions card says "coming soon"
  readonly auctionCount = signal(0);

  // The cards of Packages and Auctions among the categories: the picture is the one set in the dashboard (Page banners)
  tile(key: 'bundles' | 'auctions'): { image: string; name: string } {
    const b = this.cfg().pages[key];

    return { image: b.kind === 'video' ? b.posterUrl : b.url, name: pickText(b.title, this.i18n.lang()) || this.i18n.t(key === 'bundles' ? 'nav.bundles' : 'auction.title') };
  }

  constructor() {
    // The names come in the language of the page: read again when it changes
    effect(() => {
      this.i18n.lang();
      this.loadRows();
    });
  }

  private loadRows(): void {
    const row = (filter: { sort?: string; onSale?: boolean; bundles?: boolean }, target: { set(v: PublicProductListItem[]): void }) =>
      this.api.getProducts({ ...filter, pageSize: 10 }).subscribe({ next: (r) => target.set(r.items), error: () => target.set([]) });

    row({ sort: 'newest' }, this.newArrivals);
    row({ onSale: true }, this.onSale);
    this.api.getProducts({ onSale: true, pageSize: 50 }).subscribe({ next: (r) => this.offerProducts.set(r.items), error: () => this.offerProducts.set([]) });
    row({ sort: 'bestsellers' }, this.bestSellers);
    row({ bundles: true }, this.bundles);

    this.api.getAuctions().subscribe({ next: (a) => this.auctionCount.set(a.filter((x) => x.status !== 'ended').length), error: () => this.auctionCount.set(0) });
    this.api.getCurrentOffer().subscribe({ next: (o) => this.offerEnds.set(o.endsAtUtc), error: () => this.offerEnds.set(null) });
  }

  // ---- the cover slider (when the owner chose "slider" in the settings)
  readonly heroIndex = signal(0);
  private heroTimer: ReturnType<typeof setInterval> | null = null;
  private heroPaused = false;

  heroSlides(): HeroSlide[] {
    const s = this.site.home()?.settings;

    return s?.heroMode === 'slider' ? (s.heroSlides ?? []) : [];
  }

  // The text of the slide that is showing (empty = the text of the company page is used)
  private current(): HeroSlide | null {
    return this.heroSlides()[this.heroIndex()] ?? null;
  }

  private pick(texts: Record<string, string> | undefined): string {
    return texts?.[this.i18n.lang()]?.trim() || '';
  }

  slideTitle(): string {
    return this.pick(this.current()?.title);
  }

  slideSubtitle(): string {
    return this.pick(this.current()?.subtitle);
  }

  // The button of the slide: its own label and link (else the normal "Shop now" button is shown)
  slideButton(): { label: string; url: string; external: boolean } | null {
    const slide = this.current();
    const label = this.pick(slide?.buttonLabel);
    const url = slide?.buttonUrl?.trim();

    return label && url ? { label, url, external: /^https?:\/\//i.test(url) } : null;
  }

  heroGo(by: number): void {
    const n = this.heroSlides().length;

    if (n > 1) this.heroIndex.set((this.heroIndex() + by + n) % n);
  }

  heroPause(paused: boolean): void {
    this.heroPaused = paused;
  }

  ngOnInit(): void {
    // The pictures follow each other by themselves; pointing at the cover holds them
    this.msgTimer = setInterval(() => this.msgIdx.update((i) => i + 1), 4200);
    this.heroTimer = setInterval(() => {
      if (!this.heroPaused) this.heroGo(1);
    }, 6000);
  }

  ngOnDestroy(): void {
    if (this.heroTimer) clearInterval(this.heroTimer);
    if (this.msgTimer) clearInterval(this.msgTimer);
  }

  readonly whatsappLink = computed(() => {
    const digits = (this.site.home()?.company.whatsAppNumber ?? '').replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : null;
  });

}
