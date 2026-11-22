import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { Account, CashAccount, OpeningEntry, Party } from '@shared/core/accounting.models';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { AccEntryDetailsComponent } from './acc-entry-details.component';

import { IntroComponent } from '../intro.component';
interface AccountRow { accountId: number | null; debit: number; credit: number; }
interface PartyRow { partyId: number | null; amount: number; reference: string; dueDate: string; }

// Opening balances: what the business already has on the first day of the books.
// The accounts go in one entry (the difference goes to the opening-balance equity); every customer and supplier gets an opening invoice,
// so that his balance is aged, matched and paid like any other invoice. Never a receipt voucher.
@Component({
  selector: 'app-opening-admin',
  standalone: true,
  imports: [IntroComponent, FormsModule, DecimalPipe, SlicePipe, TranslatePipe, AccEntryDetailsComponent],
  templateUrl: './opening-admin.component.html',
})
export class OpeningAdminComponent implements OnInit {
  private readonly api = inject(AccountingApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  readonly canPost = this.auth.can('accounting.approve');
  readonly kinds = ['Customer', 'Supplier'] as const;
  date = '';
  readonly accountRows = signal<AccountRow[]>([]);
  private readonly customerRows = signal<PartyRow[]>([]);
  private readonly supplierRows = signal<PartyRow[]>([]);
  readonly accounts = signal<Account[]>([]);
  readonly parties = signal<Party[]>([]);
  readonly cash = signal<CashAccount[]>([]);
  readonly history = signal<OpeningEntry[]>([]);
  readonly shown = signal<number | null>(null);
  readonly busy = signal(false);

  // Customers, suppliers, the stock and the balancing account are not typed here
  readonly choices = computed(() =>
    this.accounts().filter((a) => a.isPostable && a.isActive && !['ar', 'ap', 'inventory', 'opening-equity'].includes(a.systemKey ?? '')),
  );

  readonly totals = computed(() => {
    let debit = 0;
    let credit = 0;
    for (const r of this.accountRows()) {
      debit += +r.debit || 0;
      credit += +r.credit || 0;
    }
    for (const r of this.customerRows()) debit += +r.amount || 0;
    for (const r of this.supplierRows()) credit += +r.amount || 0;
    return { debit, credit, equity: debit - credit };
  });

  ngOnInit(): void {
    this.api.getAccounts().subscribe((a) => this.accounts.set(a));
    this.api.getParties().subscribe((p) => this.parties.set(p));
    this.api.getCashAccounts().subscribe((c) => this.cash.set(c));
    this.loadHistory();
  }

  private loadHistory(): void {
    this.api.getOpeningBalances().subscribe((h) => this.history.set(h));
  }

  partiesOf(kind: 'Customer' | 'Supplier'): Party[] {
    return this.parties().filter((p) => p.kind === kind && p.isActive);
  }

  partyRows(kind: 'Customer' | 'Supplier'): PartyRow[] {
    return kind === 'Customer' ? this.customerRows() : this.supplierRows();
  }

  addAccount(): void {
    this.accountRows.update((l) => [...l, { accountId: null, debit: 0, credit: 0 }]);
  }

  // One row for every cash box and bank account that is not on the list yet
  addCash(): void {
    const have = new Set(this.accountRows().map((r) => r.accountId));
    const rows = this.cash().filter((c) => c.type !== 'Custody' && c.type !== 'Gateway' && !have.has(c.accountId)).map((c) => ({ accountId: c.accountId, debit: 0, credit: 0 }));
    this.accountRows.update((l) => [...l, ...rows]);
  }

  addParty(kind: 'Customer' | 'Supplier'): void {
    const row: PartyRow = { partyId: null, amount: 0, reference: '', dueDate: '' };
    (kind === 'Customer' ? this.customerRows : this.supplierRows).update((l) => [...l, row]);
  }

  remove<T>(list: T[], i: number): void {
    list.splice(i, 1);
    this.accountRows.update((l) => [...l]);
    this.customerRows.update((l) => [...l]);
    this.supplierRows.update((l) => [...l]);
  }

  hasRows(): boolean {
    return this.accountRows().some((r) => r.accountId && (r.debit > 0 || r.credit > 0))
      || this.customerRows().some((r) => r.partyId && r.amount > 0) || this.supplierRows().some((r) => r.partyId && r.amount > 0);
  }

  post(): void {
    if (!confirm(this.i18n.t('accs.open.confirm'))) return;

    const party = (rows: PartyRow[]) => rows.filter((r) => r.partyId && r.amount > 0)
      .map((r) => ({ partyId: r.partyId as number, amount: +r.amount, reference: r.reference.trim() || null, dueDate: r.dueDate || null }));

    this.busy.set(true);
    this.api.postOpeningBalances({
      date: this.date,
      accounts: this.accountRows().filter((r) => r.accountId && (r.debit > 0 || r.credit > 0)).map((r) => ({ accountId: r.accountId as number, debit: +r.debit || 0, credit: +r.credit || 0 })),
      customers: party(this.customerRows()),
      suppliers: party(this.supplierRows()),
    }).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.toast.success(this.i18n.t('accs.open.done', { entries: r.entries, documents: r.documents }));
        this.accountRows.set([]);
        this.customerRows.set([]);
        this.supplierRows.set([]);
        this.loadHistory();
        this.api.getAccounts().subscribe((a) => this.accounts.set(a));
      },
      error: () => this.busy.set(false),
    });
  }
}
