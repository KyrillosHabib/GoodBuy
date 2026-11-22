import { Component, ElementRef, EventEmitter, HostListener, Input, Output, computed, inject, signal } from '@angular/core';
import { InventoryApiService } from '@shared/core/inventory-api.service';
import { VariantPick } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import './variant-picker.i18n';

// Search box for an item (product + size/colour). It opens its list as soon as the box is clicked (so the items can be browsed
// without typing anything), finds an item from any part of its name, in any order of words, or from its SKU / barcode, and can be
// used with the arrows and Enter. Emits the chosen variant.
@Component({
  selector: 'app-variant-picker',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './variant-picker.component.html',
  styleUrl: './variant-picker.component.css',
})
export class VariantPickerComponent {
  private readonly api = inject(InventoryApiService);
  private readonly host = inject(ElementRef<HTMLElement>);

  @Input() placeholder = '';
  // true on the screens of discounts / offers / coupons: a package can be chosen there
  @Input() includeBundles = false;
  @Output() picked = new EventEmitter<VariantPick | null>();

  readonly text = signal('');
  readonly results = signal<VariantPick[]>([]);
  // The same product with several sizes / colours is ONE line here; its variants are chips under its name
  readonly groups = computed(() => {
    const map = new Map<string, { name: string; items: { v: VariantPick; i: number }[] }>();
    this.results().forEach((v, i) => {
      const key = v.productId != null ? 'p' + v.productId : 'n' + v.productName;
      const g = map.get(key) ?? { name: v.productName, items: [] };
      g.items.push({ v, i });
      map.set(key, g);
    });
    return [...map.values()];
  });
  readonly selected = signal<VariantPick | null>(null);
  readonly opened = signal(false);
  readonly loading = signal(false);
  readonly active = signal(0);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private ticket = 0;

  @HostListener('document:click', ['$event'])
  outside(e: Event): void {
    if (this.opened() && !this.host.nativeElement.contains(e.target as Node)) this.opened.set(false);
  }

  open(): void {
    this.opened.set(true);
    this.run(this.text());
  }

  search(event: Event): void {
    const q = (event.target as HTMLInputElement).value;
    this.text.set(q);
    this.opened.set(true);

    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.run(q), 200);
  }

  private run(q: string): void {
    const mine = ++this.ticket;
    this.loading.set(true);

    this.api.searchVariants(q.trim(), this.includeBundles).subscribe({
      next: (r) => {
        if (mine !== this.ticket) return;
        this.results.set(r);
        this.active.set(0);
        this.loading.set(false);
      },
      error: () => { if (mine === this.ticket) { this.results.set([]); this.loading.set(false); } },
    });
  }

  key(e: KeyboardEvent): void {
    const n = this.results().length;

    if (e.key === 'ArrowDown') { e.preventDefault(); this.opened.set(true); this.active.set(n ? (this.active() + 1) % n : 0); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); this.active.set(n ? (this.active() - 1 + n) % n : 0); }
    else if (e.key === 'Enter') {
      const r = this.results()[this.active()];
      if (this.opened() && r) { e.preventDefault(); this.choose(r); }
    } else if (e.key === 'Escape') this.opened.set(false);
  }

  choose(r: VariantPick): void {
    this.selected.set(r);
    this.opened.set(false);
    this.picked.emit(r);
  }

  clear(): void {
    this.selected.set(null);
    this.text.set('');
    this.picked.emit(null);
  }

  // Empties the box without telling the parent (after the chosen item was added to a list, so the next one can be searched)
  reset(): void {
    this.selected.set(null);
    this.text.set('');
    this.results.set([]);
    this.opened.set(false);
  }

  // Lets a parent show an item that is already chosen (a purchase-order line, for example)
  set(r: VariantPick | null): void {
    this.selected.set(r);
  }
}
