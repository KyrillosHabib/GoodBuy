import { Component, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { AdminApiService } from '@shared/core/admin-api.service';
import { I18nService } from '@shared/core/i18n.service';
import { CategoryAdmin, CategoryInput, CategoryTranslation } from '@shared/core/models';
import { CategoryImagePipe, TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import {
  SLUG_PATTERN,
  buildTranslationsGroup,
  emptyToNull,
  patchTranslations,
  readTranslations,
  slugify,
} from '@shared/core/translation-forms';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { ModalComponent } from '@shared/components/modal.component';
import { ImageFieldComponent } from '@shared/components/image-field.component';
import { TranslationField, TranslationFieldsComponent } from '@shared/components/translation-fields.component';

@Component({
  selector: 'app-categories-admin',
  standalone: true,
  imports: [ReactiveFormsModule, CategoryImagePipe, TranslatePipe, ImageFieldComponent, TranslationFieldsComponent, DataTableComponent, ModalComponent],
  templateUrl: './categories-admin.component.html',
})
export class CategoriesAdminComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly categories = signal<CategoryAdmin[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly formOpen = signal(false);
  readonly editing = signal<CategoryAdmin | null>(null);

  // The slug follows the English name until somebody types in it by hand
  readonly slugManual = signal(false);

  readonly columns: DtColumn[] = [
    { key: 'image', label: '', width: '70px' },
    { key: 'id', label: 'a.id', value: (c: CategoryAdmin) => c.id, type: 'number', width: '60px' },
    { key: 'name', label: 'a.name', value: (c: CategoryAdmin) => this.nameOf(c) },
    { key: 'slug', label: 'a.slug', value: (c: CategoryAdmin) => c.slug },
    { key: 'products', label: 'a.cat.products', value: (c: CategoryAdmin) => c.productsCount, type: 'number', width: '110px' },
    { key: 'order', label: 'a.order', value: (c: CategoryAdmin) => c.sortOrder, type: 'number', width: '90px' },
    { key: 'active', label: 'a.active', value: (c: CategoryAdmin) => c.isActive, type: 'bool', width: '100px' },
    { key: 'actions', label: '', width: '170px' },
  ];

  readonly fields: TranslationField[] = [
    { key: 'name', label: 'a.name', required: true },
    { key: 'description', label: 'a.description', multiline: true },
  ];

  readonly form = this.fb.group({
    slug: ['', [Validators.required, Validators.pattern(SLUG_PATTERN)]],
    imageUrl: [''],
    sortOrder: [0],
    isActive: [true],
    translations: buildTranslationsGroup(this.fb, { name: true, description: false }),
  });

  constructor() {
    this.form.controls.translations
      .get('en.name')
      ?.valueChanges.pipe(takeUntilDestroyed())
      .subscribe((name) => {
        if (!this.slugManual()) this.form.controls.slug.setValue(slugify((name as string | null) ?? ''));
      });
  }

  ngOnInit(): void {
    this.load();
  }

  // Shown in the current UI language (falls back to English, then to whatever exists)
  nameOf(category: CategoryAdmin): string {
    const lang = this.i18n.lang();
    const t = category.translations;
    return (t.find((x) => x.languageCode === lang) ?? t.find((x) => x.languageCode === 'en') ?? t[0])?.name ?? '';
  }

  startCreate(): void {
    this.editing.set(null);
    this.slugManual.set(false);
    this.form.reset({ slug: '', imageUrl: '', sortOrder: 0, isActive: true });
    this.formOpen.set(true);
  }

  startEdit(category: CategoryAdmin): void {
    this.editing.set(category);
    this.slugManual.set(true);
    this.form.reset({
      slug: category.slug,
      imageUrl: category.imageUrl ?? '',
      sortOrder: category.sortOrder,
      isActive: category.isActive,
    });
    patchTranslations(this.form.controls.translations, category.translations);
    this.formOpen.set(true);
  }

  generateSlug(): void {
    const name = this.form.controls.translations.get('en.name')?.value as string | null;
    this.slugManual.set(false);
    this.form.controls.slug.setValue(slugify(name ?? ''));
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error(this.i18n.t('a.fixFields'));
      return;
    }

    const v = this.form.getRawValue();

    const input: CategoryInput = {
      slug: v.slug ?? '',
      imageUrl: emptyToNull(v.imageUrl),
      sortOrder: Number(v.sortOrder) || 0,
      isActive: !!v.isActive,
      translations: readTranslations<CategoryTranslation>(this.form.controls.translations, ['name']),
    };

    const editing = this.editing();
    const request$: Observable<unknown> = editing
      ? this.api.updateCategory(editing.id, input)
      : this.api.createCategory(input);

    this.saving.set(true);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.success(this.i18n.t(editing ? 'a.cat.updated' : 'a.cat.created'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  remove(category: CategoryAdmin): void {
    if (!confirm(this.i18n.t('a.cat.confirmDelete', { name: this.nameOf(category) }))) return;

    this.api.deleteCategory(category.id).subscribe(() => {
      this.toast.success(this.i18n.t('a.cat.deleted'));
      this.load();
    });
  }

  private load(): void {
    this.api.getCategories().subscribe({
      next: (list) => {
        this.categories.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
