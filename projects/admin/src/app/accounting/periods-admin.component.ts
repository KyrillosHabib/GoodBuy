import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '@shared/components/modal.component';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { FiscalOverview, FiscalPeriod, FiscalYear } from '@shared/core/accounting.models';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { AccEntryDetailsComponent } from './acc-entry-details.component';

import { IntroComponent } from '../intro.component';
// Fiscal years and the periods inside them. Everything in the books belongs to a period; a closed period takes nothing.
@Component({
  selector: 'app-periods-admin',
  standalone: true,
  imports: [IntroComponent, FormsModule, DecimalPipe, SlicePipe, TranslatePipe, ModalComponent, AccEntryDetailsComponent],
  templateUrl: './periods-admin.component.html',
  styleUrl: './periods-admin.component.css',
})
export class PeriodsAdminComponent implements OnInit {
  private readonly api = inject(AccountingApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  readonly canEdit = this.auth.can('accounting.settings');
  readonly overview = signal<FiscalOverview | null>(null);
  readonly yearForm = signal<{ name: string; startDate: string; split: 'Month' | 'Quarter' } | null>(null);
  readonly closingShown = signal<number | null>(null);
  readonly busy = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getFiscalYears().subscribe((o) => this.overview.set(o));
  }

  startYear(): void {
    const years = this.overview()?.years ?? [];
    const next = years.length > 0 ? new Date(new Date(years[0].endDate).getTime() + 86_400_000) : new Date(new Date().getFullYear(), 0, 1);
    const iso = new Date(Date.UTC(next.getFullYear(), next.getMonth(), next.getDate())).toISOString().slice(0, 10);
    this.yearForm.set({ name: '', startDate: iso, split: 'Month' });
  }

  createYear(f: { name: string; startDate: string; split: 'Month' | 'Quarter' }): void {
    this.busy.set(true);
    this.api.createFiscalYear({ name: f.name.trim() || null, startDate: f.startDate, split: f.split }).subscribe({
      next: () => { this.busy.set(false); this.yearForm.set(null); this.toast.success(this.i18n.t('inv.saved')); this.load(); },
      error: () => this.busy.set(false),
    });
  }

  setClosed(p: FiscalPeriod, closed: boolean): void {
    this.busy.set(true);
    this.api.setFiscalPeriod(p.id, closed).subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: () => this.busy.set(false),
    });
  }

  closeYear(y: FiscalYear): void {
    if (!confirm(this.i18n.t('accs.per.closeConfirm', { year: y.name }))) return;
    this.busy.set(true);
    this.api.closeFiscalYear(y.id).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.toast.success(this.i18n.t('accs.per.closedResult', { result: r.result.toFixed(2) }));
        this.load();
      },
      error: () => this.busy.set(false),
    });
  }

  toggleClosing(y: FiscalYear): void {
    this.closingShown.set(this.closingShown() === y.id ? null : y.id);
  }
}
