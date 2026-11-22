import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { Account, CategoryAccount, PostingRole } from '@shared/core/accounting.models';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';

import { IntroComponent } from '../intro.component';
// Basic accounts: which account of the chart plays "Sales", "Customers", "VAT payable" ... for the automatic entries,
// and the accounts of every product category (kitchen appliances have their own sales and stock accounts).
@Component({
  selector: 'app-basic-accounts-admin',
  standalone: true,
  imports: [IntroComponent, FormsModule, TranslatePipe],
  templateUrl: './basic-accounts-admin.component.html',
})
export class BasicAccountsAdminComponent implements OnInit {
  private readonly api = inject(AccountingApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  readonly canEdit = this.auth.can('accounting.settings');
  readonly roles = signal<PostingRole[]>([]);
  readonly accounts = signal<Account[]>([]);
  readonly cats = signal<CategoryAccount[]>([]);
  readonly saving = signal(false);

  readonly postable = computed(() => this.accounts().filter((a) => a.isPostable && a.isActive));
  readonly revenue = computed(() => this.postable().filter((a) => a.type === 'Revenue'));
  readonly stock = computed(() => this.postable().filter((a) => a.type === 'Asset' || a.type === 'Expense'));

  ngOnInit(): void {
    this.loadRoles();
    this.api.getAccounts().subscribe((a) => this.accounts.set(a));
    this.api.getCategoryAccounts().subscribe((c) => this.cats.set(c));
  }

  private loadRoles(): void {
    this.api.getPostingTemplates().subscribe((c) => this.roles.set(c.roles));
  }

  // The accounts that may play the role: its type, and the account that plays it now
  eligible(r: PostingRole): Account[] {
    return this.postable().filter((a) => r.types.includes(a.type) && (a.systemKey === null || a.systemKey === r.key));
  }

  setRole(r: PostingRole, accountId: number | null): void {
    if (!accountId || accountId === r.accountId) return;
    this.api.setBasicAccount(r.key, accountId).subscribe({
      next: () => {
        this.toast.success(this.i18n.t('inv.saved'));
        this.loadRoles();
        this.api.getAccounts().subscribe((a) => this.accounts.set(a));
      },
      error: () => this.loadRoles(),
    });
  }

  saveCategories(): void {
    this.saving.set(true);
    this.api.saveCategoryAccounts(this.cats().map((c) => ({ categoryId: c.categoryId, salesAccountId: c.salesAccountId, inventoryAccountId: c.inventoryAccountId }))).subscribe({
      next: () => { this.saving.set(false); this.toast.success(this.i18n.t('inv.saved')); },
      error: () => this.saving.set(false),
    });
  }
}
