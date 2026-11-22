import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map, tap } from 'rxjs';
import { environment } from '../environments/environment';
import { LoginResponse } from './models';

const STORAGE_KEY = 'voltara.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  private readonly _session = signal<LoginResponse | null>(this.restore());

  readonly session = this._session.asReadonly();
  readonly roles = computed(() => this._session()?.roles ?? []);
  readonly isAdmin = computed(() => this._session()?.roles.includes('Admin') ?? false);
  readonly isStaff = computed(() => this._session()?.roles.includes('WarehouseStaff') ?? false);
  // What the signed-in dashboard user may open: each role has its own list (Dashboard > Roles)
  readonly permissions = computed(() => this._session()?.permissions ?? []);
  // Anyone with a role that has at least one screen may open the dashboard
  readonly canUseDashboard = computed(() => this.isAdmin() || this.isStaff() || this.permissions().length > 0);
  readonly isCustomer = computed(() => this._session()?.roles.includes('Customer') ?? false);
  readonly email = computed(() => this._session()?.email ?? '');
  // An employee with the password the administrator gave: the dashboard only shows the "choose a new password" page
  readonly mustChangePassword = computed(() => this._session()?.mustChangePassword === true);

  // True when the user may use a screen: the Admin role everything, any other role what was ticked for it
  can(...anyOf: string[]): boolean {
    return this.isAdmin() || anyOf.some((p) => this.permissions().includes(p));
  }

  // The roles can be changed while someone is signed in: the menu is refreshed from the server
  refreshAccess(): Observable<void> {
    return this.http.get<{ roles: string[]; permissions: string[] }>(`${environment.apiUrl}/api/staff/me`).pipe(
      tap((me) => {
        const s = this._session();

        if (s) this.setSession({ ...s, roles: me.roles, permissions: me.permissions });
      }),
      map(() => undefined),
    );
  }

  token(): string | null {
    return this._session()?.accessToken ?? null;
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${environment.apiUrl}/api/auth/login`, { email, password })
      .pipe(
        tap((session) => this.setSession(session)),
      );
  }

  // The dashboard user changes their own password; the session is closed afterwards and they sign in with the new one
  changeOwnPassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${environment.apiUrl}/api/staff/change-password`, { currentPassword, newPassword });
  }

  // Also used after the e-mail code was verified (that answer is a sign-in too)
  setSession(session: LoginResponse): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    this._session.set(session);
  }

  // The dashboard goes back to its login page, the shop to the home page
  logout(redirect = '/login'): void {
    localStorage.removeItem(STORAGE_KEY);
    this._session.set(null);
    void this.router.navigate([redirect]);
  }

  private restore(): LoginResponse | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      const session = JSON.parse(raw) as LoginResponse;
      const expired = new Date(session.expiresAtUtc.endsWith('Z') ? session.expiresAtUtc : session.expiresAtUtc + 'Z').getTime() <= Date.now();

      return expired ? null : session;
    } catch {
      return null;
    }
  }
}
