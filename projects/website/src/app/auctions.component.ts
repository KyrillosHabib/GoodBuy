import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { PublicAuction } from '@shared/core/models';
import { ProductImagePipe, TranslatePipe } from '@shared/core/pipes';
import { PublicApiService } from '@shared/core/public-api.service';
import { SiteService } from '@shared/core/site.service';
import { parseStorefront, pickText } from '@shared/core/storefront';
import { ToastService } from '@shared/core/toast.service';
import { MoneyPipe } from './money.pipe';
import { PageBannerComponent } from './page-banner.component';

// The auctions: running first, then the ones that start later, then the ones that ended.
// You can bid from the card, and every card says if you lead or were outbid; "My bids" gathers them at the top.
@Component({
  selector: 'app-auctions',
  standalone: true,
  imports: [FormsModule, RouterLink, PageBannerComponent, TranslatePipe, ProductImagePipe, MoneyPipe],
  templateUrl: './auctions.component.html',
})
export class AuctionsComponent implements OnInit, OnDestroy {
  private readonly api = inject(PublicApiService);
  private readonly site = inject(SiteService);
  private readonly i18n = inject(I18nService);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly banner = computed(() => {
    const b = parseStorefront(this.site.home()?.settings.storefrontJson).pages.auctions;

    return b.url ? b : null;
  });

  readonly bannerTitle = computed(() => {
    const b = this.banner();

    return b ? pickText(b.title, this.i18n.lang()) || this.i18n.t('auction.title') : '';
  });

  readonly items = signal<PublicAuction[]>([]);
  readonly loaded = signal(false);
  readonly busyId = signal<number | null>(null);

  // The auctions I bid in (a short log of where I stand)
  readonly mine = computed(() => this.items().filter((a) => a.myBestBid != null));

  // The amount typed in each card
  readonly amounts: Record<number, number | null> = {};

  private offsetMs = 0;
  private readonly now = signal(Date.now());
  private timers: ReturnType<typeof setInterval>[] = [];

  ngOnInit(): void {
    this.load();
    this.timers.push(setInterval(() => this.now.set(Date.now()), 1000));
    this.timers.push(setInterval(() => this.load(), 10000));
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearInterval);
  }

  private load(): void {
    this.api.getAuctions().subscribe({
      next: (a) => {
        if (a.length > 0) this.offsetMs = new Date(a[0].serverNowUtc).getTime() - Date.now();

        this.items.set(a);
        this.loaded.set(true);
      },
      error: () => this.loaded.set(true),
    });
  }

  // Where I stand in this auction: lead / outbid / none
  standing(a: PublicAuction): 'lead' | 'outbid' | null {
    if (a.isLeading) return 'lead';

    return a.myBestBid != null ? 'outbid' : null;
  }

  left(a: PublicAuction): string {
    const iso = a.status === 'scheduled' ? a.startsAtUtc : a.endsAtUtc;
    const s = Math.floor(Math.max(0, new Date(iso).getTime() - (this.now() + this.offsetMs)) / 1000);
    const d = Math.floor(s / 86400);
    const pad = (n: number) => String(n).padStart(2, '0');
    const clock = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

    return d > 0 ? `${d}d ${clock}` : clock;
  }

  // Three ready amounts: the lowest allowed bid, then one step and four steps above it (the step is the raise the owner set)
  quickAmounts(a: PublicAuction): number[] {
    const step = a.bidCount > 0 ? Math.max(1, a.minNextBid - a.currentPrice) : Math.max(1, Math.round(a.startingPrice * 0.05));
    const round = (n: number) => Math.round(n * 100) / 100;

    return [a.minNextBid, round(a.minNextBid + step), round(a.minNextBid + step * 4)];
  }

  bid(a: PublicAuction): void {
    const value = Number(this.amounts[a.id] ?? a.minNextBid);

    if (!(value > 0) || this.busyId() !== null) return;

    this.busyId.set(a.id);
    this.api.bid(a.id, value).subscribe({
      next: () => { this.busyId.set(null); this.amounts[a.id] = null; this.toast.success(this.i18n.t('auction.bidPlaced')); this.load(); },
      error: () => { this.busyId.set(null); this.load(); },
    });
  }
}
