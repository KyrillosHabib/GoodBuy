import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { I18nService } from '@shared/core/i18n.service';
import { WheelPublic, WheelSpinResult } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { PublicApiService } from '@shared/core/public-api.service';
import { WHEEL_COUPON_KEY } from './coupon-box.component';

const TOKEN_KEY = 'voltara_visitor';
const SHOWN_KEY = 'voltara_wheel_shown';
// The wheel wears the colours of the site theme: the theme colour, white and a soft tint of the theme (text colours to match)
const TONES: { fill: string; text: string }[] = [
  { fill: 'var(--primary)', text: 'var(--on-primary, #fff)' },
  { fill: '#ffffff', text: '#111111' },
  { fill: 'var(--primary-soft)', text: '#111111' },
];

// The wheel of fortune. IT ONLY DRAWS: the server decides the winning slice and creates the coupon; this component receives
// the result and turns the wheel to the slice the server named. Changing anything here changes nothing for the visitor's prize.
@Component({
  selector: 'app-wheel',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  templateUrl: './wheel.component.html',
})
export class WheelComponent implements OnInit, OnDestroy {
  private readonly api = inject(PublicApiService);
  private readonly router = inject(Router);
  private readonly i18n = inject(I18nService);

  readonly data = signal<WheelPublic | null>(null);
  // peek: two thirds of the wheel visible on the side · open: the panel · tucked: a small tab (the visitor pressed x)
  readonly state = signal<'peek' | 'open' | 'tucked' | 'gone'>('peek');
  readonly spinning = signal(false);
  readonly rotation = signal(0);
  readonly result = signal<WheelSpinResult | null>(null);
  readonly error = signal('');
  readonly copied = signal(false);
  email = '';

  private token = '';
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: WheelSpinResult | null = null;

  // The slices are drawn all the same size (the chances are the server's secret): only the look is computed here
  readonly slices = computed(() => {
    const list = this.data()?.slices ?? [];
    const n = Math.max(1, list.length);
    const step = (2 * Math.PI) / n;
    const r = 105;

    return list.map((s, i) => {
      // Slice 0 is centred on the top; the wheel turns clockwise
      const a0 = i * step - step / 2 - Math.PI / 2;
      const a1 = a0 + step;
      const p = (a: number) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`;
      const mid = (a0 + a1) / 2;
      const deg = (mid * 180) / Math.PI;

      return {
        id: s.id,
        label: s.label,
        // the last slice never takes the tone of the first one it touches
        color: (list.length > 1 && i === list.length - 1 && i % TONES.length === 0 ? TONES[2] : TONES[i % TONES.length]).fill,
        textColor: (list.length > 1 && i === list.length - 1 && i % TONES.length === 0 ? TONES[2] : TONES[i % TONES.length]).text,
        path: `M 0 0 L ${p(a0)} A ${r} ${r} 0 0 1 ${p(a1)} Z`,
        textTransform: `rotate(${deg.toFixed(1)}) translate(${(r * 0.62).toFixed(1)} 0) rotate(${deg > 90 && deg < 270 ? 180 : 0})`,
      };
    });
  });

  ngOnInit(): void {
    this.token = this.visitorToken();

    this.api.getWheel(this.token).subscribe({
      next: (w) => {
        this.data.set(w);

        // The dock is always there while the wheel is on (it never pops up by itself); the delay of the campaign only decides
        // when the dock first slides in
        if (!w.enabled) return;

        this.state.set('gone');
        this.timer = setTimeout(() => this.state.set(this.savedState()), Math.max(0, w.showDelaySeconds) * 1000);
      },
      error: () => undefined,
    });
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  // A random id for this browser (guests): the server counts the spins per id, per e-mail and per internet address
  private visitorToken(): string {
    try {
      let t = localStorage.getItem(TOKEN_KEY);

      if (!t) {
        t = crypto.randomUUID();
        localStorage.setItem(TOKEN_KEY, t);
      }

      return t;
    } catch {
      return crypto.randomUUID();
    }
  }

  private savedState(): 'peek' | 'tucked' {
    try { return sessionStorage.getItem(SHOWN_KEY) === 'tucked' ? 'tucked' : 'peek'; } catch { return 'peek'; }
  }

  expand(): void {
    this.state.set('open');
  }

  // The x: the panel goes back to the edge; pressing x on the peeking wheel tucks it into a small tab
  collapse(): void {
    if (this.spinning()) return;

    const next = this.state() === 'open' ? 'peek' : 'tucked';
    this.state.set(next);

    try { sessionStorage.setItem(SHOWN_KEY, next); } catch { /* storage blocked */ }
  }

  date(iso: string): string {
    return new Date(iso).toLocaleDateString(this.i18n.lang() === 'ar' ? 'ar-EG' : 'en-GB');
  }

  spin(): void {
    const w = this.data();

    if (!w || this.spinning()) return;

    if (w.needsEmail && !/^\S+@\S+\.\S+$/.test(this.email.trim())) {
      this.error.set(this.i18n.t('wheel.emailInvalid'));
      return;
    }

    this.error.set('');
    this.spinning.set(true);

    // 1) the SERVER draws the result  2) the wheel turns to the slice the server named
    this.api.spinWheel(this.token, this.email.trim() || undefined).subscribe({
      next: (r) => {
        const index = Math.max(0, w.slices.findIndex((s) => s.id === r.sliceId));
        const step = 360 / Math.max(1, w.slices.length);

        this.pending = r;
        // Slice `index` is centred at index*step (clockwise from the top): turn so that it ends under the pointer
        this.rotation.update((current) => current + 360 * 6 + (360 - (current % 360)) + (360 - index * step) % 360);
      },
      error: (e) => {
        this.spinning.set(false);
        this.error.set(e?.error?.title ? this.i18n.t(`api:${e.error.title}`) : this.i18n.t('wheel.failed'));
        this.api.getWheel(this.token).subscribe((fresh) => this.data.set(fresh));
      },
    });
  }

  finished(): void {
    if (!this.spinning() || !this.pending) return;

    const r = this.pending;
    this.pending = null;
    this.spinning.set(false);
    this.result.set(r);
    this.data.update((d) => (d ? { ...d, spinsLeft: r.spinsLeft, enabled: true } : d));

    // The coupon is kept in the browser so that the cart can offer it
    if (r.coupon) {
      try { localStorage.setItem(WHEEL_COUPON_KEY, r.coupon.code); } catch { /* storage blocked */ }
    }
  }

  again(): void {
    this.result.set(null);
  }

  copy(code: string): void {
    void navigator.clipboard?.writeText(code).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  useCoupon(code: string): void {
    try { localStorage.setItem(WHEEL_COUPON_KEY, code); } catch { /* storage blocked */ }

    this.state.set('peek');
    void this.router.navigate(['/cart']);
  }
}
