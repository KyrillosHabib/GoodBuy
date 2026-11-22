import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InventoryApiService } from '@shared/core/inventory-api.service';
import { I18nService } from '@shared/core/i18n.service';
import { StockCount, StockCountDetail, StockCountLine, VariantPick, Warehouse } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { VariantPickerComponent } from './variant-picker.component';

// Stock take: open a count (a snapshot of what the system believes), enter what is really on the shelves, complete it:
// every difference becomes a "count correction" in the history.
@Component({
  selector: 'app-inventory-counts',
  standalone: true,
  imports: [FormsModule, TranslatePipe, VariantPickerComponent],
  templateUrl: './inventory-counts.component.html',
})
export class InventoryCountsComponent implements OnInit {
  private readonly api = inject(InventoryApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly counts = signal<StockCount[]>([]);
  readonly warehouses = signal<Warehouse[]>([]);
  readonly detail = signal<StockCountDetail | null>(null);
  lines: StockCountLine[] = [];
  newWarehouse: number | null = null;
  newNote = '';

  ngOnInit(): void {
    this.api.getWarehouses().subscribe((w) => this.warehouses.set(w.filter((x) => x.isActive)));
    this.load();
  }

  load(): void {
    this.api.getCounts().subscribe((c) => this.counts.set(c));
  }

  start(): void {
    this.api.startCount({ warehouseId: this.newWarehouse!, note: this.newNote.trim() || null }).subscribe((id) => {
      this.newNote = '';
      this.openCount(id);
    });
  }

  openCount(id: number): void {
    this.api.getCount(id).subscribe((d) => {
      this.detail.set(d);
      this.lines = d.lines.map((l) => ({ ...l }));
    });
  }

  back(): void {
    this.detail.set(null);
    this.load();
  }

  setCount(l: StockCountLine, e: Event): void {
    const v = (e.target as HTMLInputElement).value;
    l.countedQuantity = v === '' ? null : Math.max(0, Math.floor(Number(v)));
  }

  diff(l: StockCountLine): number | null {
    return l.countedQuantity === null ? null : l.countedQuantity - l.expectedQuantity;
  }

  addLine(v: VariantPick | null): void {
    if (!v || this.lines.some((l) => l.variantId === v.id)) return;
    this.lines = [...this.lines, { variantId: v.id, sku: v.sku, productName: v.productName, label: v.label, expectedQuantity: 0, countedQuantity: null }];
  }

  save(complete: boolean): void {
    const id = this.detail()!.header.id;

    this.api.saveCountLines(id, this.lines.map((l) => ({ variantId: l.variantId, countedQuantity: l.countedQuantity }))).subscribe(() => {
      if (!complete) {
        this.toast.success(this.i18n.t('inv.saved'));
        return;
      }

      this.api.completeCount(id).subscribe(() => {
        this.toast.success(this.i18n.t('inv.countDone'));
        this.back();
      });
    });
  }

  cancel(): void {
    if (!confirm(this.i18n.t('inv.confirmCancelCount'))) return;
    this.api.cancelCount(this.detail()!.header.id).subscribe(() => this.back());
  }
}
