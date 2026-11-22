import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { AuthService } from '@shared/core/auth.service';
import { CostCenter, CostCenterInput, CostCenterReport } from '@shared/core/accounting.models';
import { I18nService } from '@shared/core/i18n.service';
import { ToastService } from '@shared/core/toast.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ModalComponent } from '@shared/components/modal.component';
import './cc.i18n';

import { IntroComponent } from '../intro.component';
type Tab = 'centers' | 'report';

// Cost centers: the list to manage, and the profit and loss of each center
@Component({
  host: { class: 'acc-center' },
  standalone: true,
  imports: [IntroComponent, FormsModule, DecimalPipe, TranslatePipe, ModalComponent],
  templateUrl: './cost-centers-admin.component.html',
  styleUrl: './cost-centers-admin.component.css',
})
export class CostCentersAdminComponent implements OnInit {
  private readonly api = inject(AccountingApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly canManage = this.auth.can('accounting.chart');
  readonly tabs: Tab[] = this.auth.can('accounting.reports') ? ['centers', 'report'] : ['centers'];
  readonly tab = signal<Tab>('centers');
  readonly centers = signal<CostCenter[]>([]);
  readonly editing = signal<CostCenter | { id: 0 } | null>(null);
  readonly saving = signal(false);
  readonly report = signal<CostCenterReport | null>(null);
  readonly open = signal<number>(-1);
  readonly from = signal(new Date().toISOString().slice(0, 8) + '01');
  readonly to = signal(new Date().toISOString().slice(0, 10));
  form: CostCenterInput = { code: '', name: '', nameAr: null, parentId: null, isActive: true, notes: null };

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getCostCenters().subscribe((c) => this.centers.set(c));
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    if (t === 'report' && !this.report()) this.loadReport();
  }

  loadReport(): void {
    this.api.getCostCenterReport(this.from(), this.to()).subscribe((r) => { this.report.set(r); this.open.set(-1); });
  }

  toggle(id: number | null): void {
    const key = id ?? 0;
    this.open.set(this.open() === key ? -1 : key);
  }

  accountsOf(r: CostCenterReport, id: number | null) {
    return r.accounts.filter((a) => a.costCenterId === id);
  }

  parentChoices(e: CostCenter | { id: 0 }): CostCenter[] {
    // One level only: a center that is already below another one cannot be a parent, nor can the center itself
    return this.centers().filter((c) => c.parentId === null && c.id !== e.id && c.isActive);
  }

  startEdit(c: CostCenter | null): void {
    this.form = c
      ? { code: c.code, name: c.name, nameAr: c.nameAr, parentId: c.parentId, isActive: c.isActive, notes: c.notes }
      : { code: '', name: '', nameAr: null, parentId: null, isActive: true, notes: null };
    this.editing.set(c ?? { id: 0 });
  }

  save(): void {
    const e = this.editing();
    if (!e) return;
    const body: CostCenterInput = {
      ...this.form, code: this.form.code.trim(), name: this.form.name.trim(), nameAr: this.form.nameAr?.trim() || null, notes: this.form.notes?.trim() || null,
    };
    this.saving.set(true);
    const done = {
      next: () => { this.saving.set(false); this.editing.set(null); this.toast.success(this.i18n.t('acc.cc.saved')); this.load(); },
      error: () => this.saving.set(false),
    };
    if (e.id) this.api.updateCostCenter(e.id, body).subscribe(done);
    else this.api.createCostCenter(body).subscribe(done);
  }

  remove(c: CostCenter): void {
    if (!confirm(this.i18n.t('acc.cc.deleteConfirm'))) return;
    this.api.deleteCostCenter(c.id).subscribe(() => this.load());
  }
}
