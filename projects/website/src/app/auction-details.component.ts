import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { PublicAuctionDetails } from '@shared/core/models';
import { ProductImagePipe, TranslatePipe } from '@shared/core/pipes';
import { PublicApiService } from '@shared/core/public-api.service';
import { ToastService } from '@shared/core/toast.service';
import { MoneyPipe } from './money.pipe';

// One auction: the price now, the time left (counted from the SERVER clock), the bids, and the bid box
@Component({
  selector: 'app-auction-details',
  standalone: true,
  imports: [FormsModule, RouterLink, TranslatePipe, ProductImagePipe, MoneyPipe],
  templateUrl: './auction-details.component.html',
})
export class AuctionDetailsComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PublicApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);

  readonly data = signal<PublicAuctionDetails | null>(null);
  readonly busy = signal(false);
  amount: number | null = null;

  // The difference between the server clock and this browser's clock (the countdown must not trust the visitor's clock)
  private offsetMs = 0;
  private readonly now = signal(Date.now());
  private timers: ReturnType<typeof setInterval>[] = [];
  private id = 0;

  readonly left = computed(() => this.countdown(this.data()?.auction.endsAtUtc));
  // The time left as days / hours / minutes / seconds (shown as four boxes)
  readonly parts = computed(() => {
    const a = this.data()?.auction;
    const iso = a?.status === 'scheduled' ? a.startsAtUtc : a?.endsAtUtc;
    const s = iso ? Math.floor(Math.max(0, new Date(iso).getTime() - (this.now() + this.offsetMs)) / 1000) : 0;

    return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
  });

  // Three ready amounts: the lowest allowed bid, then one step and four steps above it
  readonly quickAmounts = computed(() => {
    const a = this.data()?.auction;

    if (!a) return [];

    const step = a.bidCount > 0 ? Math.max(1, a.minNextBid - a.currentPrice) : Math.max(1, Math.round(a.startingPrice * 0.05));
    const round = (n: number) => Math.round(n * 100) / 100;

    return [a.minNextBid, round(a.minNextBid + step), round(a.minNextBid + step * 4)];
  });

  readonly untilStart = computed(() => this.countdown(this.data()?.auction.startsAtUtc));

  ngOnInit(): void {
    this.id = Number(this.route.snapshot.paramMap.get('id'));
    this.load();
    this.timers.push(setInterval(() => this.now.set(Date.now()), 1000));
    // The price and the bids follow what other people do
    this.timers.push(setInterval(() => this.load(), 8000));
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearInterval);
  }

  private load(): void {
    this.api.getAuction(this.id).subscribe({
      next: (d) => {
        this.offsetMs = new Date(d.auction.serverNowUtc).getTime() - Date.now();
        this.data.set(d);
      },
      error: () => undefined,
    });
  }

  private countdown(iso: string | undefined): string {
    if (!iso) return '';

    const ms = Math.max(0, new Date(iso).getTime() - (this.now() + this.offsetMs));
    const s = Math.floor(ms / 1000);
    const d = Math.floor(s / 86400);
    const pad = (n: number) => String(n).padStart(2, '0');
    const clock = `${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;

    return d > 0 ? `${d}d ${clock}` : clock;
  }

  time(iso: string): string {
    return new Date(iso).toLocaleString(this.i18n.lang() === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
  }

  bid(): void {
    const value = Number(this.amount);

    if (!(value > 0) || this.busy()) return;

    this.busy.set(true);
    this.api.bid(this.id, value).subscribe({
      next: () => { this.busy.set(false); this.amount = null; this.toast.success(this.i18n.t('auction.bidPlaced')); this.load(); },
      error: () => { this.busy.set(false); this.load(); },
    });
  }
}
