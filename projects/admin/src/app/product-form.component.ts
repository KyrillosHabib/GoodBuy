import { Component, computed, EventEmitter, Input, OnInit, Output, ViewChild, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { ModalComponent } from '@shared/components/modal.component';
import { VariantsEditorComponent } from './variants-editor.component';
import { TranslationField, TranslationFieldsComponent } from '@shared/components/translation-fields.component';
import { ImageFieldComponent } from '@shared/components/image-field.component';
import { AdminApiService } from '@shared/core/admin-api.service';
import { I18nService } from '@shared/core/i18n.service';
import {
  BrandAdmin,
  VariantInput,
  CategoryAdmin,
  ProductAdmin,
  ProductInput,
  ProductTranslation,
  Specification,
} from '@shared/core/models';
import { AssetUrlPipe, TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import {
  LANGUAGES,
  LANGUAGE_LABELS,
  SLUG_PATTERN,
  buildTranslationsGroup,
  emptyToNull,
  patchTranslations,
  readTranslations,
  slugify,
} from '@shared/core/translation-forms';
import { environment } from '@shared/environments/environment';

interface SpecRow {
  // language -> { name, value }
  data: Record<string, { name: string; value: string }>;
}

// Add / edit a product in a pop-up. Sections follow the order the data is entered in:
// 1) classification & code, 2) names, description, slug and main image, 3) specifications, 4) gallery.
@Component({
  selector: 'app-product-form',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, AssetUrlPipe, ModalComponent, ImageFieldComponent, TranslationFieldsComponent, VariantsEditorComponent],
  templateUrl: './product-form.component.html',
})
export class ProductFormComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);

  // The variants editor appears when its card is drawn; variants loaded before that wait here
  private editor?: VariantsEditorComponent;
  private pendingVariants: VariantInput[] | null = null;

  @ViewChild(VariantsEditorComponent) set variantsEditorRef(e: VariantsEditorComponent | undefined) {
    this.editor = e;

    // This runs in the middle of change detection: changing the editor's rows right now would change what it already
    // showed (NG0100). So the values are given to it right after the check is over.
    if (e && this.pendingVariants) {
      const variants = this.pendingVariants;
      queueMicrotask(() => {
        if (this.editor === e) e.setValue(variants);
      });
    }
  }

  private get variantsEditor(): { getValue(): VariantInput[]; setValue(v: VariantInput[]): void } {
    return {
      getValue: () => this.editor?.getValue() ?? [],
      setValue: (v) => {
        this.pendingVariants = v;
        this.editor?.setValue(v);
      },
    };
  }
  private readonly i18n = inject(I18nService);

  // null = new product
  @Input() productId: number | null = null;
  // true on the Packages screen: no category / brand / featured / package switch, and the item list is the package's components
  @Input() packageMode = false;

  // The steps of the form: 1 basic data · 2 images · 3 specifications · 4 options / items and prices
  readonly step = signal(1);
  readonly maxStep = signal(1);
  readonly stepTitles = computed(() => ['step.basic', 'step.images', 'step.specs', this.packageMode ? 'step.package' : 'step.prices']);
  @Output() saved = new EventEmitter<void>();
  // The id of a product that was just created (the next step is its opening balances)
  @Output() created = new EventEmitter<number>();
  @Output() cancelled = new EventEmitter<void>();

  readonly languages = LANGUAGES;
  readonly labels = LANGUAGE_LABELS;

  readonly categories = signal<CategoryAdmin[]>([]);
  readonly brands = signal<BrandAdmin[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly uploading = signal(false);

  readonly skuMode = signal<'auto' | 'manual'>('auto');
  readonly skuPrefix = signal('VLT');
  readonly featuredLimit = signal(8);
  readonly slugManual = signal(false);

  readonly specs = signal<SpecRow[]>([]);
  readonly editingSpec = signal<number | null>(null);
  readonly specError = signal(false);

  readonly fields: TranslationField[] = [
    { key: 'name', label: 'a.name', required: true },
    { key: 'shortDescription', label: 'a.shortDescription' },
    { key: 'description', label: 'a.description', multiline: true },
  ];

  readonly form = this.fb.group({
    categoryId: [0, [Validators.min(1)]],
    brandId: [null as number | null],
    slug: ['', [Validators.required, Validators.pattern(SLUG_PATTERN)]],
    sku: [''],
    mainImageUrl: [''],
    isFeatured: [false],
    isBundle: [false],
    isActive: [true],
    sortOrder: [0],
    translations: buildTranslationsGroup(this.fb, { name: true, shortDescription: false, description: false }),
    images: this.fb.array<FormGroup>([]),
  });

  // The little "add a specification" form: <lang>_name / <lang>_value
  readonly specDraft: FormGroup = this.fb.group(
    Object.fromEntries(LANGUAGES.flatMap((l) => [[`${l}_name`, ['']], [`${l}_value`, ['']]])),
  );

  get images() {
    return this.form.controls.images;
  }

  constructor() {
    // The slug follows the English name until somebody types in it by hand
    this.form.controls.translations
      .get('en.name')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((name) => {
        if (!this.slugManual()) this.form.controls.slug.setValue(slugify((name as string | null) ?? ''));
      });
  }

  ngOnInit(): void {
    if (this.packageMode) {
      // A package has no category (it is put in "Packages" by the server) and is always a package
      this.form.controls.categoryId.clearValidators();
      this.form.controls.categoryId.updateValueAndValidity();
      this.form.controls.isBundle.setValue(true);
    }

    // Editing: every step is open at once (the data is already complete)
    if (this.productId) this.maxStep.set(4);

    this.api.getCategories().subscribe((list) => this.categories.set(list));
    this.api.getBrands().subscribe((list) => this.brands.set(list.filter((b) => b.isActive)));
    this.api.getSettings().subscribe((s) => {
      this.skuPrefix.set(s.skuPrefix);
      this.featuredLimit.set(s.featuredProductsLimit);
    });

    if (this.productId) {
      this.loading.set(true);
      this.slugManual.set(true);

      this.api.getProduct(this.productId).subscribe({
        next: (product) => {
          this.fill(product);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }

  categoryName(category: CategoryAdmin): string {
    const lang = this.i18n.lang();
    const t = category.translations;
    return (t.find((x) => x.languageCode === lang) ?? t.find((x) => x.languageCode === 'en') ?? t[0])?.name ?? '';
  }

  brandName(brand: BrandAdmin): string {
    const lang = this.i18n.lang();
    const t = brand.translations;
    return (t.find((x) => x.languageCode === lang) ?? t.find((x) => x.languageCode === 'en') ?? t[0])?.name ?? '';
  }

  skuPlaceholder(): string {
    const existing = this.form.controls.sku.value;

    return existing ? existing : `${this.skuPrefix()}-00001 …`;
  }

  setSkuMode(mode: 'auto' | 'manual'): void {
    this.skuMode.set(mode);
  }

  generateSlug(): void {
    const name = this.form.controls.translations.get('en.name')?.value as string | null;
    this.slugManual.set(false);
    this.form.controls.slug.setValue(slugify(name ?? ''));
  }

  // ---------------- specifications table
  commitSpec(): void {
    const draft = this.specDraft.getRawValue() as Record<string, string>;
    const data: SpecRow['data'] = {};

    for (const lang of LANGUAGES) {
      const name = (draft[`${lang}_name`] ?? '').trim();
      const value = (draft[`${lang}_value`] ?? '').trim();

      if (name && value) data[lang] = { name, value };
    }

    // The default language is required, the others are optional
    if (!data[environment.defaultLanguage]) {
      this.specError.set(true);
      return;
    }

    this.specError.set(false);

    const index = this.editingSpec();

    if (index === null) {
      this.specs.update((list) => [...list, { data }]);
    } else {
      this.specs.update((list) => list.map((row, i) => (i === index ? { data } : row)));
    }

    this.resetSpecDraft();
  }

  editSpec(index: number): void {
    const row = this.specs()[index];
    const values: Record<string, string> = {};

    for (const lang of LANGUAGES) {
      values[`${lang}_name`] = row.data[lang]?.name ?? '';
      values[`${lang}_value`] = row.data[lang]?.value ?? '';
    }

    this.specDraft.reset(values);
    this.editingSpec.set(index);
  }

  removeSpec(index: number): void {
    this.specs.update((list) => list.filter((_, i) => i !== index));

    if (this.editingSpec() === index) this.resetSpecDraft();
  }

  moveSpec(index: number, delta: number): void {
    const target = index + delta;

    this.specs.update((list) => {
      if (target < 0 || target >= list.length) return list;

      const copy = [...list];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  resetSpecDraft(): void {
    this.specDraft.reset();
    this.editingSpec.set(null);
    this.specError.set(false);
  }

  // ---------------- gallery
  addImage(url = ''): void {
    this.images.push(this.newImage(url, '', this.images.length + 1));
  }

  removeImage(index: number): void {
    this.images.removeAt(index);
  }

  onGalleryFiles(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);

    if (files.length === 0) return;

    this.uploading.set(true);
    let pending = files.length;

    for (const file of files) {
      this.api.uploadImage(file).subscribe({
        next: (result) => this.addImage(result.url),
        error: () => this.finishUpload(--pending),
        complete: () => this.finishUpload(--pending),
      });
    }

    input.value = '';
  }

  onRowFile(event: Event, row: FormGroup): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    if (!file) return;

    this.uploading.set(true);
    this.api.uploadImage(file).subscribe({
      next: (result) => row.get('url')?.setValue(result.url),
      error: () => this.uploading.set(false),
      complete: () => this.uploading.set(false),
    });

    input.value = '';
  }

  private finishUpload(pending: number): void {
    if (pending <= 0) this.uploading.set(false);
  }

  // ---------------- save
  goTo(n: number): void {
    if (n <= this.maxStep()) this.step.set(n);
  }

  back(): void {
    this.step.update((s) => Math.max(1, s - 1));
  }

  // Next: the step that is open is checked first
  next(): void {
    if (!this.stepIsValid(this.step())) return;

    const n = Math.min(4, this.step() + 1);
    this.step.set(n);
    this.maxStep.update((m) => Math.max(m, n));
  }

  // Enter inside a field moves on to the next step (it must not save a half-filled product)
  onSubmit(): void {
    if (this.step() < 4) this.next();
    else this.save();
  }

  private stepIsValid(n: number): boolean {
    if (n !== 1) return true;

    const c = this.form.controls;
    const controls = [c.slug, c.translations, ...(this.packageMode ? [] : [c.categoryId])];

    if (controls.some((x) => x.invalid)) {
      controls.forEach((x) => x.markAllAsTouched());
      this.toast.error(this.i18n.t('a.fixFields'));
      return false;
    }

    return true;
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.step.set(1);
      this.toast.error(this.i18n.t('a.fixFields'));
      return;
    }

    const variantProblem = this.editor?.validate();

    if (variantProblem) {
      this.step.set(4);
      this.toast.error(this.i18n.t(variantProblem));
      return;
    }

    const v = this.form.getRawValue();
    const manualSku = this.skuMode() === 'manual' ? emptyToNull(v.sku) : null;

    if (this.skuMode() === 'manual' && !manualSku) {
      this.toast.error(this.i18n.t('a.prod.skuRequired'));
      return;
    }

    const input: ProductInput = {
      categoryId: Number(v.categoryId),
      slug: v.slug ?? '',
      // null = the server generates the next code (an existing product keeps its code)
      sku: manualSku,
      brandId: v.brandId ?? null,
      mainImageUrl: emptyToNull(v.mainImageUrl),
      isFeatured: !!v.isFeatured,
      isBundle: !!v.isBundle,
      isActive: !!v.isActive,
      sortOrder: Number(v.sortOrder) || 0,
      variants: this.variantsEditor.getValue(),
      translations: readTranslations<ProductTranslation>(this.form.controls.translations, ['name']),

      images: this.images.controls
        .map((g) => g.getRawValue() as { url: string | null; altText: string | null; sortOrder: number | null })
        .filter((i) => !!i.url?.trim())
        .map((i) => ({ url: (i.url ?? '').trim(), altText: emptyToNull(i.altText), sortOrder: Number(i.sortOrder) || 0 })),

      specifications: this.specs().map((row, index) => ({
        sortOrder: index + 1,
        translations: LANGUAGES.filter((l) => row.data[l]).map((l) => ({
          languageCode: l,
          name: row.data[l].name,
          value: row.data[l].value,
        })),
      })),
    };

    const request$: Observable<unknown> = this.productId
      ? this.api.updateProduct(this.productId, input)
      : this.api.createProduct(input);

    this.saving.set(true);
    request$.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.toast.success(this.i18n.t(this.productId ? 'a.prod.updated' : 'a.prod.created'));

        const newId = !this.productId ? (result as { id?: number } | null)?.id : undefined;
        if (newId) this.created.emit(newId);

        this.saved.emit();
      },
      error: () => this.saving.set(false),
    });
  }

  // ---------------- helpers
  private fill(product: ProductAdmin): void {
    this.form.patchValue({
      categoryId: product.categoryId,
      brandId: product.brandId,
      slug: product.slug,
      sku: product.sku ?? '',
      mainImageUrl: product.mainImageUrl ?? '',
      isFeatured: product.isFeatured,
      isBundle: !!product.isBundle,
      isActive: product.isActive,
      sortOrder: product.sortOrder,
    });
    this.variantsEditor.setValue(product.variants);

    // An existing code is shown and kept; switch to "manual" to change it
    this.skuMode.set(product.sku ? 'manual' : 'auto');

    patchTranslations(this.form.controls.translations, product.translations);

    this.images.clear();
    product.images.forEach((i) => this.images.push(this.newImage(i.url, i.altText ?? '', i.sortOrder)));

    this.specs.set(product.specifications.map((s) => this.toRow(s)));
  }

  private toRow(spec: Specification): SpecRow {
    const data: SpecRow['data'] = {};

    for (const t of spec.translations) data[t.languageCode] = { name: t.name, value: t.value };

    return { data };
  }

  private newImage(url: string, altText: string, sortOrder: number): FormGroup {
    return this.fb.group({
      url: [url, Validators.required],
      altText: [altText],
      sortOrder: [sortOrder],
    });
  }
}
