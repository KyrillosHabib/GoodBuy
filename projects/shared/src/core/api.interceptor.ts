import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { environment } from '../environments/environment';
import { AuthService } from './auth.service';
import { I18nService } from './i18n.service';
import { ToastService } from './toast.service';

// The API answers in English. Messages the dashboard knows are shown in the language of the screen;
// the others are shown as they come.
const PATTERNS: [RegExp, string, string[]][] = [
  [/^Not enough stock in the source warehouse \(available: (\d+)\)\.$/, 'api.notEnoughSource', ['n']],
  [/^Only (\d+) left in stock\.$/, 'api.onlyLeft', ['n']],
  [/^A warehouse with the code '(.+)' already exists\.$/, 'api.codeExists', ['code']],
];

function localize(message: string, i18n: I18nService): string {
  const exact = i18n.t(`api:${message}`);

  if (exact !== `api:${message}`) return exact;

  for (const [pattern, key, names] of PATTERNS) {
    const match = pattern.exec(message);

    if (match) return i18n.t(key, Object.fromEntries(names.map((n, i) => [n, match[i + 1]])));
  }

  return message;
}

function extractMessage(error: HttpErrorResponse, i18n: I18nService): string {
  if (error.status === 0) return i18n.t('err.network');
  if (error.status === 429) return i18n.t('err.tooMany');
  // 409: the API found that someone else saved the same data first (stock, etc.)
  if (error.status === 409 && error.error?.title === 'Conflict') return i18n.t('err.conflict');
  if (error.status === 403) return i18n.t('err.forbidden');

  const body = error.error;

  // ValidationProblemDetails: { errors: { "Input.Slug": ["msg"] } }  (messages come from the API, in English)
  if (body && typeof body === 'object' && body.errors && typeof body.errors === 'object') {
    const messages = Object.entries(body.errors as Record<string, string[]>)
      .flatMap(([field, list]) => list.map((message) => `${field}: ${localize(message, i18n)}`))
      .slice(0, 3);

    if (messages.length > 0) return messages.join(' | ');
  }

  if (body && typeof body.detail === 'string') return localize(body.detail, i18n);
  if (body && typeof body.title === 'string') return localize(body.title, i18n);

  return i18n.t('err.unexpected', { status: error.status });
}

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  // Only talk to our own API
  if (!req.url.startsWith(environment.apiUrl)) return next(req);

  const auth = inject(AuthService);
  const i18n = inject(I18nService);
  const toast = inject(ToastService);

  let request = req;

  // The API picks the response language from ?lang=
  if (req.method === 'GET' && !req.params.has('lang')) {
    request = request.clone({ params: request.params.set('lang', i18n.lang()) });
  }

  const token = auth.token();
  if (token) {
    request = request.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  }

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && token) {
        auth.logout();
        toast.warning(i18n.t('err.sessionExpired'));
      } else if (error.status !== 404 && !(error.status === 403 && error.error?.code)) {
        // (a 403 with a "code", such as email_not_verified, is handled by the page itself)
        // 404 is handled by the page itself (e.g. "product not found")
        toast.error(extractMessage(error, i18n));
      }

      return throwError(() => error);
    }),
  );
};
