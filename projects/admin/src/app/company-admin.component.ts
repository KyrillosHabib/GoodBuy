import { Component, OnInit, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { buildMapEmbed } from '@shared/core/maps';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { AdminApiService } from '@shared/core/admin-api.service';
import { I18nService } from '@shared/core/i18n.service';
import { SOCIAL_PLATFORMS } from '@shared/core/icons';
import { CompanyProfileInput, CompanyProfileTranslation, SocialLink } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import {
  buildTranslationsGroup,
  emptyToNull,
  patchTranslations,
  readTranslations,
} from '@shared/core/translation-forms';
import { IconComponent } from '@shared/components/icon.component';
import { ImageFieldComponent } from '@shared/components/image-field.component';
import { TranslationField, TranslationFieldsComponent } from '@shared/components/translation-fields.component';

@Component({
  selector: 'app-company-admin',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, IconComponent, ImageFieldComponent, TranslationFieldsComponent],
  templateUrl: './company-admin.component.html',
})
export class CompanyAdminComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly loading = signal(true);
  readonly saving = signal(false);

  private readonly sanitizer = inject(DomSanitizer);
  private mapInput = '';
  private mapSafe: SafeResourceUrl | null = null;

  // Cached: a new SafeResourceUrl on every change detection would reload the iframe all the time
  mapPreview(): SafeResourceUrl | null {
    const input = this.form.controls.mapEmbedUrl.value ?? '';

    if (input !== this.mapInput) {
      this.mapInput = input;
      const url = buildMapEmbed(input);
      this.mapSafe = url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
    }

    return this.mapSafe;
  }

  readonly platforms = SOCIAL_PLATFORMS;
  readonly socials = signal<SocialLink[]>([]);
  readonly socialError = signal(false);

  readonly socialDraft = this.fb.nonNullable.group({ platform: ['facebook'], url: [''] });

  readonly fields: TranslationField[] = [
    { key: 'companyName', label: 'a.company.name', required: true },
    { key: 'tagline', label: 'a.company.tagline' },
    { key: 'workingHours', label: 'a.company.hours', multiline: true },
    { key: 'address', label: 'a.company.address' },
  ];

  readonly form = this.fb.group({
    contactEmail: [''],
    phone: [''],
    whatsAppNumber: [''],
    logoUrl: [''],
    heroImageUrl: [''],
    mapEmbedUrl: [''],
    translations: buildTranslationsGroup(this.fb, {
      companyName: true,
      tagline: false,
      workingHours: false,
      address: false,
    }),
  });

  ngOnInit(): void {
    this.api.getCompanyProfile().subscribe({
      next: (profile) => {
        this.form.patchValue({
          contactEmail: profile.contactEmail ?? '',
          phone: profile.phone ?? '',
          whatsAppNumber: profile.whatsAppNumber ?? '',
          logoUrl: profile.logoUrl ?? '',
          heroImageUrl: profile.heroImageUrl ?? '',
          mapEmbedUrl: profile.mapEmbedUrl ?? '',
        });
        this.socials.set([...profile.socialLinks].sort((a, b) => a.sortOrder - b.sortOrder));

        patchTranslations(this.form.controls.translations, profile.translations);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.error(this.i18n.t('a.company.nameRequired'));
      return;
    }

    const v = this.form.getRawValue();

    const input: CompanyProfileInput = {
      contactEmail: emptyToNull(v.contactEmail),
      phone: emptyToNull(v.phone),
      whatsAppNumber: emptyToNull(v.whatsAppNumber),
      logoUrl: emptyToNull(v.logoUrl),
      heroImageUrl: emptyToNull(v.heroImageUrl),
      mapEmbedUrl: emptyToNull(v.mapEmbedUrl),
      socialLinks: this.socials().map((l, i) => ({ ...l, sortOrder: i + 1 })),
      translations: readTranslations<CompanyProfileTranslation>(this.form.controls.translations, ['companyName']),
    };

    this.saving.set(true);
    this.api.updateCompanyProfile(input).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.i18n.t('a.company.saved'));
      },
      error: () => this.saving.set(false),
    });
  }

  // ---------------- social links table
  addSocial(): void {
    const { platform, url } = this.socialDraft.getRawValue();
    const clean = url.trim();

    if (!/^https?:\/\/.+/i.test(clean)) {
      this.socialError.set(true);
      return;
    }

    this.socialError.set(false);
    this.socials.update((list) => [...list, { platform, url: clean, isVisible: true, sortOrder: list.length + 1 }]);
    this.socialDraft.patchValue({ url: '' });
  }

  toggleSocial(index: number): void {
    this.socials.update((list) => list.map((l, i) => (i === index ? { ...l, isVisible: !l.isVisible } : l)));
  }

  removeSocial(index: number): void {
    this.socials.update((list) => list.filter((_, i) => i !== index));
  }

  moveSocial(index: number, delta: number): void {
    const target = index + delta;

    this.socials.update((list) => {
      if (target < 0 || target >= list.length) return list;

      const copy = [...list];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }
}