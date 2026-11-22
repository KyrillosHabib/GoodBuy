import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { ModalComponent } from '@shared/components/modal.component';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { Party, PartyKind, Statement } from '@shared/core/accounting.models';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { printArea } from '@shared/core/print';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { emptyToNull } from '@shared/core/translation-forms';

import { IntroComponent } from '../intro.component';
// Customers and suppliers of the books: payment terms, credit limit, balance, and the statement of account
@Component({
  selector: 'app-parties-admin',
  standalone: true,
  imports: [IntroComponent, ReactiveFormsModule, FormsModule, DecimalPipe, SlicePipe, TranslatePipe, DataTableComponent, ModalComponent],
  templateUrl: './parties-admin.component.html',
})
export class PartiesAdminComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AccountingApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  readonly canEdit = this.auth.can('accounting.parties');
  readonly kind = signal<PartyKind>('Customer');
  readonly parties = signal<Party[]>([]);
  readonly open = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<Party | null>(null);
  readonly statement = signal<Statement | null>(null);
  from = '';
  to = '';

  readonly columns: DtColumn[] = [
    { key: 'code', label: 'acc.code', value: (p: Party) => p.code, width: '100px' },
    { key: 'name', label: 'a.name', value: (p: Party) => p.name },
    { key: 'phone', label: 'contact.phone', value: (p: Party) => p.phone, filter: 'none' },
    { key: 'terms', label: 'acc.party.terms', value: (p: Party) => p.paymentTermsDays, type: 'number', filter: 'none', width: '90px' },
    { key: 'limit', label: 'acc.party.creditLimit', value: (p: Party) => p.creditLimit, type: 'number', filter: 'none', width: '120px' },
    { key: 'balance', label: 'acc.balance', value: (p: Party) => p.balance, type: 'number', filter: 'none', width: '160px' },
    { key: 'overdue', label: 'acc.party.overdue', value: (p: Party) => p.overdue, type: 'number', filter: 'none', width: '110px' },
    { key: 'active', label: 'a.active', value: (p: Party) => p.isActive, type: 'bool', width: '90px' },
    { key: 'actions', label: '', width: '250px' },
  ];

  readonly form = this.fb.group({
    name: [''], nameAr: ['', Validators.required], phone: [''], email: ['', Validators.email], address: [''], taxNumber: [''],
    paymentTermsDays: [0, [Validators.min(0), Validators.max(365)]], creditLimit: [0, Validators.min(0)], notes: [''], isActive: [true],
  });

  ngOnInit(): void {
    this.load();
  }

  abs(n: number): number {
    return Math.abs(n);
  }

  // Debit - credit: a customer's positive balance is what he owes us; a supplier's negative balance is what we owe him
  balanceLabel(p: { kind: PartyKind; balance: number }): string {
    if (p.balance === 0) return 'acc.settled';
    return p.balance > 0 ? 'acc.owesUs' : 'acc.weOwe';
  }

  setKind(k: PartyKind): void {
    this.kind.set(k);
    this.load();
  }

  load(): void {
    this.api.getParties(this.kind()).subscribe((p) => this.parties.set(p));
  }

  startEdit(p: Party | null): void {
    this.editing.set(p);
    this.form.reset({
      name: p && p.nameEn !== p.nameAr ? p.nameEn : '', nameAr: p?.nameAr ?? p?.nameEn ?? '', phone: p?.phone ?? '', email: p?.email ?? '',
      address: p?.address ?? '', taxNumber: p?.taxNumber ?? '', paymentTermsDays: p?.paymentTermsDays ?? 0, creditLimit: p?.creditLimit ?? 0,
      notes: p?.notes ?? '', isActive: p?.isActive ?? true,
    });
    this.open.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const e = this.editing();
    const body = {
      kind: e?.kind ?? this.kind(), name: emptyToNull(v.name), nameAr: emptyToNull(v.nameAr), phone: emptyToNull(v.phone), email: emptyToNull(v.email),
      address: emptyToNull(v.address), taxNumber: emptyToNull(v.taxNumber), paymentTermsDays: Number(v.paymentTermsDays) || 0,
      creditLimit: Number(v.creditLimit) || 0, isActive: !!v.isActive, notes: emptyToNull(v.notes),
    };

    this.saving.set(true);
    const request: Observable<unknown> = e ? this.api.updateParty(e.id, body) : this.api.createParty(body);

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

  remove(p: Party): void {
    if (!confirm(this.i18n.t('inv.confirmDelete'))) return;
    this.api.deleteParty(p.id).subscribe(() => this.load());
  }

  importSuppliers(): void {
    this.api.importSuppliers().subscribe((n) => {
      this.toast.success(this.i18n.t('acc.party.imported', { n }));
      this.load();
    });
  }

  openStatement(p: Party): void {
    this.from = '';
    this.to = '';
    this.reloadStatement(p);
  }

  reloadStatement(p: Party): void {
    this.api.getStatement(p.id, this.from || undefined, this.to || undefined).subscribe((s) => this.statement.set(s));
  }

  print(): void {
    printArea();
  }
}
