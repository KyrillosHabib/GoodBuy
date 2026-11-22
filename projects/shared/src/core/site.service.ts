import { Injectable, inject, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { catchError, of, switchMap, tap } from 'rxjs';
import { I18nService } from './i18n.service';
import { Home } from './models';
import { PublicApiService } from './public-api.service';
import { applyTheme } from './theme';

// Holds the landing-page payload (GET /api/public/home).
// It feeds the layout (name, contacts, socials) and the home page, and reloads when the language changes.
@Injectable({ providedIn: 'root' })
export class SiteService {
  private readonly api = inject(PublicApiService);
  private readonly i18n = inject(I18nService);

  readonly home = signal<Home | null>(null);
  readonly loading = signal(true);
  readonly failed = signal(false);

  constructor() {
    toObservable(this.i18n.lang)
      .pipe(
        tap(() => this.loading.set(true)),
        switchMap(() =>
          this.api.getHome().pipe(
            catchError(() => {
              this.failed.set(true);
              return of(null);
            }),
          ),
        ),
      )
      .subscribe((home) => {
        if (home) {
          this.home.set(home);
          applyTheme(home.settings);
          this.setTitle(home.company.companyName);
          this.failed.set(false);
        }

        this.loading.set(false);
      });
  }

  private setTitle(name: string): void {
    if (name) document.title = name;
  }
}
