import {
  AfterViewInit, Component, effect, ElementRef, HostBinding, Input, NgZone, OnDestroy, TemplateRef, ViewChild, computed, inject, signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { I18nService } from '@shared/core/i18n.service';

interface LoopEntry {
  key: number;
  item: unknown;
}

// Endless horizontal carousel (360°): the last card is followed by the first one again.
// It drifts slowly by itself, stops while the pointer is over it, and can be dragged / swiped.
//   <ng-template #tpl let-c> ...card... </ng-template>
//   <app-slider [items]="list" [template]="tpl" size="sm" />
@Component({
  selector: 'app-slider',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './slider.component.html',
  styleUrl: './slider.component.css',
})
export class SliderComponent implements AfterViewInit, OnDestroy {
  private readonly i18n = inject(I18nService);
  private readonly zone = inject(NgZone);

  // sm: category cards, md: product cards, xs: brand logos
  @Input() @HostBinding('attr.data-size') size: 'xs' | 'sm' | 'md' = 'md';
  @Input({ required: true }) template!: TemplateRef<unknown>;
  // Pixels per second of the automatic drift (0 = no drift)
  @Input() speed = 26;

  private readonly _items = signal<unknown[]>([]);
  private readonly repeat = signal(1);

  @Input({ required: true }) set items(value: unknown[]) {
    this._items.set(value ?? []);
    this.repeat.set(1);
    setTimeout(() => this.measure());
  }

  @ViewChild('viewport', { static: true }) viewport!: ElementRef<HTMLElement>;
  @ViewChild('track', { static: true }) track!: ElementRef<HTMLElement>;

  // Whether the strip is long enough to loop at all
  readonly looping = computed(() => this._items().length > 1);

  // [copy 1][copy 2][copy 3] of the (repeated) list: the view always stays inside the middle copy
  readonly entries = computed<LoopEntry[]>(() => {
    const base = this.i18n.isRtl() ? [...this._items()].reverse() : this._items();

    if (!this.looping()) return base.map((item, key) => ({ key, item }));

    const once = Array.from({ length: this.repeat() }, () => base).flat();
    const all = [...once, ...once, ...once];

    return all.map((item, key) => ({ key, item }));
  });

  private x = 0;            // current translateX in px
  private oneWidth = 0;     // width of one copy
  private velocity = 0;     // px per frame, from a drag release
  private hovering = false;
  private dragging = false;
  private visible = true;
  private lastX = 0;
  private startPointerX = 0;
  private startX = 0;
  private moved = 0;
  private pointerId: number | null = null;
  private frame = 0;
  private last = 0;
  private resize?: ResizeObserver;
  private io?: IntersectionObserver;

  constructor() {
    // Switching language flips the order of the cards: start again from the correct edge
    effect(() => {
      this.i18n.isRtl();
      setTimeout(() => {
        this.oneWidth = 0;
        this.measure();
      });
    });
  }

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.resize = new ResizeObserver(() => this.measure());
      this.resize.observe(this.viewport.nativeElement);

      this.io = new IntersectionObserver((e) => (this.visible = e.some((x) => x.isIntersecting)));
      this.io.observe(this.viewport.nativeElement);

      this.frame = requestAnimationFrame((t) => this.tick(t));
    });

    setTimeout(() => this.measure());
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.frame);
    this.resize?.disconnect();
    this.io?.disconnect();
  }

  // Works out the width of one copy; repeats a short list until one copy is wider than the view
  private measure(): void {
    if (!this.looping()) {
      this.track.nativeElement.style.transform = '';
      return;
    }

    const view = this.viewport.nativeElement.clientWidth;
    const kids = this.track.nativeElement.children;
    const per = kids.length / 3;

    // Exact width of one copy (cards + gaps): where the 2nd copy starts minus where the 1st starts
    const one = per >= 1 ? (kids[per] as HTMLElement).offsetLeft - (kids[0] as HTMLElement).offsetLeft : 0;

    if (!view || !one) return;

    if (one < view * 1.1 && this.repeat() < 12) {
      this.zone.run(() => this.repeat.update((r) => r + Math.max(1, Math.ceil((view * 1.1) / one) - 1)));
      setTimeout(() => this.measure());
      return;
    }

    const first = this.oneWidth === 0;

    this.oneWidth = one;

    if (first || this.x > -one || this.x <= -2 * one) {
      // Arabic: the first card sits at the RIGHT edge, English: at the left edge
      const gap = parseFloat(getComputedStyle(this.track.nativeElement).columnGap) || 0;

      this.x = this.i18n.isRtl() ? view - 2 * one + gap : -one;
    }

    this.apply();
  }

  private apply(): void {
    const w = this.oneWidth;

    if (w > 0) {
      while (this.x > -w) this.x -= w;
      while (this.x <= -2 * w) this.x += w;
    }

    this.track.nativeElement.style.transform = `translate3d(${this.x}px,0,0)`;
  }

  private tick(now: number): void {
    const dt = this.last ? Math.min(64, now - this.last) : 16;
    this.last = now;

    if (this.looping() && this.oneWidth > 0 && this.visible && !this.dragging) {
      const calm = document.documentElement.classList.contains('no-anim') || document.hidden;

      if (Math.abs(this.velocity) > 0.05) {
        this.x += this.velocity * (dt / 16);
        this.velocity *= 0.94;
      } else if (!this.hovering && !calm && this.speed > 0) {
        this.x -= (this.speed * dt) / 1000;
      }

      this.apply();
    }

    this.frame = requestAnimationFrame((t) => this.tick(t));
  }

  enter(): void {
    this.hovering = true;
  }

  leave(): void {
    this.hovering = false;
  }

  down(e: PointerEvent): void {
    if (!this.looping() || (e.pointerType === 'mouse' && e.button !== 0)) return;

    this.dragging = true;
    this.pointerId = e.pointerId;
    this.startPointerX = e.clientX;
    this.lastX = e.clientX;
    this.startX = this.x;
    this.moved = 0;
    this.velocity = 0;
  }

  move(e: PointerEvent): void {
    if (!this.dragging || e.pointerId !== this.pointerId) return;

    const dx = e.clientX - this.startPointerX;

    this.moved = Math.max(this.moved, Math.abs(dx));

    if (this.moved > 4 && !this.viewport.nativeElement.hasPointerCapture(e.pointerId)) {
      this.viewport.nativeElement.setPointerCapture(e.pointerId);
    }

    this.velocity = (e.clientX - this.lastX) * 1.0;
    this.lastX = e.clientX;
    this.x = this.startX + dx;
    this.apply();
  }

  up(e: PointerEvent): void {
    if (!this.dragging || e.pointerId !== this.pointerId) return;

    this.dragging = false;
    this.pointerId = null;
  }

  // A drag must not open the card under the pointer
  click(e: MouseEvent): void {
    if (this.moved > 6) {
      e.preventDefault();
      e.stopPropagation();
    }

    this.moved = 0;
  }
}
