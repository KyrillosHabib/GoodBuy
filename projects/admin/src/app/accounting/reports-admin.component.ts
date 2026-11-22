import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import {
  Account, Aging, BalanceSheet, CashAccount, CashFlow, IncomeStatement, InventoryReconciliation, LedgerReport, Party, PartyKind,
  SalesByCategory, TrialBalance,
} from '@shared/core/accounting.models';
import { JournalReportsApiService } from '@shared/core/journal-reports-api.service';
import { JournalDetailReport, JournalSummaryReport, TreasuryMovementReport } from '@shared/core/journal-reports.models';
import { printArea } from '@shared/core/print';
import { TranslatePipe } from '@shared/core/pipes';
import './reports-journal.i18n';

import { IntroComponent } from '../intro.component';
type Tab = 'ledger' | 'trial' | 'income' | 'categories' | 'balance' | 'aging' | 'cash' | 'inventory' | 'jdetail' | 'jsummary' | 'treasury';

// The accounting reports. All of them read the posted entries of the journal only.
@Component({
  selector: 'app-reports-admin',
  standalone: true,
  imports: [IntroComponent, FormsModule, DecimalPipe, SlicePipe, TranslatePipe],
  templateUrl: './reports-admin.component.html',
})
export class ReportsAdminComponent implements OnInit {
  private readonly api = inject(AccountingApiService);
  private readonly jr = inject(JournalReportsApiService);
  private readonly route = inject(ActivatedRoute);

  readonly tabs: Tab[] = ['trial', 'ledger', 'jdetail', 'jsummary', 'treasury', 'income', 'categories', 'balance', 'aging', 'cash', 'inventory'];

  readonly sources = [
    'Manual', 'Opening', 'SalesInvoice', 'PurchaseInvoice', 'SalesReturn', 'PurchaseReturn', 'CreditNote', 'DebitNote', 'Receipt', 'Payment', 'Transfer', 'Settlement',
    'Reversal', 'CarrierSettlement', 'StockAdjustment', 'Closing', 'GatewaySettlement',
  ];
  readonly accountTypes = ['Revenue', 'Expense', 'Asset', 'Liability', 'Equity'];
  readonly tab = signal<Tab>('trial');

  readonly accounts = signal<Account[]>([]);
  readonly parties = signal<Party[]>([]);
  readonly cashAccounts = signal<CashAccount[]>([]);

  from = `${new Date().getFullYear()}-01-01`;
  to = new Date().toISOString().slice(0, 10);
  accountId: number | null = null;
  partyId: number | null = null;
  kind: PartyKind = 'Customer';
  source: string | null = null;
  accountType: string | null = null;
  cashAccountId: number | null = null;

  readonly ledger = signal<LedgerReport | null>(null);
  readonly trial = signal<TrialBalance | null>(null);
  readonly income = signal<IncomeStatement | null>(null);
  readonly balance = signal<BalanceSheet | null>(null);
  readonly aging = signal<Aging | null>(null);
  readonly cash = signal<CashFlow | null>(null);
  readonly categories = signal<SalesByCategory | null>(null);
  readonly inventory = signal<InventoryReconciliation | null>(null);
  readonly jdetail = signal<JournalDetailReport | null>(null);
  readonly jsummary = signal<JournalSummaryReport | null>(null);
  readonly treasury = signal<TreasuryMovementReport | null>(null);

  ngOnInit(): void {
    // The dashboard opens a report directly: /accounting/reports?tab=balance
    const wanted = this.route.snapshot.queryParamMap.get('tab') as Tab | null;
    if (wanted && this.tabs.includes(wanted)) this.tab.set(wanted);

    this.api.getAccounts().subscribe((a) => this.accounts.set(a));
    this.api.getParties().subscribe((p) => this.parties.set(p));
    this.api.getCashAccounts().subscribe((c) => this.cashAccounts.set(c.filter((x) => x.type === 'Cash' || x.type === 'Bank')));
    this.run();
  }

  setTab(t: Tab): void {
    this.tab.set(t);
    this.run();
  }

  print(): void {
    printArea();
  }

  run(): void {
    switch (this.tab()) {
      case 'ledger':
        if (this.accountId !== null) this.api.getLedger(this.accountId, this.from, this.to, this.partyId).subscribe((r) => this.ledger.set(r));
        break;
      case 'trial':
        this.api.getTrialBalance(this.from, this.to).subscribe((r) => this.trial.set(r));
        break;
      case 'income':
        this.api.getIncomeStatement(this.from, this.to).subscribe((r) => this.income.set(r));
        break;
      case 'categories':
        this.api.getSalesByCategory(this.from, this.to).subscribe((r) => this.categories.set(r));
        break;
      case 'balance':
        this.api.getBalanceSheet(this.to).subscribe((r) => this.balance.set(r));
        break;
      case 'aging':
        this.api.getAging(this.kind, this.to).subscribe((r) => this.aging.set(r));
        break;
      case 'inventory':
        this.api.getInventoryReconciliation().subscribe((r) => this.inventory.set(r));
        break;
      case 'jdetail':
        this.jr.getJournalDetail(this.from, this.to, this.source, this.accountType).subscribe((r) => this.jdetail.set(r));
        break;
      case 'jsummary':
        this.jr.getJournalSummary(this.from, this.to, this.source, this.accountType).subscribe((r) => this.jsummary.set(r));
        break;
      case 'treasury':
        this.jr.getTreasuryMovement(this.from, this.to, this.cashAccountId).subscribe((r) => this.treasury.set(r));
        break;
      case 'cash':
        this.api.getCashFlow(this.from, this.to).subscribe((r) => this.cash.set(r));
        break;
    }
  }
}
