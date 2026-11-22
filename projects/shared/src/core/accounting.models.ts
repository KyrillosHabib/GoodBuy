// Types of the accounting module (they mirror the DTOs of /api/admin/accounting)

export type AccountType = 'Asset' | 'Liability' | 'Equity' | 'Revenue' | 'Expense';
export type PartyKind = 'Customer' | 'Supplier';
export type DocumentType = 'SalesInvoice' | 'PurchaseInvoice' | 'SalesReturn' | 'PurchaseReturn' | 'CreditNote' | 'DebitNote';
export type ApprovalStatus = 'Draft' | 'PendingApproval' | 'Posted' | 'Rejected' | 'Cancelled';
export type VoucherType = 'Receipt' | 'Payment';
export type VoucherPurpose = 'Party' | 'Other';
export type VoucherMethod = 'Cash' | 'BankTransfer' | 'Cheque' | 'Card' | 'Wallet';
export type CashAccountType = 'Cash' | 'Bank' | 'Custody' | 'Gateway';
export type WorkflowKind = 'document' | 'voucher' | 'transfer' | 'journal' | 'settlement' | 'carrier-settlement' | 'gateway-settlement';
export type WorkflowAction = 'submit' | 'approve' | 'reject' | 'cancel';

export const DOCUMENT_TYPES: DocumentType[] = ['SalesInvoice', 'PurchaseInvoice', 'SalesReturn', 'PurchaseReturn', 'CreditNote', 'DebitNote'];
export const ACCOUNT_TYPES: AccountType[] = ['Asset', 'Liability', 'Equity', 'Revenue', 'Expense'];
export const STATUSES: ApprovalStatus[] = ['Draft', 'PendingApproval', 'Posted', 'Rejected', 'Cancelled'];
export const METHODS: VoucherMethod[] = ['Cash', 'BankTransfer', 'Cheque', 'Card', 'Wallet'];

// Sales documents are for customers, purchase documents for suppliers
export function partyKindOf(type: DocumentType): PartyKind {
  return type === 'SalesInvoice' || type === 'SalesReturn' || type === 'CreditNote' ? 'Customer' : 'Supplier';
}

// An invoice makes the party owe more; returns and notes make him owe less
export function isInvoice(type: DocumentType | string): boolean {
  return type === 'SalesInvoice' || type === 'PurchaseInvoice';
}

export interface Account {
  id: number; code: string; name: string; nameEn: string; nameAr: string | null; type: AccountType; parentId: number | null;
  isPostable: boolean; isActive: boolean; isSystem: boolean; systemKey: string | null; notes: string | null; balance: number;
  // The side the account grows on, and whether the owner set it (else it follows the type)
  nature: 'Debit' | 'Credit'; natureIsCustom: boolean; statement: 'BalanceSheet' | 'IncomeStatement';
}
export interface AccountInput {
  code: string; name: string | null; nameAr: string | null; type: AccountType; parentId: number | null; isPostable: boolean; isActive: boolean; notes: string | null;
  nature?: 'Debit' | 'Credit' | null;
}

export interface Party {
  id: number; code: string; kind: PartyKind; name: string; nameEn: string; nameAr: string | null; phone: string | null; email: string | null;
  address: string | null; taxNumber: string | null; paymentTermsDays: number; creditLimit: number; isActive: boolean; notes: string | null;
  supplierId: number | null; balance: number; overdue: number;
}
export interface PartyInput {
  kind: PartyKind; name: string | null; nameAr: string | null; phone: string | null; email: string | null; address: string | null; taxNumber: string | null;
  paymentTermsDays: number; creditLimit: number; isActive: boolean; notes: string | null;
}

export interface StatementLine {
  date: string; entryId: number; entryNumber: string; source: string; sourceId: number | null; sourceNumber: string | null; description: string;
  debit: number; credit: number; balance: number;
}
export interface OpenItem {
  kind: 'document' | 'voucher'; id: number; number: string; type: string; date: string; dueDate: string | null; total: number; outstanding: number; overdueDays: number;
}
export interface Statement {
  party: Party; from: string | null; to: string | null; opening: number; totalDebit: number; totalCredit: number; closing: number;
  lines: StatementLine[]; openItems: OpenItem[];
}

