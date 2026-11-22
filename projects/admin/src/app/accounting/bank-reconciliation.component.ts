import { Component, OnInit, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { environment } from '@shared/environments/environment';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { Account, CashAccount } from '@shared/core/accounting.models';
import { I18nService } from '@shared/core/i18n.service';
import { ToastService } from '@shared/core/toast.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ModalComponent } from '@shared/components/modal.component';
import './bank.i18n';

import { IntroComponent } from '../intro.component';
interface StatementRow {
  id: number; cashAccountId: number; cashAccountName: string; fromDate: string; toDate: string; openingBalance: number; closingBalance: number;
  reference: string | null; status: string; lines: number; matchedLines: number; reconciledAtUtc: string | null;
}
interface BookItem { journalLineId: number; date: string; entryId: number; entryNumber: string; description: string; debit: number; credit: number; net: number; partyName: string | null; source: string }
interface BankLine { id: number; date: string; description: string | null; reference: string | null; amount: number; matchedAmount: number; state: 'matched' | 'partial' | 'unmatched'; matches: BookItem[] }
interface Summary { bookBalance: number; statementClosing: number; bookNotAtBank: number; bankNotInBooks: number; difference: number }
interface Detail { statement: StatementRow; summary: Summary; lines: BankLine[]; unmatchedBook: BookItem[]; cleared: BookItem[] }
interface CostCenterOption { id: number; code: string; name: string; isActive: boolean }
interface ParsedLine { date: string; description: string; reference: string | null; amount: number }

// Numbers like "1,234.50", "1.234,50", "(500)", "-500" or "500-"
function parseAmount(raw: string): number | null {
  let s = raw.trim().replace(/\s/g, '');
  if (!s) return 0;
  let neg = false;
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  if (s.endsWith('-')) { neg = true; s = s.slice(0, -1); }
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1); } else if (s.startsWith('+')) s = s.slice(1);
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
  if (!/^\d+(\.\d+)?$/.test(s)) return null;
  const n = Number(s);
  return neg ? -n : n;
}

