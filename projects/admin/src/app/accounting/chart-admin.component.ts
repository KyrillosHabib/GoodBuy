import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { ModalComponent } from '@shared/components/modal.component';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { ACCOUNT_TYPES, Account, AccountType } from '@shared/core/accounting.models';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { emptyToNull } from '@shared/core/translation-forms';

import { IntroComponent } from '../intro.component';
// The chart of accounts: headings (that only group) and accounts (that take entries), with a code, a type and a parent
@Component({
  selector: 'app-chart-admin',
  standalone: true,
  imports: [IntroComponent, ReactiveFormsModule, DecimalPipe, TranslatePipe, DataTableComponent, ModalComponent],
  templateUrl: './chart-admin.component.html',
})
export class ChartAdminComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AccountingApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  readonly canEdit = this.auth.can('accounting.chart');
  readonly types = ACCOUNT_TYPES;
  readonly accounts = signal<Account[]>([]);
  readonly open = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<Account | null>(null);
  private readonly selectedType = signal<AccountType>('Asset');
  private readonly selfId = signal<number | null>(null);

  readonly columns: DtColumn[] = [
    { key: 'code', label: 'acc.code', value: (a: Account) => a.code, width: '110px' },
    { key: 'name', label: 'a.name', value: (a: Account) => a.name },
    { key: 'type', label: 'acc.type', value: (a: Account) => a.type, filter: 'select', optionLabel: (v: string) => this.i18n.t('acc.type.' + v), width: '130px' },
    { key: 'statement', label: 'accs.chart.statement', value: (a: Account) => a.statement, filter: 'select', optionLabel: (v: string) => this.i18n.t('accs.chart.statement.' + v), width: '150px' },
    { key: 'nature', label: 'accs.chart.nature', value: (a: Account) => a.nature, filter: 'select', optionLabel: (v: string) => this.i18n.t('accs.chart.nature.' + v), width: '110px' },
    { key: 'kind', label: 'acc.chart.kind', value: (a: Account) => (a.isPostable ? 'account' : 'heading'), filter: 'select', optionLabel: (v: string) => this.i18n.t('acc.chart.' + v), width: '130px' },
    { key: 'balance', label: 'acc.balance', value: (a: Account) => a.balance, type: 'number', filter: 'none', width: '130px' },
    { key: 'active', label: 'a.active', value: (a: Account) => a.isActive, type: 'bool', width: '100px' },
    { key: 'actions', label: '', width: '170px' },
  ];

  // Headings of the same type that are not the account itself
  readonly parents = computed(() => this.accounts().filter((a) => !a.isPostable && a.type === this.selectedType() && a.id !== this.selfId()));

  readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(20)]],
    type: ['Asset' as AccountType],
    name: [''],
    nameAr: ['', Validators.required],
    parentId: [null as number | null],
    notes: [''],
    isPostable: [true],
    isActive: [true],
    // '' = follows the type; 'Debit' / 'Credit' = the side this account grows on
    nature: [''],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getAccounts().subscribe((a) => this.accounts.set(a));
  }

  depth(a: Account): number {
    const byId = new Map(this.accounts().map((x) => [x.id, x]));
    let d = 0;
    for (let p = a.parentId; p !== null && d < 10; d++) p = byId.get(p)?.parentId ?? null;
    return d;
  }

  typeChanged(): void {
    this.selectedType.set(this.form.getRawValue().type ?? 'Asset');
    this.form.patchValue({ parentId: null });
  }

  startEdit(a: Account | null): void {
    this.editing.set(a);
    this.selfId.set(a?.id ?? null);
    this.selectedType.set(a?.type ?? 'Asset');
    this.form.reset({
      code: a?.code ?? '', type: a?.type ?? 'Asset', name: a && a.nameEn !== a.nameAr ? a.nameEn : '', nameAr: a?.nameAr ?? a?.nameEn ?? '',
      parentId: a?.parentId ?? null, notes: a?.notes ?? '', isPostable: a?.isPostable ?? true, isActive: a?.isActive ?? true, nature: a?.natureIsCustom ? a.nature : '',
    });
    // A system account keeps its type
    if (a?.isSystem) this.form.controls.type.disable(); else this.form.controls.type.enable();
    this.open.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const body = {
      code: (v.code ?? '').trim(), name: emptyToNull(v.name), nameAr: emptyToNull(v.nameAr), type: v.type as AccountType, parentId: v.parentId,
      isPostable: !!v.isPostable, isActive: !!v.isActive, notes: emptyToNull(v.notes),
      nature: (v.nature === 'Debit' || v.nature === 'Credit' ? v.nature : null) as 'Debit' | 'Credit' | null,
    };
    const e = this.editing();

    this.saving.set(true);
    const request: Observable<unknown> = e ? this.api.updateAccount(e.id, body) : this.api.createAccount(body);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.open.set(false);
        this.toast.success(this.i18n.t('inv.saved'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  remove(a: Account): void {
    if (!confirm(this.i18n.t('inv.confirmDelete'))) return;
    this.api.deleteAccount(a.id).subscribe(() => this.load());
  }
}
