import { Pipe, PipeTransform, inject } from '@angular/core';
import { environment } from '../environments/environment';
import { I18nService } from './i18n.service';
import {
  ILLUSTRATIONS,
  Illustration,
  categoryIllustration,
  isPlaceholderUrl,
  productIllustration,
} from './illustrations';

function resolve(value: string): string {
  return value.startsWith('/') ? `${environment.apiUrl}${value}` : value;
}

// "/uploads/images/a.jpg" (served by the API) -> "https://localhost:7180/uploads/images/a.jpg".
// Absolute URLs are returned untouched.
@Pipe({ name: 'assetUrl', standalone: true })
export class AssetUrlPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    return value ? resolve(value) : '';
  }
}

// Product photo, or the matching illustration when there is no real photo
@Pipe({ name: 'productImage', standalone: true })
export class ProductImagePipe implements PipeTransform {
  transform(url: string | null | undefined, slug?: string | null, categorySlug?: string | null): string {
    return isPlaceholderUrl(url) ? productIllustration(slug, categorySlug) : resolve(url as string);
  }
}

@Pipe({ name: 'categoryImage', standalone: true })
export class CategoryImagePipe implements PipeTransform {
  transform(url: string | null | undefined, slug?: string | null): string {
    return isPlaceholderUrl(url) ? categoryIllustration(slug) : resolve(url as string);
  }
}

// Generic: stored image or one of the built-in illustrations ('hero' | 'about' | 'default')
@Pipe({ name: 'imageOr', standalone: true })
export class ImageOrPipe implements PipeTransform {
  transform(url: string | null | undefined, fallback: Illustration = 'default'): string {
    return isPlaceholderUrl(url) ? ILLUSTRATIONS[fallback] : resolve(url as string);
  }
}

// Impure on purpose: re-evaluated when the language changes.
// Usage: {{ 'key' | t }}   or   {{ 'a.cat.edit' | t: { id: 3 } }}
@Pipe({ name: 't', standalone: true, pure: false })
export class TranslatePipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(key: string, params?: Record<string, string | number>): string {
    return this.i18n.t(key, params);
  }
}