export interface DocumentLine {
  id: number; accountId: number; accountCode: string; accountName: string; description: string; quantity: number; unitPrice: number;
  taxRate: number; amount: number; taxAmount: number; categoryName?: string | null; costCenterId?: number | null; costCenterName?: string | null;
}
export interface DocAllocation {
  id: number; role: 'settledBy' | 'appliedTo'; otherKind: 'voucher' | 'document' | 'settlement'; otherId: number; otherNumber: string; amount: number;
  allocatedAtUtc: string; isAuto: boolean; isPlanned: boolean; isReversed: boolean; createdByName: string | null;
}

// What every item that has a maker and a checker carries
export interface Approvable {
  status: ApprovalStatus; createdByName: string | null; createdAtUtc: string; submittedByName: string | null; approvedByName: string | null;
  approvedAtUtc: string | null; rejectionReason: string | null; cancelledByName: string | null; cancelReason: string | null;
}

export interface AccDocument extends Approvable {
  id: number; number: string; type: DocumentType; partyId: number; partyName: string; partyKind: PartyKind; issueDate: string; dueDate: string | null;
  reference: string | null; notes: string | null; originalDocumentId: number | null; originalNumber: string | null; orderId: number | null;
  purchaseOrderId: number | null; subtotal: number; taxTotal: number; total: number; costAmount: number; outstanding: number; isClosed: boolean; settlementId: number | null;
  journalEntryId: number | null; journalEntryNumber: string | null; lines: DocumentLine[]; allocations: DocAllocation[];
}
export interface DocumentLineInput { accountId: number; description: string; quantity: number; unitPrice: number; taxRate: number; costCenterId?: number | null; }
export interface DocumentInput {
  type: DocumentType; partyId: number; issueDate: string; dueDate: string | null; reference: string | null; notes: string | null;
  originalDocumentId: number | null; orderId: number | null; purchaseOrderId: number | null; lines: DocumentLineInput[];
}

export interface JournalLine {
  id: number; accountId: number; accountCode: string; accountName: string; partyId: number | null; partyName: string | null; debit: number; credit: number; description: string | null; categoryName?: string | null; costCenterId?: number | null; costCenterName?: string | null;
}
export interface JournalEntry extends Approvable {
  id: number; number: string; entryDate: string; description: string; source: string; sourceId: number | null; sourceNumber: string | null;
  totalAmount: number; isReversed: boolean; reversesEntryId: number | null; lines: JournalLine[];
  // Sum of the debit lines and of the credit lines (they must be equal)
  totalDebit: number; totalCredit: number;
}
export interface JournalLineInput { accountId: number; partyId: number | null; debit: number; credit: number; description: string | null; costCenterId?: number | null; }
export interface JournalInput { entryDate: string; description: string; isOpening: boolean; lines: JournalLineInput[]; }

export interface CashAccount {
  id: number; name: string; nameEn: string; nameAr: string | null; type: CashAccountType; accountId: number; accountCode: string;
  bankName: string | null; accountNumber: string | null; isActive: boolean; balance: number;
  bankBranchId: number | null; bankId: number | null; bankBranchName: string | null; bankAccountKind: string | null; accountHolder: string | null;
  iban: string | null; currencyCode: string | null; allowedMethods: string[]; responsibleName: string | null;
}
export interface CashAccountInput {
  name: string | null; nameAr: string | null; type: CashAccountType; accountId: number; bankName: string | null; accountNumber: string | null; isActive: boolean;
  bankBranchId?: number | null; bankAccountKind?: string | null; accountHolder?: string | null; iban?: string | null; currencyCode?: string | null;
  allowedMethods?: string[]; responsibleName?: string | null;
}

