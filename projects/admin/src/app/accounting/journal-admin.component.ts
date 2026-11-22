import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { Observable } from 'rxjs';
import { FormArray, FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { ModalComponent } from '@shared/components/modal.component';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { Account, CostCenter, JournalEntry, Party, STATUSES } from '@shared/core/accounting.models';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { printArea } from '@shared/core/print';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { AccAuditComponent } from './acc-audit.component';
import { AccEntryDetailsComponent } from './acc-entry-details.component';
import { AccWorkflowComponent } from './acc-workflow.component';

import { IntroComponent } from '../intro.component';
function lineGroup(fb: FormBuilder, v?: { accountId: number | null; partyId: number | null; debit: number; credit: number; description: string; costCenterId?: number | null }) {
  return fb.group({
    accountId: [v?.accountId ?? (null as number | null), Validators.required],
    partyId: [v?.partyId ?? (null as number | null)],
    debit: [v?.debit ?? 0, Validators.min(0)],
    credit: [v?.credit ?? 0, Validators.min(0)],
    description: [v?.description ?? ''],
    costCenterId: [v?.costCenterId ?? (null as number | null)],
  });
}
type LineGroup = ReturnType<typeof lineGroup>;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// The journal: every movement of the books. Entries made by documents, vouchers, transfers and clearances are read-only
// (they follow their source); manual entries need a person to prepare them and another to approve them.
@Component({
  selector: 'app-journal-admin',
  standalone: true,
  imports: [IntroComponent, ReactiveFormsModule, FormsModule, DecimalPipe, SlicePipe, TranslatePipe, DataTableComponent, ModalComponent, AccWorkflowComponent, AccAuditComponent, AccEntryDetailsComponent],
  templateUrl: './journal-admin.component.html',
})
export class JournalAdminComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AccountingApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  readonly canPrepare = this.auth.can('accounting.journal');
  readonly sources = ['Manual', 'Opening', 'SalesInvoice', 'PurchaseInvoice', 'SalesReturn', 'PurchaseReturn', 'CreditNote', 'DebitNote', 'Receipt', 'Payment', 'Transfer', 'Settlement', 'CarrierSettlement', 'StockAdjustment', 'Reversal'];
  readonly statuses = STATUSES;

  fSource = '';
  fStatus = '';
  fFrom = '';
  fTo = '';
  fCreatedBy = '';
  fUnbalanced = false;

  readonly rows = signal<JournalEntry[]>([]);
  readonly detail = signal<JournalEntry | null>(null);
  readonly refresh = signal(0);
  readonly editorOpen = signal(false);
  readonly editing = signal<JournalEntry | null>(null);
  readonly saving = signal(false);
  readonly accounts = signal<Account[]>([]);
  readonly parties = signal<Party[]>([]);
  readonly costCenters = signal<CostCenter[]>([]);

  readonly accountChoices = computed(() => this.accounts().filter((a) => a.isPostable && a.isActive));

  readonly lines = new FormArray<LineGroup>([]);
  readonly form = this.fb.group({
    entryDate: [new Date().toISOString().slice(0, 10), Validators.required],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    isOpening: [false],
    lines: this.lines,
  });

  readonly columns: DtColumn[] = [
    { key: 'number', label: 'acc.number', value: (e: JournalEntry) => e.number, width: '120px' },
    { key: 'date', label: 'acc.date', value: (e: JournalEntry) => e.entryDate.slice(0, 10), filter: 'none', width: '110px' },
    { key: 'description', label: 'acc.description', value: (e: JournalEntry) => e.description },
    { key: 'source', label: 'acc.source', value: (e: JournalEntry) => e.source, filter: 'select', optionLabel: (v: string) => this.i18n.t('acc.src.' + v) },
    { key: 'debit', label: 'acc.debit', value: (e: JournalEntry) => e.totalDebit, type: 'number', filter: 'none', width: '120px' },
    { key: 'credit', label: 'acc.credit', value: (e: JournalEntry) => e.totalCredit, type: 'number', filter: 'none', width: '120px' },
    { key: 'status', label: 'a.status', value: (e: JournalEntry) => e.status, filter: 'select', optionLabel: (v: string) => this.i18n.t('acc.st.' + v), width: '230px' },
    { key: 'actions', label: '', width: '90px' },
  ];

  ngOnInit(): void {
    this.load();
    this.api.getAccounts().subscribe((a) => this.accounts.set(a));
    this.api.getCostCenters().subscribe({ next: (c) => this.costCenters.set(c.filter((x) => x.isActive)), error: () => undefined });
    this.api.getParties().subscribe((p) => this.parties.set(p));
  }

  load(): void {
    this.api.getJournal({ source: this.fSource, status: this.fStatus, from: this.fFrom, to: this.fTo, createdBy: this.fCreatedBy.trim(), onlyUnbalanced: this.fUnbalanced }).subscribe((r) => this.rows.set(r));
  }

  // Debit and credit of an entry must be equal; the system refuses to save a different one, so this only shows up for bad imports or manual database changes
  isUnbalanced(e: JournalEntry): boolean {
    // No totals in the answer (an API that was not rebuilt yet): do not guess, do not paint it red
    if (e.totalDebit == null || e.totalCredit == null) return false;
    return round2(e.totalDebit) !== round2(e.totalCredit);
  }

  readonly rowClass = (e: JournalEntry): string => (this.isUnbalanced(e) ? 'row-unbalanced' : '');

  readonly unbalancedCount = computed(() => this.rows().filter((e) => this.isUnbalanced(e)).length);

  view(id: number): void {
    this.api.getJournalEntry(id).subscribe((e) => this.detail.set(e));
  }

  reload(id: number): void {
    this.refresh.update((n) => n + 1);
    this.view(id);
    this.load();
  }

  print(): void {
    printArea();
  }

  isManual(e: JournalEntry): boolean {
    return e.source === 'Manual' || e.source === 'Opening' || e.source === 'StockAdjustment';
  }

  // Receivable / payable lines must say whose money it is
  needsParty(line: LineGroup): boolean {
    const id = line.controls.accountId.value;
    const key = this.accounts().find((a) => a.id === id)?.systemKey;
    return key === 'ar' || key === 'ap';
  }

  startEdit(e: JournalEntry | null): void {
    this.detail.set(null);
    this.editing.set(e);
    this.form.reset({ entryDate: e?.entryDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10), description: e?.description ?? '', isOpening: e?.source === 'Opening' });
    this.lines.clear();
    if (e) for (const l of e.lines) this.lines.push(lineGroup(this.fb, { accountId: l.accountId, partyId: l.partyId, debit: l.debit, credit: l.credit, description: l.description ?? '', costCenterId: l.costCenterId ?? null }));
    else { this.addLine(); this.addLine(); }
    this.editorOpen.set(true);
  }

  addLine(): void {
    this.lines.push(lineGroup(this.fb));
  }

  removeLine(i: number): void {
    if (this.lines.length > 2) this.lines.removeAt(i);
  }

  totals(): { debit: number; credit: number } {
    let debit = 0;
    let credit = 0;
    for (const l of this.lines.controls) {
      const v = l.getRawValue();
      debit += Number(v.debit) || 0;
      credit += Number(v.credit) || 0;
    }
    return { debit: round2(debit), credit: round2(credit) };
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const t = this.totals();
    if (t.debit !== t.credit || t.debit <= 0) {
      this.toast.error(this.i18n.t('acc.jr.unbalanced'));
      return;
    }

    const v = this.form.getRawValue();
    const body = {
      entryDate: v.entryDate as string, description: (v.description ?? '').trim(), isOpening: !!v.isOpening,
      lines: v.lines
        .map((l) => ({ accountId: l.accountId as number, partyId: l.partyId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description?.trim() || null, costCenterId: l.costCenterId ?? null }))
        .filter((l) => l.debit > 0 || l.credit > 0),
    };
    const e = this.editing();

    this.saving.set(true);
    const request: Observable<number | void> = e ? this.api.updateJournal(e.id, body) : this.api.createJournal(body);

    request.subscribe({
      next: (id) => {
        this.saving.set(false);
        this.editorOpen.set(false);
        this.toast.success(this.i18n.t('inv.saved'));
        this.load();
        this.view(e ? e.id : (id as number));
      },
      error: () => this.saving.set(false),
    });
  }
}
