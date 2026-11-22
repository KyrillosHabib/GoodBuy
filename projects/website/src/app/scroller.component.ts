import { NgTemplateOutlet } from '@angular/common';
import {
  AfterViewInit, Component, ElementRef, HostBinding, Input, OnDestroy, TemplateRef, ViewChild, signal,
} from '@angular/core';

// A row of cards that stays a plain row while everything fits on the screen (nothing is repeated).
// Only when there are more cards than the screen holds do two soft arrows and one dot per position appear.
// You can also drag it with the mouse. Direction follows the page (Arabic starts at the right).
//   <ng-template #tpl let-c> ...card... </ng-template>
//   <app-scroller [items]="list" [template]="tpl" size="sm" />
@Component({
  selector: 'app-scroller',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './scroller.component.html',
  styleUrl: './scroller.component.css',
})
export class ScrollerComponent implements AfterViewInit, OnDestroy {
  @Input() @HostBinding('attr.data-size') size: 'sm' | 'md' = 'sm';
  @Input({ required: true }) template!: TemplateRef<unknown>;

  readonly list = signal<unknown[]>([]);

  @Input({ required: true }) set items(value: unknown[]) {
    this.list.set(value ?? []);
    setTimeout(() => this.update());
  }

  @ViewChild('track', { static: true }) track!: ElementRef<HTMLElement>;

  readonly canPrev = signal(false);
  readonly canNext = signal(false);
  readonly positions = signal<number[]>([]);
  readonly active = signal(0);

  dragging = false;

  private startX = 0;
  private startScroll = 0;
  private moved = 0;
  private pointerId: number | null = null;
  private resize?: ResizeObserver;

  ngAfterViewInit(): void {
    this.resize = new ResizeObserver(() => this.update());
    this.resize.observe(this.track.nativeElement);

    setTimeout(() => this.update());
  }

  ngOnDestroy(): void {
    this.resize?.disconnect();
  }

  // Width of one card step (card + gap); 0 when there is nothing to scroll
  private step(): number {
    const kids = this.track.nativeElement.children;

    return kids.length > 1 ? Math.abs((kids[1] as HTMLElement).offsetLeft - (kids[0] as HTMLElement).offsetLeft) : 0;
  }

  // Furthest the row can scroll (px), 0 when everything fits
  private maxScroll(): number {
    const el = this.track.nativeElement;

    return Math.max(0, el.scrollWidth - el.clientWidth);
  }

  update(): void {
    const el = this.track.nativeElement;
    const offset = Math.abs(el.scrollLeft);
    const max = this.maxScroll();
    const overflow = max > 4;
    const step = this.step();

    this.canPrev.set(overflow && offset > 4);
    this.canNext.set(overflow && offset < max - 4);

    if (!overflow || !step) {
      this.positions.set([]);
      this.active.set(0);
      return;
    }

    // One dot per place the row can really rest on: 0, step, 2*step ... and finally the very end.
    // (Counted from the real scroll length, so there is never a dot that cannot be reached.)
    const last = Math.ceil((max - 2) / step);

    if (this.positions().length !== last + 1) this.positions.set(Array.from({ length: last + 1 }, (_, i) => i));

    this.active.set(offset >= max - 4 ? last : Math.min(last, Math.round(offset / step)));
  }

  go(index: number): void {
    const el = this.track.nativeElement;
    const step = this.step();

    if (!step) return;

    const sign = getComputedStyle(el).direction === 'rtl' ? -1 : 1;
    const target = Math.min(Math.max(0, index) * step, this.maxScroll());

    el.scrollTo({ left: sign * target, behavior: 'smooth' });
  }

  next(direction: 1 | -1): void {
    const last = this.positions().length - 1;

    this.go(Math.max(0, Math.min(last, this.active() + direction)));
  }

  down(e: PointerEvent): void {
    if (e.pointerType !== 'mouse' || e.button !== 0 || this.positions().length === 0) return;

    this.pointerId = e.pointerId;
    this.startX = e.clientX;
    this.startScroll = this.track.nativeElement.scrollLeft;
    this.moved = 0;
    this.dragging = true;
  }

  move(e: PointerEvent): void {
    if (!this.dragging || e.pointerId !== this.pointerId) return;

    const dx = e.clientX - this.startX;

    this.moved = Math.max(this.moved, Math.abs(dx));
    this.track.nativeElement.scrollLeft = this.startScroll - dx;
  }

  up(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;

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
