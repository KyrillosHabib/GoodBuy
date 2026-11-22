import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '@shared/core/auth.service';
import { AdminApiService } from '@shared/core/admin-api.service';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { I18nService } from '@shared/core/i18n.service';
import { ProductAdminListItem } from '@shared/core/models';
import { ProductImagePipe, TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { ProductFormComponent } from './product-form.component';

@Component({
  selector: 'app-products-admin',
  standalone: true,
  imports: [ProductImagePipe, TranslatePipe, DataTableComponent, ProductFormComponent],
  templateUrl: './products-admin.component.html',
})
export class ProductsAdminComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);

  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly products = signal<ProductAdminListItem[]>([]);
  readonly loading = signal(true);
  readonly formOpen = signal(false);
  readonly editingId = signal<number | null>(null);
  readonly featuredLimit = signal(8);

  readonly featuredCount = computed(() => this.products().filter((p) => p.isFeatured && p.isActive).length);

  readonly columns: DtColumn[] = [
    { key: 'image', label: '', width: '70px' },
    { key: 'id', label: 'a.id', value: (p: ProductAdminListItem) => p.id, type: 'number', width: '60px' },
    { key: 'name', label: 'a.name', value: (p: ProductAdminListItem) => `${p.name} ${p.slug}` },
    { key: 'sku', label: 'a.prod.sku', value: (p: ProductAdminListItem) => p.sku },
    { key: 'brand', label: 'a.prod.brand', value: (p: ProductAdminListItem) => p.brandName, filter: 'select' },
    { key: 'category', label: 'a.prod.category', value: (p: ProductAdminListItem) => p.categoryName, filter: 'select' },
    { key: 'price', label: 'a.prod.price', value: (p: ProductAdminListItem) => p.price, type: 'number', width: '100px' },
    { key: 'stock', label: 'a.prod.stock', value: (p: ProductAdminListItem) => p.units, type: 'number', width: '90px' },
    { key: 'order', label: 'a.order', value: (p: ProductAdminListItem) => p.sortOrder, type: 'number', width: '90px' },
    { key: 'featured', label: 'a.prod.featured', value: (p: ProductAdminListItem) => p.isFeatured, type: 'bool', width: '100px' },
    { key: 'active', label: 'a.active', value: (p: ProductAdminListItem) => p.isActive, type: 'bool', width: '100px' },
    { key: 'actions', label: '', width: '170px' },
  ];

  ngOnInit(): void {
    this.api.getSettings().subscribe((s) => this.featuredLimit.set(s.featuredProductsLimit));
    this.load();
  }

  openForm(id: number | null): void {
    this.editingId.set(id);
    this.formOpen.set(true);
  }

  onSaved(): void {
    this.formOpen.set(false);
    this.load();
  }

  // A new product: the next step is what each warehouse holds of it (its opening balances)
  afterCreate(id: number): void {
    if (this.auth.can('history', 'inventory')) this.openStock(id);
  }

  openStock(id: number): void {
    void this.router.navigate(['/products', id, 'stock']);
  }

  canSeeStock(): boolean {
    return this.auth.can('history', 'inventory');
  }

  remove(product: ProductAdminListItem): void {
    if (!confirm(this.i18n.t('a.prod.confirmDelete', { name: product.name }))) return;

    this.api.deleteProduct(product.id).subscribe(() => {
      this.toast.success(this.i18n.t('a.prod.deleted'));
      this.load();
    });
  }

  private load(): void {
    // The data table sorts / filters / pages in the browser, so the whole list is loaded once
    this.api.getProducts({ page: 1, pageSize: 1000, bundles: false }).subscribe({
      next: (result) => {
        this.products.set(result.items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
