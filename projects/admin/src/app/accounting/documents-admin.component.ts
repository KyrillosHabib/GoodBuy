import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { Observable } from 'rxjs';
import { FormArray, FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { ModalComponent } from '@shared/components/modal.component';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { AccountingContext } from '@shared/core/accounting-context.service';
import {
  AccDocument, Account, CashAccount, CostCenter, DOCUMENT_TYPES, DocumentType, Party, STATUSES, isInvoice, partyKindOf,
} from '@shared/core/accounting.models';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { printArea } from '@shared/core/print';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { emptyToNull } from '@shared/core/translation-forms';
import { AccAllocTableComponent } from './acc-alloc-table.component';
import { AccEntryDetailsComponent } from './acc-entry-details.component';
import { AccAuditComponent } from './acc-audit.component';
import { AccWorkflowComponent } from './acc-workflow.component';

import { IntroComponent } from '../intro.component';
function lineGroup(fb: FormBuilder, v?: { accountId: number | null; description: string; quantity: number; unitPrice: number; taxRate: number; costCenterId?: number | null }) {
  return fb.group({
    accountId: [v?.accountId ?? (null as number | null), Validators.required],
    description: [v?.description ?? '', [Validators.required, Validators.maxLength(300)]],
    quantity: [v?.quantity ?? 1, [Validators.required, Validators.min(0.001)]],
    unitPrice: [v?.unitPrice ?? 0, Validators.required],
    taxRate: [v?.taxRate ?? 0, [Validators.min(0), Validators.max(100)]],
    costCenterId: [v?.costCenterId ?? (null as number | null)],
  });
}
type LineGroup = ReturnType<typeof lineGroup>;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

// Invoices, returns and credit / debit notes: prepared as a draft, sent for approval, approved (and posted) by another person.
// An approved document is never edited or deleted: it is reversed.
@Component({
  selector: 'app-documents-admin',
  standalone: true,
  imports: [IntroComponent, 
    ReactiveFormsModule, FormsModule, DecimalPipe, SlicePipe, TranslatePipe, DataTableComponent, ModalComponent,
    AccWorkflowComponent, AccAuditComponent, AccAllocTableComponent, AccEntryDetailsComponent,
  ],
  templateUrl: './documents-admin.component.html',
})
export class DocumentsAdminComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AccountingApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  readonly auth = inject(AuthService);
  readonly ctx = inject(AccountingContext);

  readonly canPrepare = this.auth.can('accounting.documents');
  // This screen shows the documents of one side: what we sell, or what we buy
  readonly scope: 'sales' | 'purchases' = this.route.snapshot.data['scope'] === 'purchases' ? 'purchases' : 'sales';
  readonly types = DOCUMENT_TYPES.filter((t) => (partyKindOf(t) === 'Customer') === (this.route.snapshot.data['scope'] !== 'purchases'));
  readonly statuses = STATUSES;
  readonly partyKindOf = partyKindOf;

  fType = '';
  fStatus = '';
  fFrom = '';
  fTo = '';

  readonly rows = signal<AccDocument[]>([]);
  readonly detail = signal<AccDocument | null>(null);
  readonly refresh = signal(0);
  readonly picking = signal(false);
  readonly editorOpen = signal(false);
  readonly editing = signal<AccDocument | null>(null);
  readonly editorType = signal<DocumentType>('SalesInvoice');
  readonly saving = signal(false);
  readonly parties = signal<Party[]>([]);
  readonly accounts = signal<Account[]>([]);
  readonly costCenters = signal<CostCenter[]>([]);
  readonly cashAccountIds = signal<number[]>([]);
  readonly originals = signal<AccDocument[]>([]);

  readonly applying = signal<AccDocument | null>(null);
  readonly applyDocs = signal<AccDocument[]>([]);
  applyLines: { documentId: number; amount: number }[] = [];

  readonly lines = new FormArray<LineGroup>([]);
  readonly form = this.fb.group({
    partyId: [null as number | null, Validators.required],
    issueDate: [new Date().toISOString().slice(0, 10), Validators.required],
    dueDate: [''],
    reference: [''],
    notes: [''],
    originalDocumentId: [null as number | null],
    orderId: [null as number | null],
    purchaseOrderId: [null as number | null],
    lines: this.lines,
  });

  readonly editorKind = computed(() => partyKindOf(this.editorType()));
  readonly invoice = computed(() => isInvoice(this.editorType()));
  readonly partyChoices = computed(() => this.parties().filter((p) => p.kind === this.editorKind() && (p.isActive || p.id === this.editing()?.partyId)));

  // A sale goes to a revenue account; a purchase to an expense or a stock account. The system accounts (receivable, payable, tax, cash) are never typed by hand.
  readonly accountChoices = computed(() => {
    const sales = this.editorKind() === 'Customer';
    const cash = new Set(this.cashAccountIds());
    const system = new Set(['ar', 'ap', 'vat-input', 'vat-output']);

    return this.accounts().filter(
      (a) => a.isPostable && a.isActive && !cash.has(a.id) && !(a.systemKey && system.has(a.systemKey)) &&
        (sales ? a.type === 'Revenue' : a.type === 'Expense' || a.type === 'Asset'),
    );
  });

  readonly columns: DtColumn[] = [
    { key: 'number', label: 'acc.number', value: (d: AccDocument) => d.number, width: '130px' },
    { key: 'type', label: 'acc.type', value: (d: AccDocument) => d.type, filter: 'select', optionLabel: (v: string) => this.i18n.t('acc.doc.' + v) },
    { key: 'party', label: 'acc.party', value: (d: AccDocument) => d.partyName },
    { key: 'date', label: 'acc.date', value: (d: AccDocument) => d.issueDate.slice(0, 10), filter: 'none', width: '110px' },
    { key: 'due', label: 'acc.due', value: (d: AccDocument) => d.dueDate?.slice(0, 10), filter: 'none', width: '110px' },
    { key: 'total', label: 'acc.total', value: (d: AccDocument) => d.total, type: 'number', filter: 'none', width: '120px' },
    { key: 'out', label: 'acc.outstanding', value: (d: AccDocument) => d.outstanding, type: 'number', filter: 'none', width: '120px' },
    { key: 'status', label: 'a.status', value: (d: AccDocument) => d.status, filter: 'select', optionLabel: (v: string) => this.i18n.t('acc.st.' + v), width: '150px' },
    { key: 'actions', label: '', width: '90px' },
  ];

  ngOnInit(): void {
    this.ctx.load();
    this.load();
    this.api.getParties().subscribe((p) => this.parties.set(p));
    this.api.getAccounts().subscribe((a) => this.accounts.set(a));
    this.api.getCostCenters().subscribe({ next: (c) => this.costCenters.set(c.filter((x) => x.isActive)), error: () => undefined });
    this.api.getCashAccounts().subscribe((c: CashAccount[]) => this.cashAccountIds.set(c.map((x) => x.accountId)));
  }

  load(): void {
    this.api.getDocuments({ type: this.fType, status: this.fStatus, from: this.fFrom, to: this.fTo }).subscribe((r) => this.rows.set(r.filter((d) => this.types.includes(d.type))));
  }

  view(id: number): void {
    this.api.getDocument(id).subscribe((d) => this.detail.set(d));
  }

  reload(id: number): void {
    this.refresh.update((n) => n + 1);
    this.api.getDocument(id).subscribe((d) => this.detail.set(d));
    this.load();
  }

  print(): void {
    printArea();
  }

  // ---------- editor

  startNew(type: DocumentType): void {
    this.picking.set(false);
    this.editing.set(null);
    this.editorType.set(type);
    this.originals.set([]);
    this.form.reset({ partyId: null, issueDate: new Date().toISOString().slice(0, 10), dueDate: '', reference: '', notes: '', originalDocumentId: null, orderId: null, purchaseOrderId: null });
    this.lines.clear();
    this.addLine();
    this.editorOpen.set(true);
  }

  startEdit(d: AccDocument): void {
    this.detail.set(null);
    this.editing.set(d);
    this.editorType.set(d.type);
    this.form.reset({
      partyId: d.partyId, issueDate: d.issueDate.slice(0, 10), dueDate: d.dueDate?.slice(0, 10) ?? '', reference: d.reference ?? '', notes: d.notes ?? '',
      originalDocumentId: d.originalDocumentId, orderId: d.orderId, purchaseOrderId: d.purchaseOrderId,
    });
    this.lines.clear();
    for (const l of d.lines) this.lines.push(lineGroup(this.fb, { accountId: l.accountId, description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, taxRate: l.taxRate, costCenterId: l.costCenterId ?? null }));
    this.loadOriginals(d.partyId);
    this.editorOpen.set(true);
  }

  partyChanged(): void {
    const id = this.form.controls.partyId.value;
    this.form.controls.originalDocumentId.setValue(null);
    if (id !== null) this.loadOriginals(id);
  }

  // The invoices a return / note can refer to: approved invoices of the same party
  private loadOriginals(partyId: number): void {
    if (this.invoice()) return;
    const type = this.editorKind() === 'Customer' ? 'SalesInvoice' : 'PurchaseInvoice';
    this.api.getDocuments({ type, status: 'Posted', partyId }).subscribe((r) => this.originals.set(r.filter((x) => !x.isClosed)));
  }

  addLine(): void {
    this.lines.push(lineGroup(this.fb));
  }

  removeLine(i: number): void {
    if (this.lines.length > 1) this.lines.removeAt(i);
  }

  applyVat(): void {
    const rate = this.ctx.settings()?.defaultTaxRate ?? 0;
    for (const l of this.lines.controls) l.controls.taxRate.setValue(rate);
  }

  amountOf(line: LineGroup): number {
    const v = line.getRawValue();
    return round2((Number(v.quantity) || 0) * (Number(v.unitPrice) || 0));
  }

  totals(): { subtotal: number; tax: number; total: number } {
    let subtotal = 0;
    let tax = 0;
    for (const l of this.lines.controls) {
      const a = this.amountOf(l);
      subtotal += a;
      tax += round2((a * (Number(l.getRawValue().taxRate) || 0)) / 100);
    }
    return { subtotal: round2(subtotal), tax: round2(tax), total: round2(subtotal + tax) };
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const body = {
      type: this.editorType(), partyId: v.partyId as number, issueDate: v.issueDate as string, dueDate: emptyToNull(v.dueDate), reference: emptyToNull(v.reference),
      notes: emptyToNull(v.notes), originalDocumentId: this.invoice() ? null : v.originalDocumentId, orderId: v.orderId, purchaseOrderId: v.purchaseOrderId,
      lines: v.lines.map((l) => ({
        accountId: l.accountId as number, description: (l.description ?? '').trim(), quantity: Number(l.quantity), unitPrice: Number(l.unitPrice), taxRate: Number(l.taxRate) || 0, costCenterId: l.costCenterId ?? null,
      })),
    };
    const e = this.editing();

    this.saving.set(true);
    const request: Observable<number | void> = e ? this.api.updateDocument(e.id, body) : this.api.createDocument(body);

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

  // ---------- matching

  canApplyCredit(d: AccDocument): boolean {
    return !isInvoice(d.type) && d.status === 'Posted' && !d.isClosed && d.outstanding > 0 && this.auth.can('accounting.treasury');
  }

  startApply(d: AccDocument): void {
    this.applyLines = [];
    const type = partyKindOf(d.type) === 'Customer' ? 'SalesInvoice' : 'PurchaseInvoice';
    this.api.getDocuments({ type, status: 'Posted', partyId: d.partyId, openOnly: true }).subscribe((r) => {
      this.applyDocs.set(r);
      this.applying.set(d);
    });
  }

  saveApply(c: AccDocument): void {
    if (this.applyLines.length === 0) return;
    this.saving.set(true);
    this.api.allocate({ sourceKind: 'document', sourceId: c.id, lines: this.applyLines }).subscribe({
      next: () => {
        this.saving.set(false);
        this.applying.set(null);
        this.toast.success(this.i18n.t('inv.saved'));
        this.reload(c.id);
      },
      error: () => this.saving.set(false),
    });
  }

  undo(allocationId: number, documentId: number): void {
    const reason = prompt(this.i18n.t('acc.alloc.askUndo'));
    if (!reason || !reason.trim()) return;
    this.api.unallocate(allocationId, reason.trim()).subscribe(() => this.reload(documentId));
  }
}
