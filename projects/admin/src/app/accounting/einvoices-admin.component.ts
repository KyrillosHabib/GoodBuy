import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '@shared/environments/environment';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { ToastService } from '@shared/core/toast.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ModalComponent } from '@shared/components/modal.component';
import './einvoices.i18n';

import { IntroComponent } from '../intro.component';
interface TaxProfile {
  legalName: string | null; taxRegistrationNumber: string | null; branchCode: string; activityCode: string | null; country: string; governate: string | null;
  regionCity: string | null; street: string | null; buildingNumber: string | null; itemCodeType: string; defaultItemCode: string | null; defaultUnitType: string; environment: string;
}
interface EInvoiceRow {
  documentId: number; documentNumber: string; documentKind: string; etaType: string; issueDate: string; partyId: number; partyName: string; partyTaxNumber: string | null;
  total: number; taxTotal: number; eInvoiceId: number | null; status: string; uuid: string | null; submissionUuid: string | null; longId: string | null;
  errorMessage: string | null; generatedAtUtc: string | null;
}
interface EInvoiceDetail { row: EInvoiceRow; problems: string[]; json: string | null }
interface VatMonth { month: string; outputVat: number; inputVat: number; net: number }
interface VatReport { from: string; to: string; months: VatMonth[]; outputVat: number; inputVat: number; netPayable: number; taxableSales: number; taxablePurchases: number }

const STATUSES = ['Submitted', 'Valid', 'Invalid', 'Cancelled'];

// Electronic invoices for the Egyptian Tax Authority (prepared here, signed and submitted outside) and the VAT report
@Component({
  host: { class: 'acc-center' },
  standalone: true,
  imports: [IntroComponent, FormsModule, DecimalPipe, DatePipe, TranslatePipe, ModalComponent],
  templateUrl: './einvoices-admin.component.html',
  styleUrl: './einvoices-admin.component.css',
})
export class EInvoicesAdminComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  private readonly base = `${environment.apiUrl}/api/admin/accounting`;

  readonly tabs = ['invoices', 'vat', 'profile'] as const;
  readonly statuses = STATUSES;
  readonly allStatuses = ['None', 'Draft', 'Ready', 'Submitted', 'Valid', 'Invalid', 'Cancelled'];
  readonly canWork = this.auth.can('accounting.documents');
  readonly canSettings = this.auth.can('accounting.settings');

  readonly tab = signal<'invoices' | 'vat' | 'profile'>('invoices');
  readonly rows = signal<EInvoiceRow[]>([]);
  readonly search = signal('');
  readonly status = signal('');
  readonly from = signal('');
  readonly to = signal('');
  readonly busy = signal<number | null>(null);
  readonly saving = signal(false);
  readonly detail = signal<EInvoiceDetail | null>(null);
  readonly profile = signal<TaxProfile | null>(null);
  readonly vat = signal<VatReport | null>(null);
  readonly vatFrom = signal('');
  readonly vatTo = signal('');

  readonly statusFor = signal<EInvoiceRow | null>(null);
  readonly newStatus = signal('Submitted');
  readonly submissionUuid = signal('');
  readonly longId = signal('');
  readonly errorText = signal('');

  private params(values: Record<string, string>): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(values)) if (v) p = p.set(k, v);
    return p;
  }

  ngOnInit(): void {
    this.loadInvoices();
  }

  setTab(t: 'invoices' | 'vat' | 'profile'): void {
    this.tab.set(t);
    if (t === 'invoices') this.loadInvoices();
    if (t === 'vat') this.loadVat();
    if (t === 'profile' && !this.profile()) this.http.get<TaxProfile>(`${this.base}/tax-profile`).subscribe((p) => this.profile.set(p));
  }

  loadInvoices(): void {
    // "None" is not a state the server stores: it is the documents without an e-invoice, filtered here
    const st = this.status();
    this.http.get<EInvoiceRow[]>(`${this.base}/e-invoices`, { params: this.params({ status: st === 'None' ? '' : st, from: this.from(), to: this.to(), search: this.search() }) })
      .subscribe((r) => this.rows.set(st === 'None' ? r.filter((x) => x.status === 'None') : r));
  }

  generate(r: EInvoiceRow): void {
    this.busy.set(r.documentId);
    this.http.post<EInvoiceDetail>(`${this.base}/e-invoices/${r.documentId}/generate`, {}).subscribe({
      next: (d) => {
        this.busy.set(null);
        this.toast.success(this.i18n.t('acc.ei.generated'));
        this.rows.update((list) => list.map((x) => (x.documentId === r.documentId ? d.row : x)));
        if (d.problems.length > 0) this.detail.set(d);
      },
      error: () => this.busy.set(null),
    });
  }

  openDetail(r: EInvoiceRow): void {
    this.http.get<EInvoiceDetail>(`${this.base}/e-invoices/${r.documentId}`).subscribe((d) => this.detail.set(d));
  }

  download(r: EInvoiceRow): void {
    this.http.get(`${this.base}/e-invoices/${r.documentId}/download`, { responseType: 'blob' }).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${r.documentNumber}.json`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  openStatus(r: EInvoiceRow): void {
    this.statusFor.set(r);
    this.newStatus.set(r.status === 'Submitted' ? 'Valid' : 'Submitted');
    this.submissionUuid.set(r.submissionUuid ?? '');
    this.longId.set(r.longId ?? '');
    this.errorText.set('');
  }

  saveStatus(): void {
    const r = this.statusFor();
    if (!r) return;
    this.saving.set(true);
    this.http.post<void>(`${this.base}/e-invoices/${r.documentId}/status`, {
      status: this.newStatus(), submissionUuid: this.submissionUuid() || null, longId: this.longId() || null, errorMessage: this.errorText() || null,
    }).subscribe({
      next: () => { this.saving.set(false); this.statusFor.set(null); this.toast.success(this.i18n.t('acc.ei.saved')); this.loadInvoices(); },
      error: () => this.saving.set(false),
    });
  }

  saveProfile(): void {
    const p = this.profile();
    if (!p) return;
    this.saving.set(true);
    this.http.put<void>(`${this.base}/tax-profile`, p).subscribe({
      next: () => { this.saving.set(false); this.toast.success(this.i18n.t('acc.ei.saved')); },
      error: () => this.saving.set(false),
    });
  }

  loadVat(): void {
    this.http.get<VatReport>(`${this.base}/reports/vat`, { params: this.params({ from: this.vatFrom(), to: this.vatTo() }) }).subscribe((v) => {
      this.vat.set(v);
      if (!this.vatFrom()) this.vatFrom.set(v.from.substring(0, 10));
      if (!this.vatTo()) this.vatTo.set(v.to.substring(0, 10));
    });
  }
}
