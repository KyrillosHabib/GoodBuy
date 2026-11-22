import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { ImageFieldComponent } from '@shared/components/image-field.component';
import { ModalComponent } from '@shared/components/modal.component';
import { AdminApiService } from '@shared/core/admin-api.service';
import { I18nService } from '@shared/core/i18n.service';
import { BrandAdmin, BrandInput } from '@shared/core/models';
import { AssetUrlPipe, TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { buildTranslationsGroup, emptyToNull, patchTranslations, readTranslations } from '@shared/core/translation-forms';
import { TranslationField, TranslationFieldsComponent } from '@shared/components/translation-fields.component';

import { IntroComponent } from './intro.component';
// Brands are registered once here and then picked from a list on the product form.
@Component({
  selector: 'app-brands-admin',
  standalone: true,
  imports: [IntroComponent, ReactiveFormsModule, TranslatePipe, AssetUrlPipe, DataTableComponent, ModalComponent, ImageFieldComponent, TranslationFieldsComponent],
  templateUrl: './brands-admin.component.html',
})
export class BrandsAdminComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly brands = signal<BrandAdmin[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly formOpen = signal(false);
  readonly editing = signal<BrandAdmin | null>(null);

  readonly columns: DtColumn[] = [
    { key: 'logo', label: '', width: '70px' },
    { key: 'name', label: 'a.name', value: (b: BrandAdmin) => this.nameOf(b) },
    { key: 'products', label: 'a.cat.products', value: (b: BrandAdmin) => b.productsCount, type: 'number', width: '110px' },
    { key: 'active', label: 'a.active', value: (b: BrandAdmin) => b.isActive, type: 'bool', width: '100px' },
    { key: 'actions', label: '', width: '170px' },
  ];

  readonly fields: TranslationField[] = [{ key: 'name', label: 'a.name', required: true }];

  readonly form = this.fb.group({
    logoUrl: [''],
    isActive: [true],
    translations: buildTranslationsGroup(this.fb, { name: true }),
  });

  nameOf(brand: BrandAdmin): string {
    const lang = this.i18n.lang();
    const t = brand.translations;
    return (t.find((x) => x.languageCode === lang) ?? t.find((x) => x.languageCode === 'en') ?? t[0])?.name ?? '';
  }

  ngOnInit(): void {
    this.load();
  }

  startCreate(): void {
    this.editing.set(null);
    this.form.reset({ logoUrl: '', isActive: true });
    this.formOpen.set(true);
  }

  startEdit(brand: BrandAdmin): void {
    this.editing.set(brand);
    this.form.reset({ logoUrl: brand.logoUrl ?? '', isActive: brand.isActive });
    patchTranslations(this.form.controls.translations, brand.translations);
    this.formOpen.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const input: BrandInput = {
      logoUrl: emptyToNull(v.logoUrl),
      isActive: !!v.isActive,
      translations: readTranslations<{ languageCode: string; name: string }>(this.form.controls.translations, ['name']),
    };

    const editing = this.editing();
    const request$: Observable<unknown> = editing ? this.api.updateBrand(editing.id, input) : this.api.createBrand(input);

    this.saving.set(true);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.success(this.i18n.t(editing ? 'a.brand.updated' : 'a.brand.created'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  remove(brand: BrandAdmin): void {
    if (!confirm(this.i18n.t('a.brand.confirmDelete', { name: this.nameOf(brand) }))) return;

    this.api.deleteBrand(brand.id).subscribe(() => {
      this.toast.success(this.i18n.t('a.brand.deleted'));
      this.load();
    });
  }

  private load(): void {
    this.api.getBrands().subscribe({
      next: (list) => {
        this.brands.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
