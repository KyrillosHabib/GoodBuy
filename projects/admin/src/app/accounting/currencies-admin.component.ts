import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { environment } from '@shared/environments/environment';
import { ModalComponent } from '@shared/components/modal.component';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { CurrencyRateSettings } from '@shared/core/accounting.models';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';

import { IntroComponent } from '../intro.component';
interface CurrencyRow {
  code: string; name: string; nameEn: string; nameAr: string | null; symbol: string; decimalPlaces: number; isActive: boolean; isBase: boolean;
  sortOrder: number; rateToBase: number | null; rateUpdatedAtUtc: string | null; rateUpdatedBy: string | null; isRateManual: boolean;
}
interface RateHistory { rateToBase: number; createdAtUtc: string; createdByName: string | null; }

// The currencies the customers can choose in the store and the rate of each one against the store currency
@Component({
  selector: 'app-currencies-admin',
  standalone: true,
  imports: [IntroComponent, FormsModule, DecimalPipe, SlicePipe, TranslatePipe, ModalComponent],
  templateUrl: './currencies-admin.component.html',
})
export class CurrenciesAdminComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly url = `${environment.apiUrl}/api/admin/currencies`;

  readonly canEdit = this.auth.can('settings', 'accounting.settings');
  readonly rows = signal<CurrencyRow[]>([]);
  readonly editing = signal<CurrencyRow | null>(null);
  readonly history = signal<{ code: string; rows: RateHistory[] } | null>(null);
  readonly saving = signal(false);
  readonly auto = signal<CurrencyRateSettings | null>(null);
  private readonly accounting = inject(AccountingApiService);
  rate = 0;
  manual = true;

  ngOnInit(): void {
    this.load();
    this.accounting.getRateSettings().subscribe((a) => this.auto.set(a));
  }

  saveAuto(a: CurrencyRateSettings): void {
    this.saving.set(true);
    this.accounting.saveRateSettings({ autoUpdate: a.autoUpdate, intervalHours: +a.intervalHours, marginPercent: +a.marginPercent, providerUrl: a.providerUrl || null }).subscribe({
      next: () => { this.saving.set(false); this.toast.success(this.i18n.t('inv.saved')); },
      error: () => this.saving.set(false),
    });
  }

  // Brings the rates in right now
  runAuto(a: CurrencyRateSettings): void {
    this.saving.set(true);
    this.accounting.saveRateSettings({ autoUpdate: a.autoUpdate, intervalHours: +a.intervalHours, marginPercent: +a.marginPercent, providerUrl: a.providerUrl || null }).subscribe({
      next: () => this.accounting.runRateUpdate().subscribe({
        next: (r) => {
          this.saving.set(false);
          if (r.ok) this.toast.success(r.message); else this.toast.error(r.message);
          this.load();
          this.accounting.getRateSettings().subscribe((x) => this.auto.set(x));
        },
        error: () => this.saving.set(false),
      }),
      error: () => this.saving.set(false),
    });
  }

  load(): void {
    this.http.get<CurrencyRow[]>(this.url).subscribe((r) => this.rows.set(r));
  }

  startRate(c: CurrencyRow): void {
    this.rate = c.rateToBase ?? 0;
    this.manual = true;
    this.editing.set(c);
  }

  saveRate(c: CurrencyRow): void {
    this.saving.set(true);
    const request: Observable<unknown> = this.http.post(`${this.url}/${c.code}/rates`, { rate: this.rate, manual: this.manual });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.toast.success(this.i18n.t('inv.saved'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  toggle(c: CurrencyRow): void {
    this.http.put(`${this.url}/${c.code}`, { isActive: !c.isActive }).subscribe(() => this.load());
  }

  showHistory(c: CurrencyRow): void {
    this.http.get<RateHistory[]>(`${this.url}/${c.code}/rates`).subscribe((rows) => this.history.set({ code: c.code, rows }));
  }
}
