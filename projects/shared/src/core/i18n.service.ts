import { Injectable, computed, effect, signal } from '@angular/core';
import { DICTIONARY } from './i18n.dictionary';
import { Language } from './models';

const STORAGE_KEY = 'voltara.lang';

@Injectable({ providedIn: 'root' })
export class I18nService {
  private readonly _lang = signal<Language>(this.restore());

  readonly lang = this._lang.asReadonly();
  readonly isRtl = computed(() => this._lang() === 'ar');

  constructor() {
    // Keeps <html lang> and <html dir> in sync (RTL for Arabic)
    effect(() => {
      const lang = this._lang();

      document.documentElement.lang = lang;
      document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
      localStorage.setItem(STORAGE_KEY, lang);
    });
  }

  set(lang: Language): void {
    this._lang.set(lang);
  }

  toggle(): void {
    this._lang.update((lang) => (lang === 'en' ? 'ar' : 'en'));
  }

  // t('a.cat.edit', { id: 3 }) replaces {id} in the text
  t(key: string, params?: Record<string, string | number>): string {
    const text = DICTIONARY[this._lang()][key] ?? DICTIONARY.en[key] ?? key;

    if (!params) return text;

    return Object.entries(params).reduce(
      (result, [name, value]) => result.split(`{${name}}`).join(String(value)),
      text,
    );
  }

  private restore(): Language {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'en' || saved === 'ar') return saved;

    return navigator.language?.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  }
}
