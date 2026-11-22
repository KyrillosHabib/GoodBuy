import './help.i18n';
import { HelpService } from './help.service';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, of, switchMap } from 'rxjs';
import { ThemeColors, deriveTheme, shiftTheme } from '@shared/core/theme-catalog';
import { ImageFieldComponent } from '@shared/components/image-field.component';
import { AdminApiService } from '@shared/core/admin-api.service';
import { I18nService } from '@shared/core/i18n.service';
import { HeroSlide, SiteSettingsAdmin } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { FONT_OPTIONS, applyTheme, fontStack, loadFonts } from '@shared/core/theme';
import { ToastService } from '@shared/core/toast.service';
import { emptyToNull } from '@shared/core/translation-forms';

import { IntroComponent } from './intro.component';
type Tab = 'appearance' | 'chrome' | 'catalog' | 'email';

// Ready colour schemes: the main colour (buttons, links, the highlight) and the colour of offers; the rest follows from them
const SCHEME_SEEDS: { id: string; ar: string; en: string; primary: string; accent: string }[] = [
  { id: 'crimson', ar: 'أحمر كلاسيكي', en: 'Classic crimson', primary: '#b91c1c', accent: '#f59e0b' },
  { id: 'navy', ar: 'كحلي وذهبي', en: 'Navy & gold', primary: '#1e3a8a', accent: '#d97706' },
  { id: 'forest', ar: 'أخضر غامق', en: 'Deep forest', primary: '#166534', accent: '#ea580c' },
  { id: 'burgundy', ar: 'عنابي', en: 'Burgundy', primary: '#7f1d1d', accent: '#ca8a04' },
  { id: 'teal', ar: 'تركوازي', en: 'Teal', primary: '#0f766e', accent: '#e11d48' },
  { id: 'orange', ar: 'برتقالي حيوي', en: 'Vivid orange', primary: '#ea580c', accent: '#dc2626' },
  { id: 'plum', ar: 'بنفسجي ملكي', en: 'Royal plum', primary: '#6d28d9', accent: '#f59e0b' },
  { id: 'mono', ar: 'أسود أنيق', en: 'Elegant black', primary: '#111111', accent: '#dc2626' },
];

interface Toggle {
  key: string;
  label: string;
}

// Everything the website owner can change without a developer: colors, fonts, which sections
// and footer blocks are visible, the featured-products limit, the product code prefix and email.
@Component({
  selector: 'app-settings-admin',
  standalone: true,
  imports: [IntroComponent, ReactiveFormsModule, TranslatePipe, ImageFieldComponent],
  templateUrl: './settings-admin.component.html',
})
export class SettingsAdminComponent implements OnInit {
  readonly help = inject(HelpService);
  private storefrontJson: string | null = null;
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly tabs: { id: Tab; label: string }[] = [
    { id: 'appearance', label: 'a.set.tab.appearance' },
    { id: 'chrome', label: 'a.set.tab.chrome' },
    { id: 'catalog', label: 'a.set.tab.catalog' },
    { id: 'email', label: 'a.set.tab.email' },
  ];

  readonly schemes = SCHEME_SEEDS.map((x) => ({ ...x, theme: deriveTheme(x.primary, x.accent, '#ffffff') }));
  readonly lang = this.i18n.lang;

  isScheme(s: (typeof this.schemes)[number]): boolean {
    const v = this.form.getRawValue();

    return v.primaryColor.toLowerCase() === s.primary && v.accentColor.toLowerCase() === s.accent;
  }

  chooseScheme(s: (typeof this.schemes)[number]): void {
    this.autoDerive = true;
    this.form.patchValue(s.theme);
  }

  // The slides of the cover: a picture and its own text and button (per language)
  slides: { image: FormControl<string>; title: Record<string, string>; subtitle: Record<string, string>; buttonLabel: Record<string, string>; buttonUrl: string }[] = [];

  val(event: Event): string {
    return (event.target as HTMLInputElement).value;
  }

  private newSlide(h?: HeroSlide): (typeof this.slides)[number] {
    return {
      image: new FormControl(h?.imageUrl ?? '', { nonNullable: true }),
      title: { en: '', ar: '', ...(h?.title ?? {}) },
      subtitle: { en: '', ar: '', ...(h?.subtitle ?? {}) },
      buttonLabel: { en: '', ar: '', ...(h?.buttonLabel ?? {}) },
      buttonUrl: h?.buttonUrl ?? '',
    };
  }

  // The owner can still lighten / darken the identity colors by hand
  shift(delta: number): void {
    const v = this.form.getRawValue();

    this.form.patchValue(shiftTheme(v as unknown as ThemeColors, delta));
  }

  addSlide(): void {
    if (this.slides.length < 10) this.slides.push(this.newSlide());
  }

