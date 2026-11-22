import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../environments/environment';
import {
  AccDocument, Account, AccountInput, AccountingDashboard, AccountingSettings, Aging, AllocateInput, AuditLog, BalanceSheet, Carrier, CarrierCollection, CarrierInput,
  CostCenter, CarrierSettlement, CarrierSettlementInput, GatewayCollection, GatewaySettlement, GatewaySettlementInput, InventoryReconciliation, CashAccount, CashAccountInput, CashFlow, SalesByCategory, PaymentMap, PostingIssue, SettingsInput, DocumentInput, IncomeStatement, JournalEntry, JournalInput, LedgerReport, Party, PartyInput, Settlement, SettlementCheck, SettlementInput,
  Statement, Transfer, TransferInput, TrialBalance, Voucher, VoucherInput, WorkflowAction, WorkflowKind,
  Bank, BankBranchInput, BankInput, CategoryAccount, CategoryAccountInput, CurrencyRateRun, CurrencyRateSettings, FiscalOverview, OpeningAccountLine,
  OpeningEntry, OpeningPartyLine, OpeningResult, PostingCatalog, PostingTemplateInput,
} from './accounting.models';

// Everything the accounting screens of the dashboard ask the API
@Injectable({ providedIn: 'root' })
export class AccountingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/api/admin/accounting`;

  private params(values: Record<string, string | number | boolean | null | undefined>): HttpParams {
    let p = new HttpParams();
    for (const [k, v] of Object.entries(values)) if (v !== null && v !== undefined && v !== '' && v !== false) p = p.set(k, String(v));
    return p;
  }

  // ---------- overview, settings, audit
  // The small "waiting for approval" numbers (every accounting screen); the dashboard itself is for the head of the department
  getPending(): Observable<AccountingDashboard['pending']> { return this.http.get<AccountingDashboard['pending']>(`${this.base}/dashboard/pending`); }
  getDashboard(): Observable<AccountingDashboard> { return this.http.get<AccountingDashboard>(`${this.base}/dashboard`); }
  getSettings(): Observable<AccountingSettings> { return this.http.get<AccountingSettings>(`${this.base}/settings`); }
  saveSettings(b: SettingsInput): Observable<void> {
    return this.http.put<void>(`${this.base}/settings`, b);
  }
  getAudit(entityType?: string, entityId?: number, take = 200): Observable<AuditLog[]> {
    return this.http.get<AuditLog[]>(`${this.base}/audit`, { params: this.params({ entityType, entityId, take }) });
  }

  // ---------- chart of accounts
  getAccounts(): Observable<Account[]> { return this.http.get<Account[]>(`${this.base}/accounts`); }
  createAccount(b: AccountInput): Observable<number> { return this.http.post<number>(`${this.base}/accounts`, b); }
  updateAccount(id: number, b: AccountInput): Observable<void> { return this.http.put<void>(`${this.base}/accounts/${id}`, b); }
  deleteAccount(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/accounts/${id}`); }

  // ---------- customers and suppliers
  getParties(kind?: string): Observable<Party[]> { return this.http.get<Party[]>(`${this.base}/parties`, { params: this.params({ kind }) }); }
  createParty(b: PartyInput): Observable<number> { return this.http.post<number>(`${this.base}/parties`, b); }
  updateParty(id: number, b: PartyInput): Observable<void> { return this.http.put<void>(`${this.base}/parties/${id}`, b); }
  deleteParty(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/parties/${id}`); }
  importSuppliers(): Observable<number> { return this.http.post<number>(`${this.base}/parties/import-suppliers`, {}); }
  getStatement(id: number, from?: string, to?: string): Observable<Statement> {
    return this.http.get<Statement>(`${this.base}/parties/${id}/statement`, { params: this.params({ from, to }) });
  }

  // ---------- documents
  getDocuments(f: { type?: string; status?: string; partyId?: number | null; from?: string; to?: string; openOnly?: boolean } = {}): Observable<AccDocument[]> {
    return this.http.get<AccDocument[]>(`${this.base}/documents`, { params: this.params(f) });
  }
  getDocument(id: number): Observable<AccDocument> { return this.http.get<AccDocument>(`${this.base}/documents/${id}`); }
  createDocument(b: DocumentInput): Observable<number> { return this.http.post<number>(`${this.base}/documents`, b); }
  updateDocument(id: number, b: DocumentInput): Observable<void> { return this.http.put<void>(`${this.base}/documents/${id}`, b); }
  createDocumentFromSource(source: 'order' | 'purchase-order', sourceId: number): Observable<number> {
    return this.http.post<number>(`${this.base}/documents/from-source`, { source, sourceId });
  }

  // ---------- journal
  getJournal(f: { source?: string; status?: string; from?: string; to?: string; search?: string; accountId?: number | null; partyId?: number | null; sourceId?: number | null; createdBy?: string; onlyUnbalanced?: boolean } = {}): Observable<JournalEntry[]> {
    return this.http.get<JournalEntry[]>(`${this.base}/journal`, { params: this.params(f) });
  }
  getJournalEntry(id: number): Observable<JournalEntry> { return this.http.get<JournalEntry>(`${this.base}/journal/${id}`); }
  createJournal(b: JournalInput): Observable<number> { return this.http.post<number>(`${this.base}/journal`, b); }
  updateJournal(id: number, b: JournalInput): Observable<void> { return this.http.put<void>(`${this.base}/journal/${id}`, b); }

  // ---------- cash, vouchers, transfers, matching
  getCostCenters(): Observable<CostCenter[]> { return this.http.get<CostCenter[]>(`${this.base}/cost-centers`); }
  getCashAccounts(): Observable<CashAccount[]> { return this.http.get<CashAccount[]>(`${this.base}/cash-accounts`); }
  createCashAccount(b: CashAccountInput): Observable<number> { return this.http.post<number>(`${this.base}/cash-accounts`, b); }
  updateCashAccount(id: number, b: CashAccountInput): Observable<void> { return this.http.put<void>(`${this.base}/cash-accounts/${id}`, b); }
  getVouchers(f: { type?: string; status?: string; partyId?: number | null; cashAccountId?: number | null; from?: string; to?: string } = {}): Observable<Voucher[]> {
    return this.http.get<Voucher[]>(`${this.base}/vouchers`, { params: this.params(f) });
  }
  getVoucher(id: number): Observable<Voucher> { return this.http.get<Voucher>(`${this.base}/vouchers/${id}`); }
  createVoucher(b: VoucherInput): Observable<number> { return this.http.post<number>(`${this.base}/vouchers`, b); }
  updateVoucher(id: number, b: VoucherInput): Observable<void> { return this.http.put<void>(`${this.base}/vouchers/${id}`, b); }
  getTransfers(status?: string): Observable<Transfer[]> { return this.http.get<Transfer[]>(`${this.base}/transfers`, { params: this.params({ status }) }); }
  createTransfer(b: TransferInput): Observable<number> { return this.http.post<number>(`${this.base}/transfers`, b); }
  updateTransfer(id: number, b: TransferInput): Observable<void> { return this.http.put<void>(`${this.base}/transfers/${id}`, b); }
  allocate(b: AllocateInput): Observable<void> { return this.http.post<void>(`${this.base}/allocations`, b); }
  unallocate(id: number, reason: string): Observable<void> { return this.http.post<void>(`${this.base}/allocations/${id}/undo`, { reason }); }

  // ---------- final clearances
  getSettlements(f: { status?: string; partyId?: number | null } = {}): Observable<Settlement[]> {
    return this.http.get<Settlement[]>(`${this.base}/settlements`, { params: this.params(f) });
  }
  getSettlement(id: number): Observable<Settlement> { return this.http.get<Settlement>(`${this.base}/settlements/${id}`); }
  checkSettlement(b: SettlementInput): Observable<SettlementCheck> { return this.http.post<SettlementCheck>(`${this.base}/settlements/check`, b); }
  createSettlement(b: SettlementInput): Observable<number> { return this.http.post<number>(`${this.base}/settlements`, b); }
  updateSettlement(id: number, b: SettlementInput): Observable<void> { return this.http.put<void>(`${this.base}/settlements/${id}`, b); }
  verifySettlement(id: number): Observable<SettlementCheck> { return this.http.post<SettlementCheck>(`${this.base}/settlements/${id}/verify`, {}); }

  // ---------- shipping companies, cash on delivery, the way each payment is booked
  getCarriers(): Observable<Carrier[]> { return this.http.get<Carrier[]>(`${this.base}/carriers`); }
  createCarrier(b: CarrierInput): Observable<number> { return this.http.post<number>(`${this.base}/carriers`, b); }
  updateCarrier(id: number, b: CarrierInput): Observable<void> { return this.http.put<void>(`${this.base}/carriers/${id}`, b); }
  getCarrierCollections(carrierId?: number | null, exceptSettlementId?: number | null): Observable<CarrierCollection[]> {
    return this.http.get<CarrierCollection[]>(`${this.base}/carrier-collections`, { params: this.params({ carrierId, exceptSettlementId }) });
  }
  getCarrierSettlements(status?: string): Observable<CarrierSettlement[]> { return this.http.get<CarrierSettlement[]>(`${this.base}/carrier-settlements`, { params: this.params({ status }) }); }
  getCarrierSettlement(id: number): Observable<CarrierSettlement> { return this.http.get<CarrierSettlement>(`${this.base}/carrier-settlements/${id}`); }
  createCarrierSettlement(b: CarrierSettlementInput): Observable<number> { return this.http.post<number>(`${this.base}/carrier-settlements`, b); }
  updateCarrierSettlement(id: number, b: CarrierSettlementInput): Observable<void> { return this.http.put<void>(`${this.base}/carrier-settlements/${id}`, b); }
  getGatewayCollections(gatewayCashAccountId?: number | null, exceptSettlementId?: number | null): Observable<GatewayCollection[]> {
    return this.http.get<GatewayCollection[]>(`${this.base}/gateway-collections`, { params: this.params({ gatewayCashAccountId, exceptSettlementId }) });
  }
  getGatewaySettlements(status?: string): Observable<GatewaySettlement[]> { return this.http.get<GatewaySettlement[]>(`${this.base}/gateway-settlements`, { params: this.params({ status }) }); }
  getGatewaySettlement(id: number): Observable<GatewaySettlement> { return this.http.get<GatewaySettlement>(`${this.base}/gateway-settlements/${id}`); }
  createGatewaySettlement(b: GatewaySettlementInput): Observable<number> { return this.http.post<number>(`${this.base}/gateway-settlements`, b); }
  updateGatewaySettlement(id: number, b: GatewaySettlementInput): Observable<void> { return this.http.put<void>(`${this.base}/gateway-settlements/${id}`, b); }
  getPaymentMap(): Observable<PaymentMap[]> { return this.http.get<PaymentMap[]>(`${this.base}/payment-map`); }
  savePaymentMap(items: { method: string; cashAccountId: number }[]): Observable<void> { return this.http.put<void>(`${this.base}/payment-map`, { items }); }

  // ---------- the review inbox
  getIssues(includeResolved = false): Observable<PostingIssue[]> { return this.http.get<PostingIssue[]>(`${this.base}/issues`, { params: this.params({ includeResolved }) }); }
  retryIssue(id: number): Observable<boolean> { return this.http.post<boolean>(`${this.base}/issues/${id}/retry`, {}); }
  resolveIssue(id: number): Observable<boolean> { return this.http.post<boolean>(`${this.base}/issues/${id}/resolve`, {}); }

  // ---------- approval steps of every kind of item
  workflow(kind: WorkflowKind, id: number, action: WorkflowAction, reason?: string): Observable<void> {
    return this.http.post<void>(`${this.base}/${kind}/${id}/${action}`, { reason: reason ?? null });
  }

  // ---------- reports
  getLedger(accountId: number, from?: string, to?: string, partyId?: number | null): Observable<LedgerReport> {
    return this.http.get<LedgerReport>(`${this.base}/reports/ledger`, { params: this.params({ accountId, from, to, partyId }) });
  }
  getTrialBalance(from?: string, to?: string): Observable<TrialBalance> {
    return this.http.get<TrialBalance>(`${this.base}/reports/trial-balance`, { params: this.params({ from, to }) });
  }
  getIncomeStatement(from: string, to: string): Observable<IncomeStatement> {
    return this.http.get<IncomeStatement>(`${this.base}/reports/income-statement`, { params: this.params({ from, to }) });
  }
  getSalesByCategory(from: string, to: string): Observable<SalesByCategory> {
    return this.http.get<SalesByCategory>(`${this.base}/reports/sales-by-category`, { params: this.params({ from, to }) });
  }
  getBalanceSheet(asOf: string): Observable<BalanceSheet> { return this.http.get<BalanceSheet>(`${this.base}/reports/balance-sheet`, { params: this.params({ asOf }) }); }
  getAging(kind: string, asOf: string): Observable<Aging> { return this.http.get<Aging>(`${this.base}/reports/aging`, { params: this.params({ kind, asOf }) }); }
  getInventoryReconciliation(): Observable<InventoryReconciliation> { return this.http.get<InventoryReconciliation>(`${this.base}/reports/inventory-reconciliation`); }
  getCashFlow(from: string, to: string): Observable<CashFlow> { return this.http.get<CashFlow>(`${this.base}/reports/cash-flow`, { params: this.params({ from, to }) }); }

  // ---------- automatic entries, basic accounts, category accounts
  getPostingTemplates(): Observable<PostingCatalog> { return this.http.get<PostingCatalog>(`${this.base}/posting-templates`); }
  savePostingTemplate(eventKey: string, b: PostingTemplateInput): Observable<void> { return this.http.put<void>(`${this.base}/posting-templates/${eventKey}`, b); }
  resetPostingTemplate(eventKey: string): Observable<void> { return this.http.post<void>(`${this.base}/posting-templates/${eventKey}/reset`, {}); }
  setBasicAccount(roleKey: string, accountId: number): Observable<void> { return this.http.put<void>(`${this.base}/basic-accounts/${roleKey}`, { accountId }); }
  getCategoryAccounts(): Observable<CategoryAccount[]> { return this.http.get<CategoryAccount[]>(`${this.base}/category-accounts`); }
  saveCategoryAccounts(items: CategoryAccountInput[]): Observable<void> { return this.http.put<void>(`${this.base}/category-accounts`, items); }

  // ---------- banks
  getBanks(): Observable<Bank[]> { return this.http.get<Bank[]>(`${this.base}/banks`); }
  createBank(b: BankInput): Observable<number> { return this.http.post<number>(`${this.base}/banks`, b); }
  updateBank(id: number, b: BankInput): Observable<void> { return this.http.put<void>(`${this.base}/banks/${id}`, b); }
  deleteBank(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/banks/${id}`); }
  createBankBranch(b: BankBranchInput): Observable<number> { return this.http.post<number>(`${this.base}/bank-branches`, b); }
  updateBankBranch(id: number, b: BankBranchInput): Observable<void> { return this.http.put<void>(`${this.base}/bank-branches/${id}`, b); }
  deleteBankBranch(id: number): Observable<void> { return this.http.delete<void>(`${this.base}/bank-branches/${id}`); }

  // ---------- fiscal years and periods
  getFiscalYears(): Observable<FiscalOverview> { return this.http.get<FiscalOverview>(`${this.base}/fiscal-years`); }
  createFiscalYear(b: { name: string | null; startDate: string; split: 'Month' | 'Quarter' }): Observable<number> { return this.http.post<number>(`${this.base}/fiscal-years`, b); }
  closeFiscalYear(id: number): Observable<{ result: number }> { return this.http.post<{ result: number }>(`${this.base}/fiscal-years/${id}/close`, {}); }
  setFiscalPeriod(id: number, closed: boolean): Observable<void> { return this.http.put<void>(`${this.base}/fiscal-periods/${id}`, { closed }); }

  // ---------- opening balances
  getOpeningBalances(): Observable<OpeningEntry[]> { return this.http.get<OpeningEntry[]>(`${this.base}/opening-balances`); }
  postOpeningBalances(b: { date: string; accounts: OpeningAccountLine[]; customers: OpeningPartyLine[]; suppliers: OpeningPartyLine[] }): Observable<OpeningResult> {
    return this.http.post<OpeningResult>(`${this.base}/opening-balances`, b);
  }

  // ---------- exchange rates that come in by themselves
  getRateSettings(): Observable<CurrencyRateSettings> { return this.http.get<CurrencyRateSettings>(`${environment.apiUrl}/api/admin/currencies/auto-update`); }
  saveRateSettings(b: { autoUpdate: boolean; intervalHours: number; marginPercent: number; providerUrl: string | null }): Observable<void> {
    return this.http.put<void>(`${environment.apiUrl}/api/admin/currencies/auto-update`, b);
  }
  runRateUpdate(): Observable<CurrencyRateRun> { return this.http.post<CurrencyRateRun>(`${environment.apiUrl}/api/admin/currencies/auto-update/run`, {}); }
}
