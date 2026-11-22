import { Component, HostListener, Input, computed, inject, signal } from '@angular/core';
import { I18nService } from '@shared/core/i18n.service';
import { AssetUrlPipe } from '@shared/core/pipes';

// Product gallery: arrows, swipe, thumbnails, hover zoom and a full-screen viewer.
@Component({
  selector: 'app-gallery',
  standalone: true,
  imports: [AssetUrlPipe],
  templateUrl: './gallery.component.html',
})
export class GalleryComponent {
  private readonly i18n = inject(I18nService);

  private _images: string[] = [];

  @Input({ required: true }) set images(value: string[]) {
    this._images = value ?? [];
    this.index.set(0);
  }

  get images(): string[] {
    return this._images;
  }

  @Input() alt = '';
  @Input() featured = false;

  readonly index = signal(0);
  readonly zoom = signal<{ x: number; y: number } | null>(null);
  readonly lightbox = signal(false);
  readonly lbZoom = signal(false);
  readonly lbOrigin = signal('50% 50%');

  // Slides sit in a row; in Arabic the row starts on the right, so the shift goes the other way
  readonly offset = computed(() => (this.i18n.isRtl() ? 1 : -1) * this.index() * 100);

  private startX = 0;
  private startY = 0;
  private tracking = false;

  go(delta: number): void {
    const n = this.images.length;

    if (n < 2) return;

    this.index.update((i) => (i + delta + n) % n);
    this.lbZoom.set(false);
  }

  // Hover zoom (mouse only, so touch scrolling is never blocked)
  onMove(e: MouseEvent): void {
    if (window.matchMedia('(hover: none)').matches) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.zoom.set({ x: ((e.clientX - rect.left) / rect.width) * 100, y: ((e.clientY - rect.top) / rect.height) * 100 });
  }

  down(e: PointerEvent): void {
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.tracking = true;
  }

  up(e: PointerEvent): void {
    if (!this.tracking) return;

    this.tracking = false;

    const dx = e.clientX - this.startX;
    const dy = e.clientY - this.startY;

    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
      // Swiping towards the start edge shows the next picture
      const towardsEnd = this.i18n.isRtl() ? dx > 0 : dx < 0;
      this.go(towardsEnd ? 1 : -1);
    } else if (Math.abs(dx) < 6 && Math.abs(dy) < 6) {
      this.open();
    }
  }

  cancel(): void {
    this.tracking = false;
  }

  open(): void {
    this.lightbox.set(true);
    this.lbZoom.set(false);
    document.body.classList.add('modal-open');
  }

  close(): void {
    this.lightbox.set(false);
    document.body.classList.remove('modal-open');
  }

  toggleLbZoom(e: MouseEvent): void {
    e.stopPropagation();
    this.lbZoom.update((v) => !v);
    this.onLbMove(e);
  }

  onLbMove(e: MouseEvent): void {
    if (!this.lbZoom()) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this.lbOrigin.set(`${((e.clientX - rect.left) / rect.width) * 100}% ${((e.clientY - rect.top) / rect.height) * 100}%`);
  }

  @HostListener('document:keydown', ['$event'])
  onKey(e: KeyboardEvent): void {
    if (!this.lightbox()) return;

    const rtl = this.i18n.isRtl();

    if (e.key === 'Escape') this.close();
    else if (e.key === 'ArrowRight') this.go(rtl ? -1 : 1);
    else if (e.key === 'ArrowLeft') this.go(rtl ? 1 : -1);
  }
}
