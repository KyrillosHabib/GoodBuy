import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { AccountingContext } from '@shared/core/accounting-context.service';
import { AccountingSettings, CashAccount, PaymentMap } from '@shared/core/accounting.models';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';

import { IntroComponent } from '../intro.component';
type PolicyKey = 'autoPostSales' | 'autoPostCollections' | 'autoPostPurchases' | 'autoPostReturns' | 'autoPostStockAdjustments' | 'autoPostOnlineCollections';

// How the store and the warehouses reach the books: what is posted by itself, what waits for a person, and where each payment goes
@Component({
  selector: 'app-automation-admin',
  standalone: true,
  imports: [IntroComponent, FormsModule, DecimalPipe, TranslatePipe],
  templateUrl: './automation-admin.component.html',
})
export class AutomationAdminComponent implements OnInit {
  private readonly api = inject(AccountingApiService);
  private readonly ctx = inject(AccountingContext);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  readonly canEdit = this.auth.can('accounting.settings');
  readonly policies: { key: PolicyKey }[] = [
    { key: 'autoPostSales' }, { key: 'autoPostCollections' }, { key: 'autoPostPurchases' }, { key: 'autoPostReturns' }, { key: 'autoPostStockAdjustments' }, { key: 'autoPostOnlineCollections' },
  ];

  readonly settings = signal<AccountingSettings | null>(null);
  readonly map = signal<PaymentMap[]>([]);
  readonly cash = signal<CashAccount[]>([]);
  readonly saving = signal(false);

  ngOnInit(): void {
    this.api.getSettings().subscribe((s) => this.settings.set(s));
    this.api.getPaymentMap().subscribe((m) => this.map.set(m));
    this.api.getCashAccounts().subscribe((c) => this.cash.set(c.filter((x) => x.isActive)));
  }

  setPolicy(key: PolicyKey, value: boolean): void {
    this.settings.update((s) => (s ? { ...s, [key]: value } : s));
  }

  setTarget(method: string, id: number | null): void {
    this.map.update((list) => list.map((m) => (m.method === method ? { ...m, cashAccountId: id } : m)));
  }

  savePolicies(): void {
    const s = this.settings();
    if (!s) return;
    this.saving.set(true);
    this.api.saveSettings(s).subscribe({
      next: () => { this.saving.set(false); this.toast.success(this.i18n.t('inv.saved')); this.ctx.load(true); },
      error: () => this.saving.set(false),
    });
  }

  saveMap(): void {
    const items = this.map().filter((m) => m.cashAccountId !== null).map((m) => ({ method: m.method, cashAccountId: m.cashAccountId as number }));
    this.saving.set(true);
    this.api.savePaymentMap(items).subscribe({
      next: () => { this.saving.set(false); this.toast.success(this.i18n.t('inv.saved')); },
      error: () => this.saving.set(false),
    });
  }
}