function parseDate(raw: string): string | null {
  const s = raw.trim();
  let m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(s);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

// Reconciliation of the bank statements with the books
@Component({
  host: { class: 'acc-center' },
  standalone: true,
  imports: [IntroComponent, FormsModule, DecimalPipe, DatePipe, TranslatePipe, ModalComponent],
  templateUrl: './bank-reconciliation.component.html',
  styleUrl: './bank-reconciliation.component.css',
})
export class BankReconciliationComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly api = inject(AccountingApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly base = `${environment.apiUrl}/api/admin/accounting`;

  readonly banks = signal<CashAccount[]>([]);
  readonly accounts = signal<Account[]>([]);
  readonly costCenters = signal<CostCenterOption[]>([]);
  readonly rows = signal<StatementRow[]>([]);
  readonly accountFilter = signal(0);
  readonly detail = signal<Detail | null>(null);
  readonly creating = signal(false);
  readonly saving = signal(false);
  readonly pasted = signal('');
  readonly clearSel = signal<Set<number>>(new Set());
  readonly matchFor = signal<BankLine | null>(null);
  readonly matchSel = signal<Set<number>>(new Set());
  readonly voucherFor = signal<BankLine | null>(null);
  counterId = 0;
  costCenterId = 0;

  form = { cashAccountId: 0, fromDate: '', toDate: '', openingBalance: 0, closingBalance: 0, reference: '' };

  ngOnInit(): void {
    this.api.getCashAccounts().subscribe((list) => this.banks.set(list.filter((c) => c.type === 'Bank' && c.isActive)));
    this.api.getAccounts().subscribe((list) => this.accounts.set(list.filter((a) => a.isPostable && a.isActive)));
    this.http.get<CostCenterOption[]>(`${this.base}/cost-centers`).subscribe({ next: (c) => this.costCenters.set(c.filter((x) => x.isActive)), error: () => undefined });
    this.loadList();
  }

  parsed(): { lines: ParsedLine[]; bad: number } {
    const lines: ParsedLine[] = [];
    let bad = 0;

    for (const raw of this.pasted().split(/\r?\n/)) {
      if (!raw.trim()) continue;
      const delimiter = raw.includes('\t') ? '\t' : raw.includes(';') ? ';' : ',';
      const parts = raw.split(delimiter).map((p) => p.trim());
      const date = parseDate(parts[0] ?? '');

      if (!date || parts.length < 3) { if (lines.length > 0 || date) bad++; continue; }

      const numbers = parts.slice(2);
      let amount: number | null;
      let description = parts[1];

      if (numbers.length >= 2) {
        const a = parseAmount(numbers[0]);
        const b = parseAmount(numbers[1]);
        amount = a === null || b === null ? null : Math.abs(b) - Math.abs(a);
      } else {
        amount = parseAmount(numbers[0]);
      }

      if (amount === null || amount === 0) { bad++; continue; }
      lines.push({ date, description, reference: null, amount });
    }

    return { lines, bad };
  }

  loadList(): void {
    let params = new HttpParams();
    if (this.accountFilter() > 0) params = params.set('cashAccountId', this.accountFilter());
    this.http.get<StatementRow[]>(`${this.base}/bank/statements`, { params }).subscribe((r) => this.rows.set(r));
  }

  startNew(): void {
    const today = new Date().toISOString().substring(0, 10);
    this.form = { cashAccountId: this.accountFilter(), fromDate: today.substring(0, 8) + '01', toDate: today, openingBalance: 0, closingBalance: 0, reference: '' };
    this.pasted.set('');
    this.creating.set(true);
  }

  saveStatement(): void {
    const p = this.parsed();

    if (!this.form.cashAccountId) { this.toast.error(this.i18n.t('acc.bank.chooseAccount')); return; }
    if (p.lines.length === 0) { this.toast.error(this.i18n.t('acc.bank.noLines')); return; }

    this.saving.set(true);
    this.http.post<{ id: number }>(`${this.base}/bank/statements`, {
      cashAccountId: this.form.cashAccountId, fromDate: this.form.fromDate, toDate: this.form.toDate,
      openingBalance: Number(this.form.openingBalance) || 0, closingBalance: Number(this.form.closingBalance) || 0,
      reference: this.form.reference.trim() || null, notes: null, lines: p.lines,
    }).subscribe({
      next: (r) => { this.saving.set(false); this.creating.set(false); this.toast.success(this.i18n.t('acc.bank.saved')); this.loadList(); this.open(r.id); },
      error: () => this.saving.set(false),
    });
  }

  open(id: number): void {
    this.http.get<Detail>(`${this.base}/bank/statements/${id}`).subscribe((d) => { this.detail.set(d); this.clearSel.set(new Set()); });
  }

  close(): void {
    this.detail.set(null);
    this.loadList();
  }

  remove(r: StatementRow): void {
    if (!confirm(this.i18n.t('acc.bank.deleteConfirm'))) return;
    this.http.delete<void>(`${this.base}/bank/statements/${r.id}`).subscribe(() => this.loadList());
  }

  private run(call: import('rxjs').Observable<unknown>, done: string | null, id: number): void {
    this.saving.set(true);
    call.subscribe({
      next: () => { this.saving.set(false); if (done) this.toast.success(this.i18n.t(done)); this.open(id); },
      error: () => this.saving.set(false),
    });
  }

  autoMatch(d: Detail): void {
    this.saving.set(true);
    this.http.post<{ matched: number }>(`${this.base}/bank/statements/${d.statement.id}/auto-match`, {}).subscribe({
      next: (r) => { this.saving.set(false); this.toast.success(`${r.matched} ${this.i18n.t('acc.bank.autoDone')}`); this.open(d.statement.id); },
      error: () => this.saving.set(false),
    });
  }

  finish(d: Detail): void {
    this.run(this.http.post<void>(`${this.base}/bank/statements/${d.statement.id}/finish`, {}), 'acc.bank.finished', d.statement.id);
  }

  unmatch(l: BankLine): void {
    this.run(this.http.post<void>(`${this.base}/bank/lines/${l.id}/unmatch`, {}), null, this.detail()!.statement.id);
  }

  toggleClear(id: number): void {
    const s = new Set(this.clearSel());
    if (!s.delete(id)) s.add(id);
    this.clearSel.set(s);
  }

  clearSelected(d: Detail): void {
    if (!confirm(this.i18n.t('acc.bank.clearConfirm'))) return;
    this.run(this.http.post<void>(`${this.base}/bank/statements/${d.statement.id}/clear`, { journalLineIds: [...this.clearSel()] }), null, d.statement.id);
  }

  unclear(journalLineId: number): void {
    this.run(this.http.post<void>(`${this.base}/bank/journal-lines/${journalLineId}/unclear`, {}), null, this.detail()!.statement.id);
  }

  startMatch(l: BankLine): void {
    this.matchSel.set(new Set());
    this.matchFor.set(l);
  }

  toggleMatch(id: number): void {
    const s = new Set(this.matchSel());
    if (!s.delete(id)) s.add(id);
    this.matchSel.set(s);
  }

  matchTotal(): number {
    const sel = this.matchSel();
    return Math.round((this.detail()?.unmatchedBook ?? []).filter((b) => sel.has(b.journalLineId)).reduce((sum, b) => sum + b.net, 0) * 100) / 100;
  }

  doMatch(l: BankLine): void {
    const id = this.detail()!.statement.id;
    this.matchFor.set(null);
    this.run(this.http.post<void>(`${this.base}/bank/lines/${l.id}/match`, { journalLineIds: [...this.matchSel()] }), 'acc.bank.matchDone', id);
  }

  startVoucher(l: BankLine): void {
    this.counterId = 0;
    this.costCenterId = 0;
    this.voucherFor.set(l);
  }

  doVoucher(l: BankLine): void {
    const id = this.detail()!.statement.id;
    this.voucherFor.set(null);
    this.run(this.http.post<unknown>(`${this.base}/bank/lines/${l.id}/voucher`, { counterAccountId: this.counterId, costCenterId: this.costCenterId || null }), 'acc.bank.voucherDone', id);
  }
}