  removeSlide(i: number): void {
    this.slides.splice(i, 1);
  }

  moveSlide(i: number, by: number): void {
    const j = i + by;

    if (j < 0 || j >= this.slides.length) return;

    [this.slides[i], this.slides[j]] = [this.slides[j], this.slides[i]];
  }
  readonly fonts = FONT_OPTIONS;

  // Only THREE colors are chosen by hand: more than that makes the screen busy. The others follow from them (or are set under "Advanced").
  readonly colorFields: Toggle[] = [
    { key: 'primaryColor', label: 'a.set.primary' },
    { key: 'accentColor', label: 'a.set.accent' },
    { key: 'backgroundColor', label: 'a.set.background' },
  ];

  readonly advancedColorFields: Toggle[] = [
    { key: 'secondaryColor', label: 'a.set.secondary' },
    { key: 'textColor', label: 'a.set.text' },
    { key: 'darkColor', label: 'a.set.dark' },
  ];

  // The other colors follow the three main ones until the owner sets one of them by hand
  autoDerive = true;

  mainColorChanged(): void {
    if (!this.autoDerive) return;

    const v = this.form.getRawValue();
    const hex = /^#[0-9a-fA-F]{6}$/;

    if (hex.test(v.primaryColor) && hex.test(v.accentColor) && hex.test(v.backgroundColor)) {
      this.form.patchValue(deriveTheme(v.primaryColor, v.accentColor, v.backgroundColor));
    }
  }

  readonly headerToggles: Toggle[] = [
    { key: 'showLanguageSwitcher', label: 'a.set.langSwitcher' },
    { key: 'showWhatsAppButton', label: 'a.set.whatsappButton' },
  ];

  readonly footerToggles: Toggle[] = [
    { key: 'showFooterAbout', label: 'a.set.foot.about' },
    { key: 'showFooterQuickLinks', label: 'a.set.foot.links' },
    { key: 'showFooterCategories', label: 'a.set.foot.categories' },
    { key: 'showFooterContact', label: 'a.set.foot.contact' },
    { key: 'showFooterSocials', label: 'a.set.foot.socials' },
  ];

  readonly tab = signal<Tab>('appearance');
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly testing = signal(false);
  readonly hasPassword = signal(false);
  readonly testTo = signal('');