export interface VoucherAllocation { id: number; documentId: number; documentNumber: string; documentType: string; amount: number; isPlanned: boolean; isReversed: boolean; allocatedAtUtc: string; }
export interface Voucher extends Approvable {
  id: number; number: string; type: VoucherType; purpose: VoucherPurpose; cashAccountId: number; cashAccountName: string; partyId: number | null;
  partyName: string | null; partyKind: PartyKind | null; counterAccountId: number | null; counterAccountName: string | null; orderId: number | null; amount: number; unallocated: number;
  voucherDate: string; method: VoucherMethod; reference: string | null; notes: string | null; journalEntryId: number | null; journalEntryNumber: string | null;
  allocations: VoucherAllocation[]; costCenterId?: number | null; costCenterName?: string | null;
}
export interface VoucherInput {
  type: VoucherType; purpose: VoucherPurpose; cashAccountId: number; partyId: number | null; counterAccountId: number | null; amount: number; voucherDate: string;
  method: VoucherMethod; reference: string | null; notes: string | null; allocations: { documentId: number; amount: number }[]; costCenterId?: number | null;
}

export interface Transfer extends Approvable {
  id: number; number: string; fromCashAccountId: number; fromName: string; toCashAccountId: number; toName: string; amount: number; transferDate: string;
  reference: string | null; notes: string | null; journalEntryId: number | null;
}
export interface TransferInput { fromCashAccountId: number; toCashAccountId: number; amount: number; transferDate: string; reference: string | null; notes: string | null; }

export interface AllocateInput { sourceKind: 'voucher' | 'document'; sourceId: number; lines: { documentId: number; amount: number }[]; }

export interface SettlementItem { documentId: number; number: string; type: DocumentType; issueDate: string; dueDate: string | null; total: number; outstandingAtVerification: number; currentOutstanding: number; }
export interface Settlement extends Approvable {
  id: number; number: string; partyId: number; partyName: string; partyKind: PartyKind; settlementDate: string; adjustmentAmount: number;
  adjustmentReason: string | null; notes: string | null; verifiedAtUtc: string | null; verifiedByName: string | null; verifiedScopeBalance: number;
  verifiedAccountBalance: number; journalEntryId: number | null; journalEntryNumber: string | null; items: SettlementItem[];
}
export interface SettlementInput { partyId: number; settlementDate: string; adjustmentAmount: number; adjustmentReason: string | null; notes: string | null; documentIds: number[]; }
export interface SettlementCheck { ok: boolean; scopeBalance: number; accountBalance: number; creditsOutstanding: number; adjustmentRequired: number; problems: string[]; items: SettlementItem[]; }

export interface AccountingSettings {
  lockedUntil: string | null; allowSelfApproval: boolean; enforceCreditLimit: boolean; defaultTaxRate: number; currency: string;
  // What the system books by itself: true = posted straight away, false = a draft waits for a person to approve it
  autoPostSales: boolean; autoPostCollections: boolean; autoPostPurchases: boolean; autoPostReturns: boolean; autoPostStockAdjustments: boolean; autoPostOnlineCollections: boolean;
}
export type SettingsInput = Omit<AccountingSettings, 'currency'>;
export interface AuditLog { id: number; entityType: string; entityId: number; number: string | null; action: string; details: string | null; userName: string | null; atUtc: string; }

export interface LedgerLine { date: string; entryId: number; entryNumber: string; source: string; sourceId: number | null; sourceNumber: string | null; accountCode: string; description: string; partyName: string | null; debit: number; credit: number; balance: number; }
export interface LedgerReport { accountId: number; code: string; name: string; type: AccountType; from: string | null; to: string | null; opening: number; totalDebit: number; totalCredit: number; closing: number; lines: LedgerLine[]; }
export interface TrialBalanceRow { accountId: number; code: string; name: string; type: AccountType; parentId: number | null; isPostable: boolean; opening: number; debit: number; credit: number; closing: number; }
export interface TrialBalance { from: string | null; to: string | null; rows: TrialBalanceRow[]; totalDebit: number; totalCredit: number; totalClosingDebit: number; totalClosingCredit: number; isBalanced: boolean; }
export interface StatementRow { accountId: number; code: string; name: string; amount: number; }
export interface IncomeStatement { from: string; to: string; revenue: StatementRow[]; totalRevenue: number; costOfSales: StatementRow[]; totalCostOfSales: number; grossProfit: number; expenses: StatementRow[]; totalExpenses: number; netProfit: number; }
export interface BalanceSheet { asOf: string; assets: StatementRow[]; totalAssets: number; liabilities: StatementRow[]; totalLiabilities: number; equity: StatementRow[]; totalEquity: number; currentEarnings: number; totalLiabilitiesAndEquity: number; difference: number; }
export interface AgingRow { partyId: number; code: string; name: string; current: number; days1To30: number; days31To60: number; days61To90: number; over90: number; total: number; unappliedCredits: number; }
export interface Aging { kind: PartyKind; asOf: string; rows: AgingRow[]; totals: AgingRow; }
export interface CashFlowCategory { key: string; detail: string | null; in: number; out: number; net: number; }
export interface CashFlowAccount { cashAccountId: number; name: string; opening: number; in: number; out: number; closing: number; }
export interface CashFlow { from: string; to: string; opening: number; totalIn: number; totalOut: number; closing: number; categories: CashFlowCategory[]; accounts: CashFlowAccount[]; }
export interface AccountingDashboard {
  cashBalance: number; dueFromCarriers: number; receivables: number; payables: number; overdueReceivables: number; overduePayables: number; monthRevenue: number; monthExpenses: number;
  monthProfit: number; pending: { documents: number; vouchers: number; journal: number; transfers: number; settlements: number; carrierSettlements: number; issues: number; gatewaySettlements?: number }; cashAccounts: CashAccount[];
}

