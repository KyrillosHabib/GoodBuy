import { Injectable, inject, signal } from '@angular/core';
import { AccountingApiService } from './accounting-api.service';
import { AccountingSettings } from './accounting.models';

// The rules of the accounting module (self-approval, closed period, currency), loaded once for every screen
@Injectable({ providedIn: 'root' })
export class AccountingContext {
  private readonly api = inject(AccountingApiService);
  private loading = false;

  readonly settings = signal<AccountingSettings | null>(null);

  load(force = false): void {
    if ((this.settings() && !force) || this.loading) return;
    this.loading = true;
    this.api.getSettings().subscribe({
      next: (s) => { this.settings.set(s); this.loading = false; },
      error: () => { this.loading = false; },
    });
  }
}
