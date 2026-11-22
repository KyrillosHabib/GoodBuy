import { Component, Input, inject } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { environment } from '../environments/environment';
import { I18nService } from '../core/i18n.service';
import { TranslatePipe } from '../core/pipes';
import { LANGUAGES, LANGUAGE_LABELS } from '../core/translation-forms';

export interface TranslationField {
  key: string;
  // Translation key of the label (e.g. 'a.name')
  label: string;
  multiline?: boolean;
  required?: boolean;
}

// One box per content language, each with the same set of fields.
// `group` is built with buildTranslationsGroup(): { en: { name }, ar: { name } }
@Component({
  selector: 'app-translation-fields',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './translation-fields.component.html',
})
export class TranslationFieldsComponent {
  readonly i18n = inject(I18nService);

  @Input({ required: true }) group!: FormGroup;
  @Input({ required: true }) fields: TranslationField[] = [];

  readonly languages = LANGUAGES;
  readonly labels = LANGUAGE_LABELS;
  readonly defaultLanguage = environment.defaultLanguage;

  langGroup(lang: string): FormGroup {
    return this.group.get(lang) as FormGroup;
  }

  dirOf(lang: string): string {
    return lang === 'ar' ? 'rtl' : 'ltr';
  }
}
