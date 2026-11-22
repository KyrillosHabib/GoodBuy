import { Component, OnInit, inject, signal } from '@angular/core';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { AdminApiService } from '@shared/core/admin-api.service';
import { I18nService } from '@shared/core/i18n.service';
import { ProductAdminListItem } from '@shared/core/models';
import { ProductImagePipe, TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { ProductFormComponent } from './product-form.component';

import { IntroComponent } from './intro.component';
// Packages: several items (from any category) sold together at one price. It looks like a product (name, images, description,
// specifications) but has no category, no options and no stock of its own: what can be sold follows the items inside it.
@Component({
  selector: 'app-packages-admin',
  standalone: true,
  imports: [IntroComponent, ProductImagePipe, TranslatePipe, DataTableComponent, ProductFormComponent],
  templateUrl: './packages-admin.component.html',
})
export class PackagesAdminComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly items = signal<ProductAdminListItem[]>([]);
  readonly loading = signal(true);
  readonly formOpen = signal(false);
  readonly editingId = signal<number | null>(null);

  readonly columns: DtColumn[] = [
    { key: 'image', label: '', width: '70px' },
    { key: 'name', label: 'a.name', value: (p: ProductAdminListItem) => `${p.name} ${p.slug}` },
    { key: 'price', label: 'a.prod.price', value: (p: ProductAdminListItem) => p.price, type: 'number', width: '110px' },
    { key: 'order', label: 'a.order', value: (p: ProductAdminListItem) => p.sortOrder, type: 'number', width: '90px' },
    { key: 'active', label: 'a.active', value: (p: ProductAdminListItem) => p.isActive, type: 'bool', width: '100px' },
    { key: 'actions', label: '', width: '170px' },
  ];

  ngOnInit(): void {
    this.load();
  }

  open(id: number | null): void {
    this.editingId.set(id);
    this.formOpen.set(true);
  }

  onSaved(): void {
    this.formOpen.set(false);
    this.load();
  }

  remove(p: ProductAdminListItem): void {
    if (!confirm(this.i18n.t('a.prod.confirmDelete', { name: p.name }))) return;

    this.api.deleteProduct(p.id).subscribe(() => {
      this.toast.success(this.i18n.t('a.prod.deleted'));
      this.load();
    });
  }

  private load(): void {
    this.api.getProducts({ page: 1, pageSize: 1000, bundles: true }).subscribe({
      next: (r) => { this.items.set(r.items); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