export interface CarrierRate { zone: string | null; fixedFee: number; percentFee: number; }
export interface Carrier { id: number; name: string; nameEn: string; nameAr: string | null; isActive: boolean; notes: string | null; rates: CarrierRate[]; }
export interface CarrierInput { name: string | null; nameAr: string | null; isActive: boolean; notes: string | null; rates: CarrierRate[]; }
export interface CarrierCollection { voucherId: number; voucherNumber: string; date: string; orderId: number | null; orderNumber: string | null; city: string | null; partyName: string | null; amount: number; suggestedFee: number; }
export interface CarrierSettlementItem { voucherId: number; voucherNumber: string; orderId: number | null; orderNumber: string | null; amount: number; }
export interface CarrierSettlement extends Approvable {
  id: number; number: string; carrierId: number; carrierName: string; toCashAccountId: number; toCashAccountName: string; settlementDate: string;
  amountReceived: number; fees: number; difference: number; collected: number; reference: string | null; notes: string | null; journalEntryId: number | null; items: CarrierSettlementItem[];
}
export interface CarrierSettlementInput { carrierId: number; toCashAccountId: number; settlementDate: string; amountReceived: number; fees: number; difference?: number; reference: string | null; notes: string | null; voucherIds: number[]; }

export interface GatewayCollection {
  voucherId: number; voucherNumber: string; date: string; kind: 'Payment' | 'Refund'; gatewayCashAccountId: number; gatewayName: string;
  orderId: number | null; orderNumber: string | null; partyName: string | null; amount: number;
}
export interface GatewaySettlementItem { voucherId: number; voucherNumber: string; kind: 'Payment' | 'Refund'; orderId: number | null; orderNumber: string | null; amount: number; }
export interface GatewaySettlement extends Approvable {
  id: number; number: string; gatewayCashAccountId: number; gatewayName: string; toCashAccountId: number; toCashAccountName: string; settlementDate: string;
  amountReceived: number; fees: number; difference: number; collected: number; reference: string | null; notes: string | null; journalEntryId: number | null; items: GatewaySettlementItem[];
}
export interface GatewaySettlementInput {
  gatewayCashAccountId: number; toCashAccountId: number; settlementDate: string; amountReceived: number; fees: number; difference: number;
  reference: string | null; notes: string | null; voucherIds: number[];
}
export interface InventoryReconciliation {
  asOf: string; stockValue: number; ledgerBalance: number; difference: number; ledgerAccountCode: string; ledgerAccountName: string; openIssues: number;
  warehouses: { warehouseId: number; warehouseName: string; quantity: number; value: number }[];
}
export interface PaymentMap { method: string; cashAccountId: number | null; cashAccountName: string | null; }
export interface PostingIssue {
  id: number; eventKey: string; kind: 'error' | 'attention'; sourceType: string; sourceId: number; sourceNumber: string | null; message: string;
  createdAtUtc: string; resolvedAtUtc: string | null; resolvedByName: string | null;
}

export interface SalesCategoryRow { categoryId: number | null; name: string | null; sales: number; returns: number; net: number; }
export interface SalesByCategory { from: string; to: string; rows: SalesCategoryRow[]; totalSales: number; totalReturns: number; discounts: number; shipping: number; netRevenue: number; }


