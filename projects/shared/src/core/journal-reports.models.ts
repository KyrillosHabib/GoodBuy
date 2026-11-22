// ---------- journal reports and treasury movement
export interface JournalDetailLine { accountCode: string; accountName: string; partyName: string | null; description: string | null; debit: number; credit: number; }
export interface JournalDetailEntry { id: number; number: string; date: string; source: string; sourceNumber: string | null; description: string; total: number; isReversal: boolean; lines: JournalDetailLine[]; }
export interface JournalDetailReport { from: string; to: string; entries: JournalDetailEntry[]; count: number; totalDebit: number; totalCredit: number; truncated: boolean; }
export interface JournalSummaryRow { id: number; number: string; date: string; source: string; sourceNumber: string | null; description: string; total: number; isReversal: boolean; }
export interface JournalSummaryBySource { source: string; count: number; total: number; }
export interface JournalSummaryReport { from: string; to: string; rows: JournalSummaryRow[]; bySource: JournalSummaryBySource[]; count: number; total: number; truncated: boolean; }
export interface TreasuryMovementRow { date: string; entryNumber: string; cashAccountName: string; source: string; sourceNumber: string | null; description: string; partyName: string | null; in: number; out: number; balance: number; }
export interface TreasuryMovementReport { from: string; to: string; scope: string; opening: number; totalIn: number; totalOut: number; closing: number; rows: TreasuryMovementRow[]; truncated: boolean; }
