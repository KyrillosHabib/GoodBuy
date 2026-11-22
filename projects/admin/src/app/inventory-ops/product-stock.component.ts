import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { InventoryOpsApi, OpeningLine, ProductStock, ProductStockVariant } from './ops.api';
import './ops.i18n';

interface Entry { cost: string; batch: string; expiry: string; qty: Record<number, string>; }

// The page that follows saving a product: on one side what each warehouse started with (opening balances, typed here),
// on the other what is available now in every warehouse. Rows are the items of the product, columns the warehouses.
@Component({
  selector: 'app-product-stock',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './product-stock.component.html',
  styleUrl: './product-stock.component.css',
})
export class ProductStockComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(InventoryOpsApi);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly data = signal<ProductStock | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);

  private productId = 0;
  private entries: Record<number, Entry> = {};

  ngOnInit(): void {
    this.productId = Number(this.route.snapshot.paramMap.get('id'));

    if (!this.productId) {
      void this.router.navigate(['/products']);
      return;
    }

    this.load();
  }

  private load(): void {
    this.loading.set(this.data() === null);

    this.api.getProductStock(this.productId).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  // ---------------------------------------------------------------- typing the balances

  entry(variantId: number): Entry {
    return (this.entries[variantId] ??= { cost: '', batch: '', expiry: '', qty: {} });
  }

  val(e: Event): string {
    return (e.target as HTMLInputElement).value;
  }

  // The cost of the stock the item already has, shown as a hint when typing the cost
  hint(v: ProductStockVariant): string {
    const known = v.stock.find((s) => s.avgCost > 0);

    return known ? String(known.avgCost) : this.i18n.t('ps.cost');
  }

  private qtyOf(variantId: number, warehouseId: number): number {
    const n = Math.floor(Number(this.entry(variantId).qty[warehouseId]));

    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  units(): number {
    const d = this.data();

    return d ? d.variants.reduce((a, v) => a + d.warehouses.reduce((b, w) => b + this.qtyOf(v.id, w.id), 0), 0) : 0;
  }

  previewValue(): number {
    const d = this.data();

    return d
      ? d.variants.reduce((a, v) => a + (Number(this.entry(v.id).cost) || 0) * d.warehouses.reduce((b, w) => b + this.qtyOf(v.id, w.id), 0), 0)
      : 0;
  }

  save(): void {
    const d = this.data();
    if (!d || this.saving()) return;

    const lines: OpeningLine[] = [];

    for (const v of d.variants) {
      const e = this.entry(v.id);

      for (const w of d.warehouses) {
        const quantity = this.qtyOf(v.id, w.id);
        if (quantity === 0) continue;

        if (e.cost.trim() === '' || Number(e.cost) < 0) {
          this.toast.error(this.i18n.t('ps.needCost', { item: v.label || v.sku }));
          return;
        }

        lines.push({
          warehouseId: w.id, variantId: v.id, quantity, unitCost: Number(e.cost),
          batchNumber: e.batch.trim() || null, expiryDate: e.expiry || null, note: null,
        });
      }
    }

    if (lines.length === 0) return;

    this.saving.set(true);

    this.api.saveOpeningBalance(this.productId, lines).subscribe({
      next: () => {
        this.saving.set(false);
        this.entries = {};
        this.toast.success(this.i18n.t('ps.saved'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  // ---------------------------------------------------------------- what is available

  cell(v: ProductStockVariant, warehouseId: number) {
    return v.stock.find((s) => s.warehouseId === warehouseId) ?? { warehouseId, onHand: 0, reorderLevel: 0, avgCost: 0, value: 0, openingQty: 0, batches: 0 };
  }

  cellTitle(v: ProductStockVariant, warehouseId: number): string {
    const c = this.cell(v, warehouseId);

    return c.onHand > 0 ? `${this.i18n.t('ps.avgCost')}: ${this.money(c.avgCost)} · ${this.i18n.t('ps.value')}: ${this.money(c.value)}` : '';
  }

  warehouseTotal(d: ProductStock, warehouseId: number): number {
    return d.variants.reduce((a, v) => a + this.cell(v, warehouseId).onHand, 0);
  }

  sum(d: ProductStock, key: 'totalOnHand' | 'reserved' | 'available' | 'totalValue'): number | string {
    return d.variants.reduce((a, v) => a + v[key], 0);
  }

  money(value: number | string): string {
    return Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
