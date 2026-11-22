import './storefront.i18n';
import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { buildMapEmbed } from '@shared/core/maps';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { IconComponent } from '@shared/components/icon.component';
import { I18nService } from '@shared/core/i18n.service';
import { AssetUrlPipe, TranslatePipe } from '@shared/core/pipes';
import { AuthService } from '@shared/core/auth.service';
import { CartService } from './cart.service';
import { WheelComponent } from './wheel.component';
import { AuthDrawerComponent } from './auth-drawer.component';
import { AuthDrawerService } from './auth-drawer.service';
import { CartDrawerComponent } from './cart-drawer.component';
import { SiteService } from '@shared/core/site.service';
import { parseStorefront, pickText } from '@shared/core/storefront';
import { ProductImagePipe } from '@shared/core/pipes';
import { PublicApiService } from '@shared/core/public-api.service';
import { PublicProductListItem } from '@shared/core/models';

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe, AssetUrlPipe, ProductImagePipe, IconComponent, CartDrawerComponent, WheelComponent, AuthDrawerComponent],
  templateUrl: './public-layout.component.html',
})
export class PublicLayoutComponent {
  private readonly site = inject(SiteService);
  readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  readonly cart = inject(CartService);
  readonly authDrawer = inject(AuthDrawerService);

  private readonly sanitizer = inject(DomSanitizer);

  private readonly api = inject(PublicApiService);

  readonly menuOpen = signal(false);
  readonly showTop = signal(false);
  // The products shown when the mouse is over New / Offers / Best sellers in the menu (read once, on the first hover)
  readonly drops = signal<Record<string, { slug: string; name: string; items: PublicProductListItem[] }[]>>({});

  constructor() {
    // The names come in the language of the page: read again after a switch
    effect(() => {
      this.i18n.lang();
      this.drops.set({});
    });
  }

  // Each menu shows the categories side by side, with their products under the name
  // The open menu: it stays a moment after the mouse leaves, so crossing the small gap to the list does not close it
  readonly openDrop = signal<string | null>(null);
  private dropTimer: ReturnType<typeof setTimeout> | null = null;

  showDrop(key: 'all' | 'new' | 'offers' | 'best'): void {
    if (this.dropTimer) clearTimeout(this.dropTimer);

    this.openDrop.set(key);
    this.loadDrop(key);
  }

  hideDrop(): void {
    if (this.dropTimer) clearTimeout(this.dropTimer);

    this.dropTimer = setTimeout(() => this.openDrop.set(null), 350);
  }

  loadDrop(key: 'all' | 'new' | 'offers' | 'best'): void {
    if (this.drops()[key]) return;

    const filter = key === 'new' ? { sort: 'newest' } : key === 'offers' ? { onSale: true } : key === 'best' ? { sort: 'bestsellers' } : { sort: 'newest' };

    this.drops.update((d) => ({ ...d, [key]: [] }));
    this.api.getProducts({ ...filter, pageSize: 50 }).subscribe({
      next: (r) => {
        const map = new Map<string, { slug: string; name: string; items: PublicProductListItem[] }>();

        for (const p of r.items) {
          const g = map.get(p.categorySlug) ?? { slug: p.categorySlug, name: p.categoryName, items: [] };

          if (g.items.length < 6) g.items.push(p);
          map.set(p.categorySlug, g);
        }

        this.drops.update((d) => ({ ...d, [key]: [...map.values()] }));
      },
      error: () => undefined,
    });
  }

  toTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  readonly mapOpen = signal(false);
  readonly progress = signal(0);
  readonly scrolled = signal(false);
  readonly spy = signal<string | null>(null);
  readonly year = new Date().getFullYear();

  readonly company = computed(() => this.site.home()?.company ?? null);
  readonly settings = computed(() => this.site.home()?.settings ?? null);
  readonly categories = computed(() => this.site.home()?.categories ?? []);

  // The plain news line above the navigation bar (messages, colours and on/off come from the dashboard)
  readonly topbar = computed(() => {
    const tb = parseStorefront(this.settings()?.storefrontJson).topbar;
    const lang = this.i18n.lang();
    const msgs = tb.messages.map((m) => pickText(m, lang)).filter((m) => !!m);

    return tb.enabled && msgs.length > 0 ? { bg: tb.bg, color: tb.color, msgs } : null;
  });
  readonly socials = computed(() => this.company()?.socialLinks ?? []);


  readonly whatsappLink = computed(() => {
    const digits = (this.company()?.whatsAppNumber ?? '').replace(/\D/g, '');
    return digits ? `https://wa.me/${digits}` : null;
  });

  // Footer map: the map link / address chosen in the dashboard
  readonly mapSrc = computed<SafeResourceUrl | null>(() => {
    const c = this.company();
    const url = buildMapEmbed(c?.mapEmbedUrl) ?? buildMapEmbed(c?.address);

    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  });

  // "Open in Google Maps": the pasted page link, otherwise a search for the text / address
  mapsLink(): string {
    const c = this.company();
    const raw = (c?.mapEmbedUrl ?? '').trim();

    if (/^https?:\/\//i.test(raw) && !/\/maps\/embed/i.test(raw)) return raw;

    const query = raw && !/^https?:\/\//i.test(raw) ? raw : (c?.address ?? '');

    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
  }

  // Reading progress bar, shrinking header and "you are here" highlight in the menu
  @HostListener('window:scroll')
  onScroll(): void {
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;

    this.progress.set(max > 0 ? Math.min(1, window.scrollY / max) : 0);
    this.scrolled.set(window.scrollY > 24);
    this.showTop.set(window.scrollY > 600);

  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.mapOpen.set(false);
  }
}
