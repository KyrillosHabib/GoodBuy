import { Component, OnInit, computed, inject, signal, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { IconComponent } from '@shared/components/icon.component';
import { IconPickerComponent } from '@shared/components/icon-picker.component';
import { ImageFieldComponent } from '@shared/components/image-field.component';
import { ModalComponent } from '@shared/components/modal.component';
import { TranslationField, TranslationFieldsComponent } from '@shared/components/translation-fields.component';
import { AdminApiService } from '@shared/core/admin-api.service';
import { I18nService } from '@shared/core/i18n.service';
import {
  ContentItemAdmin,
  ContentItemInput,
  ContentItemTranslation,
  ContentItemType,
} from '@shared/core/models';
import { AssetUrlPipe, TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { CONTINENTS, COUNTRIES, MarketRole, marketValue, parseMarket } from '@shared/core/countries';
import { buildTranslationsGroup, emptyToNull, patchTranslations, readTranslations } from '@shared/core/translation-forms';

import { IntroComponent } from './intro.component';
// Which inputs make sense for each kind of item: the form only shows those,
// so nobody is asked for an image the section never displays.
interface TypeConfig {
  icon: boolean;
  image: boolean;
  value: boolean;
  country: boolean;
  description: boolean;
  hint: string;
}

const TYPE_CONFIG: Record<ContentItemType, TypeConfig> = {
  Feature: { icon: true, image: false, value: false, country: false, description: true, hint: 'a.content.hint.Feature' },
  Statistic: { icon: false, image: false, value: true, country: false, description: false, hint: 'a.content.hint.Statistic' },
};

@Component({
  selector: 'app-content-admin',
  standalone: true,
  imports: [IntroComponent, 
    ReactiveFormsModule,
    TranslatePipe,
    AssetUrlPipe,
    DataTableComponent,
    ModalComponent,
    IconComponent,
    IconPickerComponent,
    ImageFieldComponent,
    TranslationFieldsComponent,
  ],
  templateUrl: './content-admin.component.html',
})
export class ContentAdminComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  // Only what the storefront still shows: the "why choose us" points (the trust band) and the numbers (About page)
  readonly types: ContentItemType[] = ['Feature', 'Statistic'];
  readonly countries = COUNTRIES;
  readonly continents = CONTINENTS;
  readonly marketKind = signal<'country' | 'continent'>('country');

  // The next new item starts with the type you used last (adding several certifications in a row)
  private lastType: ContentItemType = 'Feature';

  readonly items = signal<ContentItemAdmin[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly formOpen = signal(false);
  readonly editing = signal<ContentItemAdmin | null>(null);
  readonly valueMissing = signal(false);

  private readonly currentType = signal<ContentItemType>('Feature');

  readonly config = computed(() => TYPE_CONFIG[this.currentType()]);

  readonly fields = computed<TranslationField[]>(() => {
    const list: TranslationField[] = [{ key: 'title', label: this.currentType() === 'Statistic' ? 'a.content.label' : 'a.title', required: true }];

    if (this.config().description) list.push({ key: 'description', label: 'a.description', multiline: true });

    return list;
  });

  readonly columns: DtColumn[] = [
    { key: 'visual', label: '', width: '70px' },
    { key: 'id', label: 'a.id', value: (i: ContentItemAdmin) => i.id, type: 'number', width: '60px' },
    { key: 'type', label: 'a.content.type', value: (i: ContentItemAdmin) => this.i18n.t('a.type.' + i.type), filter: 'select' },
    { key: 'title', label: 'a.title', value: (i: ContentItemAdmin) => this.titleOf(i) },
    { key: 'value', label: 'a.content.value', value: (i: ContentItemAdmin) => i.value },
    { key: 'order', label: 'a.order', value: (i: ContentItemAdmin) => i.sortOrder, type: 'number', width: '90px' },
    { key: 'active', label: 'a.active', value: (i: ContentItemAdmin) => i.isActive, type: 'bool', width: '100px' },
    { key: 'actions', label: '', width: '170px' },
  ];

  readonly form = this.fb.group({
    type: ['Feature' as ContentItemType],
    icon: [''],
    imageUrl: [''],
    value: [''],
    marketCode: [''],
    marketRole: ['none' as MarketRole],
    sortOrder: [0],
    isActive: [true],
    translations: buildTranslationsGroup(this.fb, { title: true, description: false }),
  });

  constructor() {
    this.form.controls.type.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((t) => {
      this.currentType.set((t ?? 'Feature') as ContentItemType);
      this.valueMissing.set(false);
    });
  }

  ngOnInit(): void {
    this.load();
  }

  titleOf(item: ContentItemAdmin): string {
    const lang = this.i18n.lang();
    const t = item.translations;
    return (t.find((x) => x.languageCode === lang) ?? t.find((x) => x.languageCode === 'en') ?? t[0])?.title ?? '';
  }

  startCreate(): void {
    this.editing.set(null);
    this.currentType.set(this.lastType);
    this.valueMissing.set(false);
    this.marketKind.set('country');
    this.form.reset({ type: this.lastType, icon: '', imageUrl: '', value: '', marketCode: '', marketRole: 'none', sortOrder: 0, isActive: true });
    this.formOpen.set(true);
  }

  startEdit(item: ContentItemAdmin): void {
    this.editing.set(item);
    this.marketKind.set(parseMarket(null)?.kind ?? 'country');
    this.currentType.set(item.type);
    this.valueMissing.set(false);
    this.form.reset({
      type: item.type,
      icon: item.icon ?? '',
      imageUrl: item.imageUrl ?? '',
      value: item.value ?? '',
      marketCode: parseMarket(null)?.code ?? '',
      marketRole: parseMarket(null)?.role ?? 'none',
      sortOrder: item.sortOrder,
      isActive: item.isActive,
    });
    patchTranslations(this.form.controls.translations, item.translations);
    this.formOpen.set(true);
  }

  // Choosing a country fills the names (only the empty ones)
  setMarketKind(kind: 'country' | 'continent'): void {
    this.marketKind.set(kind);
    this.form.patchValue({ marketCode: '' });
  }

  onCountry(code: string): void {
    const country = this.marketKind() === 'continent' ? CONTINENTS.find((c) => c.code === code) : COUNTRIES.find((c) => c.code === code);
    if (!country) return;

    const en = this.form.controls.translations.get('en.title');
    const ar = this.form.controls.translations.get('ar.title');

    if (en && !en.value) en.setValue(country.en);
    if (ar && !ar.value) ar.setValue(country.ar);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error(this.i18n.t('a.fixFields'));
      return;
    }

    const v = this.form.getRawValue();
    const type = (v.type ?? 'Feature') as ContentItemType;
    const config = TYPE_CONFIG[type];

    const marketCode = emptyToNull(v.marketCode);

    if ((config.value && !emptyToNull(v.value)) || (config.country && !marketCode)) {
      this.valueMissing.set(true);
      return;
    }

    const input: ContentItemInput = {
      type,
      // fields the type does not use are not sent
      icon: config.icon ? emptyToNull(v.icon) : null,
      imageUrl: config.image ? emptyToNull(v.imageUrl) : null,
      value: config.country
        ? marketValue(marketCode ?? '', this.marketKind(), (v.marketRole ?? 'none') as MarketRole)
        : config.value
          ? emptyToNull(v.value)
          : null,
      sortOrder: Number(v.sortOrder) || 0,
      isActive: !!v.isActive,
      translations: readTranslations<ContentItemTranslation>(this.form.controls.translations, ['title']).map((t) => ({
        ...t,
        description: config.description ? t.description : null,
      })),
    };

    const editing = this.editing();
    const request$: Observable<unknown> = editing
      ? this.api.updateContentItem(editing.id, input)
      : this.api.createContentItem(input);

    this.saving.set(true);
    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.lastType = type;
        this.formOpen.set(false);
        this.toast.success(this.i18n.t(editing ? 'a.content.updated' : 'a.content.created'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  remove(item: ContentItemAdmin): void {
    if (!confirm(this.i18n.t('a.content.confirmDelete', { name: this.titleOf(item) }))) return;

    this.api.deleteContentItem(item.id).subscribe(() => {
      this.toast.success(this.i18n.t('a.content.deleted'));
      this.load();
    });
  }

  private load(): void {
    this.api.getContentItems(null).subscribe({
      next: (list) => {
        this.items.set(list.filter((i) => this.types.includes(i.type)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}