// ================================================================ automatic entries (debit details / credit details)
export type PostingSide = 'Debit' | 'Credit';
export type PostingAccountMode = 'Fixed' | 'Party' | 'DocumentLines' | 'Role' | 'Treasury' | 'Counter';

export interface PostingLine {
  id: number; side: PostingSide; sortOrder: number; accountMode: PostingAccountMode; accountId: number | null; accountLabel: string | null;
  roleKey: string | null; roleName: string | null; amountSource: string; usePercent: boolean; percent: number; linkParty: boolean; description: string | null;
}
export interface PostingTemplate {
  id: number; eventKey: string; name: string; nameEn: string; nameAr: string | null; group: string; partyKind: string | null;
  hasDocumentLines: boolean; hasTreasury: boolean; hasCounter: boolean; sources: string[]; isActive: boolean; isCustomized: boolean; notes: string | null;
  debit: PostingLine[]; credit: PostingLine[];
}
export interface PostingRole {
  key: string; name: string; nameEn: string; nameAr: string; types: string[]; lockedWhenUsed: boolean; accountId: number | null; accountLabel: string | null;
}
export interface PostingCatalog { templates: PostingTemplate[]; roles: PostingRole[]; }
export interface PostingLineInput {
  side: PostingSide; accountMode: PostingAccountMode; accountId: number | null; roleKey: string | null; amountSource: string | null; usePercent: boolean;
  percent: number; linkParty: boolean; description: string | null;
}
export interface PostingTemplateInput { isActive: boolean; notes: string | null; lines: PostingLineInput[]; }

export interface CategoryAccount {
  categoryId: number; categoryName: string; salesAccountId: number | null; salesAccountLabel: string | null;
  inventoryAccountId: number | null; inventoryAccountLabel: string | null;
}
export interface CategoryAccountInput { categoryId: number; salesAccountId: number | null; inventoryAccountId: number | null; }

// ================================================================ banks
export interface BankBranch {
  id: number; bankId: number; name: string; nameEn: string; nameAr: string | null; code: string | null; address: string | null; phone: string | null;
  isActive: boolean; accountsCount: number;
}
export interface Bank {
  id: number; name: string; nameEn: string; nameAr: string | null; swiftCode: string | null; country: string | null; phone: string | null; isActive: boolean;
  branches: BankBranch[];
}
export interface BankInput { name: string | null; nameAr: string | null; swiftCode: string | null; country: string | null; phone: string | null; isActive: boolean; }
export interface BankBranchInput { bankId: number; name: string | null; nameAr: string | null; code: string | null; address: string | null; phone: string | null; isActive: boolean; }

// ================================================================ fiscal years
export interface FiscalPeriod { id: number; name: string; startDate: string; endDate: string; isClosed: boolean; closedAtUtc: string | null; closedByName: string | null; }
export interface FiscalYear {
  id: number; name: string; startDate: string; endDate: string; isClosed: boolean; closedAtUtc: string | null; closedByName: string | null;
  closingEntryId: number | null; periods: FiscalPeriod[];
}
export interface FiscalOverview { years: FiscalYear[]; todayCovered: boolean; }

// ================================================================ opening balances
export interface OpeningAccountLine { accountId: number; debit: number; credit: number; }
export interface OpeningPartyLine { partyId: number; amount: number; reference: string | null; dueDate: string | null; }
export interface OpeningEntry { id: number; number: string; entryDate: string; description: string; status: string; amount: number; }
export interface OpeningResult { entries: number; documents: number; total: number; }

// ================================================================ exchange rates that come in by themselves
export interface CurrencyRateSettings {
  autoUpdate: boolean; intervalHours: number; marginPercent: number; providerUrl: string; lastRunUtc: string | null; lastStatus: string | null; lastMessage: string | null;
  baseCode: string;
}
export interface CurrencyRateRun { ok: boolean; updated: number; skipped: number; message: string; }

// A department / activity the money is analysed by (an optional tag on the lines of the books)
export interface CostCenter { id: number; code: string; name: string; nameEn?: string; nameAr: string | null; parentId: number | null; isActive: boolean; notes: string | null; }
