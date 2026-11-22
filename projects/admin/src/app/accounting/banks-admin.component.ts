import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '@shared/components/modal.component';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { Account, Bank, BankBranch, CashAccount, METHODS } from '@shared/core/accounting.models';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';

import { IntroComponent } from '../intro.component';
interface BankForm { id: number | null; name: string; nameAr: string; swiftCode: string; country: string; phone: string; isActive: boolean; }
interface BranchForm { id: number | null; bankId: number | null; name: string; nameAr: string; code: string; address: string; phone: string; isActive: boolean; }
interface AccountForm {
  id: number | null; name: string; nameAr: string; accountId: number | null; bankBranchId: number | null; bankAccountKind: string; accountHolder: string;
  accountNumber: string; iban: string; currencyCode: string; responsibleName: string; allowed: string[]; isActive: boolean;
}

const empty = (v: string): string | null => (v.trim() === '' ? null : v.trim());

// Banks in three tabs: the BANK, its BRANCHES, and my ACCOUNTS at them (number, owner, currency, the ledger account behind it)
@Component({
  selector: 'app-banks-admin',
  standalone: true,
  imports: [IntroComponent, FormsModule, DecimalPipe, TranslatePipe, ModalComponent],
  templateUrl: './banks-admin.component.html',
})
export class BanksAdminComponent implements OnInit {
  private readonly api = inject(AccountingApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  readonly canEdit = this.auth.can('accounting.settings');
  readonly methods = METHODS;
  readonly tab = signal<'banks' | 'branches' | 'accounts'>('banks');
  readonly banks = signal<Bank[]>([]);
  readonly cash = signal<CashAccount[]>([]);
  readonly accounts = signal<Account[]>([]);
  readonly saving = signal(false);
  readonly bankForm = signal<BankForm | null>(null);
  readonly branchForm = signal<BranchForm | null>(null);
  readonly accountForm = signal<AccountForm | null>(null);

  readonly bankAccounts = computed(() => this.cash().filter((c) => c.type === 'Bank'));
  readonly branchRows = computed(() => this.banks().flatMap((bank) => bank.branches.map((branch: BankBranch) => ({ bank, branch }))));

  ngOnInit(): void {
    this.reload();
    this.api.getAccounts().subscribe((a) => this.accounts.set(a));
  }

  reload(): void {
    this.api.getBanks().subscribe((b) => this.banks.set(b));
    this.api.getCashAccounts().subscribe((c) => this.cash.set(c));
  }

  // The ledger accounts a bank account can sit on: assets that take entries and no other box / bank uses
  ledgerChoices(f: AccountForm): Account[] {
    const used = new Set(this.cash().filter((c) => c.id !== f.id).map((c) => c.accountId));
    return this.accounts().filter((a) => a.type === 'Asset' && a.isPostable && a.isActive && !used.has(a.id));
  }

  // ----- banks
  startBank(b: Bank | null): void {
    this.bankForm.set({ id: b?.id ?? null, name: b?.nameEn ?? '', nameAr: b?.nameAr ?? '', swiftCode: b?.swiftCode ?? '', country: b?.country ?? '', phone: b?.phone ?? '', isActive: b?.isActive ?? true });
  }

  saveBank(f: BankForm): void {
    const body = { name: empty(f.name), nameAr: empty(f.nameAr), swiftCode: empty(f.swiftCode), country: empty(f.country), phone: empty(f.phone), isActive: f.isActive };
    this.run(f.id ? this.api.updateBank(f.id, body) : this.api.createBank(body), () => this.bankForm.set(null));
  }

  deleteBank(b: Bank): void {
    if (confirm(this.i18n.t('accs.confirmDelete'))) this.api.deleteBank(b.id).subscribe(() => this.reload());
  }

  // ----- branches
  startBranch(b: BankBranch | null): void {
    this.branchForm.set({ id: b?.id ?? null, bankId: b?.bankId ?? this.banks()[0]?.id ?? null, name: b?.nameEn ?? '', nameAr: b?.nameAr ?? '', code: b?.code ?? '', address: b?.address ?? '', phone: b?.phone ?? '', isActive: b?.isActive ?? true });
  }

  saveBranch(f: BranchForm): void {
    if (!f.bankId) return;
    const body = { bankId: f.bankId, name: empty(f.name), nameAr: empty(f.nameAr), code: empty(f.code), address: empty(f.address), phone: empty(f.phone), isActive: f.isActive };
    this.run(f.id ? this.api.updateBankBranch(f.id, body) : this.api.createBankBranch(body), () => this.branchForm.set(null));
  }

  deleteBranch(b: BankBranch): void {
    if (confirm(this.i18n.t('accs.confirmDelete'))) this.api.deleteBankBranch(b.id).subscribe(() => this.reload());
  }

  // ----- bank accounts (a cash account of type Bank)
  startAccount(c: CashAccount | null): void {
    this.accountForm.set({
      id: c?.id ?? null, name: c && c.nameEn !== c.nameAr ? c.nameEn : '', nameAr: c?.nameAr ?? c?.nameEn ?? '', accountId: c?.accountId ?? null,
      bankBranchId: c?.bankBranchId ?? null, bankAccountKind: c?.bankAccountKind ?? '', accountHolder: c?.accountHolder ?? '', accountNumber: c?.accountNumber ?? '',
      iban: c?.iban ?? '', currencyCode: c?.currencyCode ?? '', responsibleName: c?.responsibleName ?? '', allowed: [...(c?.allowedMethods ?? [])], isActive: c?.isActive ?? true,
    });
  }

  toggle(f: AccountForm, method: string, on: boolean): void {
    f.allowed = on ? [...f.allowed.filter((m) => m !== method), method] : f.allowed.filter((m) => m !== method);
  }

  saveAccount(f: AccountForm): void {
    if (!f.accountId || !f.nameAr.trim()) return;
    const body = {
      name: empty(f.name), nameAr: empty(f.nameAr), type: 'Bank' as const, accountId: f.accountId, bankName: null, accountNumber: empty(f.accountNumber), isActive: f.isActive,
      bankBranchId: f.bankBranchId, bankAccountKind: empty(f.bankAccountKind), accountHolder: empty(f.accountHolder), iban: empty(f.iban), currencyCode: empty(f.currencyCode),
      allowedMethods: f.allowed, responsibleName: empty(f.responsibleName),
    };
    this.run(f.id ? this.api.updateCashAccount(f.id, body) : this.api.createCashAccount(body), () => this.accountForm.set(null));
  }

  private run(request: { subscribe: (o: { next: () => void; error: () => void }) => unknown }, done: () => void): void {
    this.saving.set(true);
    request.subscribe({
      next: () => { this.saving.set(false); done(); this.toast.success(this.i18n.t('inv.saved')); this.reload(); },
      error: () => this.saving.set(false),
    });
  }
}
