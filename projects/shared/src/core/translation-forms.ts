import { FormBuilder, FormGroup, ValidatorFn, Validators } from '@angular/forms';
import { environment } from '../environments/environment';

export const LANGUAGES: readonly string[] = environment.languages;

export const LANGUAGE_LABELS: Record<string, string> = { en: 'English', ar: 'العربية' };

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// Builds { en: { field: '' }, ar: { field: '' } }.
// `fields` maps a field name to "required". Only the default language is really required.
export function buildTranslationsGroup(fb: FormBuilder, fields: Record<string, boolean>): FormGroup {
  const languages: Record<string, FormGroup> = {};

  for (const lang of LANGUAGES) {
    const controls: Record<string, [string, ValidatorFn[]]> = {};

    for (const [field, required] of Object.entries(fields)) {
      const isRequired = required && lang === environment.defaultLanguage;
      controls[field] = ['', isRequired ? [Validators.required] : []];
    }

    languages[lang] = fb.group(controls);
  }

  return fb.group(languages);
}

// Converts the form group to the API shape: [{ languageCode, ...fields }].
// A language is skipped unless all `requiredFields` are filled. Empty optional fields become null.
export function readTranslations<T>(group: FormGroup, requiredFields: string[]): T[] {
  const result: T[] = [];

  for (const lang of LANGUAGES) {
    const value = (group.get(lang)?.value ?? {}) as Record<string, string | null>;

    if (requiredFields.some((field) => !(value[field] ?? '').trim())) continue;

    const entry: Record<string, string | null> = { languageCode: lang };

    for (const [key, raw] of Object.entries(value)) {
      entry[key] = (raw ?? '').trim() || null;
    }

    result.push(entry as unknown as T);
  }

  return result;
}

export function patchTranslations(group: FormGroup, translations: { languageCode: string }[]): void {
  for (const translation of translations) {
    group.get(translation.languageCode)?.patchValue(translation);
  }
}

// "Air Fryer 5L!" -> "air-fryer-5l"
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function emptyToNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}