  private readonly color = [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{6}$/)];

  readonly form = this.fb.nonNullable.group({
    primaryColor: ['#ea580c', this.color],
    darkColor: ['#1c1917', this.color],
    backgroundColor: ['#fafaf9', this.color],
    textColor: ['#1c1917', this.color],
    headingFont: ['system'],
    bodyFont: ['system'],
    borderRadius: [16],
    heroOverlay: [75],
    secondaryColor: ['#64748b', [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{6}$/)]],
    accentColor: ['#f59e0b', [Validators.required, Validators.pattern(/^#[0-9a-fA-F]{6}$/)]],
    heroMode: ['image'],
    heroSlides: [[] as HeroSlide[]],
    splashEnabled: [false],
    splashSeconds: [2, [Validators.min(1), Validators.max(10)]],
    reviewsEnabled: [true],
    reviewsAutoApprove: [false],
    fontScale: [100],
    enableAnimations: [true],
    faviconUrl: [''],
    defaultTheme: [''],

    showLanguageSwitcher: [true],
    showWhatsAppButton: [true],


    showFooterAbout: [true],
    showFooterQuickLinks: [true],
    showFooterCategories: [true],
    showFooterContact: [true],
    showFooterSocials: [true],

    featuredProductsLimit: [8, [Validators.min(1), Validators.max(24)]],
    defaultLowStockThreshold: [5, [Validators.required, Validators.min(0)]],
    shippingFee: [0, [Validators.required, Validators.min(0)]],
    skuPrefix: ['VLT', [Validators.required, Validators.pattern(/^[A-Za-z0-9]{1,10}$/)]],


    emailEnabled: [false],
    smtpHost: [''],
    smtpPort: [587],
    smtpUser: [''],
    smtpPassword: [''],
    smtpUseSsl: [true],
    smtpAcceptAnyCertificate: [false],
    mailFromEmail: ['', Validators.email],
    mailFromName: [''],
    notifyEmail: ['', Validators.email],
    notifyOnInquiry: [true],
    sendAutoReply: [false],
  });

  ngOnInit(): void {
    this.api.getSettings().subscribe({
      next: (s) => {
        this.form.patchValue({
          ...s,
          faviconUrl: s.faviconUrl ?? '',
          heroSlides: s.heroSlides ?? [],
          defaultTheme: s.defaultTheme ?? '',
          smtpHost: s.smtpHost ?? '',
          smtpUser: s.smtpUser ?? '',
          smtpPassword: '',
          mailFromEmail: s.mailFromEmail ?? '',
          mailFromName: s.mailFromName ?? '',
          notifyEmail: s.notifyEmail ?? '',
        });

        this.slides = (s.heroSlides ?? []).map((h) => this.newSlide(h));
        // Edited on its own screen (Website -> Storefront): kept as it is so saving here never erases it
        this.storefrontJson = s.storefrontJson ?? null;


        this.form.patchValue({ defaultTheme: s.defaultTheme ?? '' });
        this.parseDefault(s.defaultTheme);

        this.hasPassword.set(s.hasSmtpPassword);
        this.testTo.set(s.notifyEmail ?? '');
        loadFonts(FONT_OPTIONS.map((f) => f.value), 'voltara-fonts-all');
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  // The theme the owner marked as "my default"
  readonly savedDefault = signal<{ primaryColor: string; darkColor: string; backgroundColor: string; textColor: string; headingFont: string; bodyFont: string; borderRadius: number; fontScale: number } | null>(null);

  private parseDefault(raw: string | null | undefined): void {
    try {
      this.savedDefault.set(raw ? JSON.parse(raw) : null);
    } catch {
      this.savedDefault.set(null);
    }
  }

  saveAsDefault(): void {
    const v = this.form.getRawValue();
    const theme = {
      primaryColor: v.primaryColor, darkColor: v.darkColor, backgroundColor: v.backgroundColor, textColor: v.textColor,
      headingFont: v.headingFont, bodyFont: v.bodyFont, borderRadius: Number(v.borderRadius), fontScale: Number(v.fontScale),
    };

    this.form.controls.defaultTheme.setValue(JSON.stringify(theme));
    this.parseDefault(JSON.stringify(theme));
    this.save();
  }

  restoreDefault(): void {
    const d = this.savedDefault();

    if (d) this.form.patchValue(d);
  }


  stack(font: string): string {
    return fontStack(font);
  }

  setFont(control: 'headingFont' | 'bodyFont', value: string): void {
    this.form.controls[control].setValue(value);
  }

  save(): void {
    this.persist().subscribe({ error: () => undefined });
  }

  sendTest(): void {
    this.testing.set(true);

    // The server sends with the SAVED account, so the form is saved first
    this.persist(false)
      .pipe(switchMap((ok) => (ok ? this.api.sendTestEmail(this.testTo().trim()) : of(null))))
      .subscribe({
        next: () => {
          this.testing.set(false);
          this.toast.success(this.i18n.t('a.set.testSent'));
        },
        error: () => this.testing.set(false),
      });
  }

  // Resolves true when saved
  private persist(announce = true): Observable<boolean> {
    this.form.controls.heroSlides.setValue(
      this.slides
        .filter((x) => x.image.value.trim())
        .map((x) => ({ imageUrl: x.image.value.trim(), title: x.title, subtitle: x.subtitle, buttonLabel: x.buttonLabel, buttonUrl: x.buttonUrl.trim() || null })),
    );

    return new Observable<boolean>((observer) => {
      if (this.form.invalid) {
        this.form.markAllAsTouched();
        this.toast.error(this.i18n.t('a.fixFields'));
        observer.next(false);
        observer.complete();
        return;
      }

      const v = this.form.getRawValue();

      const input: SiteSettingsAdmin = {
        ...v,
        storefrontJson: this.storefrontJson,
        defaultTheme: emptyToNull(v.defaultTheme),
        faviconUrl: emptyToNull(v.faviconUrl),
        borderRadius: Number(v.borderRadius),
        fontScale: Number(v.fontScale),
        heroOverlay: Number(v.heroOverlay),
        heroMode: v.heroMode === 'slider' ? 'slider' : 'image',
        featuredProductsLimit: Number(v.featuredProductsLimit),
        smtpPort: Number(v.smtpPort) || 587,
        smtpHost: emptyToNull(v.smtpHost),
        smtpUser: emptyToNull(v.smtpUser),
        // empty = keep the stored password
        smtpPassword: emptyToNull(v.smtpPassword),
        hasSmtpPassword: this.hasPassword(),
        mailFromEmail: emptyToNull(v.mailFromEmail),
        mailFromName: emptyToNull(v.mailFromName),
        notifyEmail: emptyToNull(v.notifyEmail),
      };

      this.saving.set(true);
      this.api.updateSettings(input).subscribe({
        next: () => {
          this.saving.set(false);
          if (input.smtpPassword) {
            this.hasPassword.set(true);
            this.form.patchValue({ smtpPassword: '' });
          }
          // the dashboard itself changes right away (the website after its next refresh)
          applyTheme(input, true, false);
          if (announce) this.toast.success(this.i18n.t('a.set.saved'));
          observer.next(true);
          observer.complete();
        },
        error: (e) => {
          this.saving.set(false);
          observer.error(e);
        },
      });
    });
  }
}
