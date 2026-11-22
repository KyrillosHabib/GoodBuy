import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { ModalComponent } from '@shared/components/modal.component';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { AccountingContext } from '@shared/core/accounting-context.service';
import {
  AccDocument, Account, Carrier, CarrierCollection, CostCenter, CarrierSettlement, GatewayCollection, GatewaySettlement, CashAccount, CashAccountType, DocumentType, METHODS, Party, PartyKind, STATUSES, Transfer, Voucher, VoucherMethod, VoucherType,
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
// What a voucher can settle: a receipt from a customer settles his sales invoices, a payment to a supplier settles his purchase invoices;
// the opposite directions (refunds) settle credit / debit documents
function settledTypes(voucher: VoucherType, party: PartyKind): DocumentType[] {
  if (voucher === 'Receipt' && party === 'Customer') return ['SalesInvoice'];
  if (voucher === 'Payment' && party === 'Supplier') return ['PurchaseInvoice'];
  if (voucher === 'Payment' && party === 'Customer') return ['SalesReturn', 'CreditNote'];
  return ['PurchaseReturn', 'DebitNote'];
}

// Cash boxes and banks, receipt and payment vouchers (matched to invoices) and transfers between them
@Component({
  selector: 'app-treasury-admin',
  standalone: true,
  imports: [IntroComponent, ReactiveFormsModule, FormsModule, DecimalPipe, SlicePipe, TranslatePipe, DataTableComponent, ModalComponent, AccWorkflowComponent, AccAuditComponent, AccAllocTableComponent, AccEntryDetailsComponent],
  templateUrl: './treasury-admin.component.html',
})
export class TreasuryAdminComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AccountingApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly ctx = inject(AccountingContext);
  readonly auth = inject(AuthService);

  readonly canPrepare = this.auth.can('accounting.treasury');
  readonly Number = Number;
  readonly methods = METHODS;
  readonly statuses = STATUSES;

  private readonly route = inject(ActivatedRoute);
  // On the settings route this screen only defines the cash boxes and banks
  readonly only: boolean = this.route.snapshot.data['only'] === true;
  // Shown inside the settlements hub: only one tab ('carriers' | 'gateways'), without the heading, the cards and the tab strip
  @Input() onlyTab: 'carriers' | 'gateways' | null = null;
  readonly tab = signal<'vouchers' | 'transfers' | 'cash' | 'carriers' | 'gateways'>(this.route.snapshot.data['only'] === true ? 'cash' : 'vouchers');
  readonly saving = signal(false);
  readonly refresh = signal(0);

  readonly cashAccounts = signal<CashAccount[]>([]);
  readonly parties = signal<Party[]>([]);
  readonly accounts = signal<Account[]>([]);
  readonly costCenters = signal<CostCenter[]>([]);
  readonly vouchers = signal<Voucher[]>([]);
  readonly transfers = signal<Transfer[]>([]);
  vType = '';
  vStatus = '';

  // Boxes and banks that vouchers and transfers can use (the money held by shipping companies moves only with a settlement with them)
  readonly activeCash = computed(() => this.cashAccounts().filter((c) => c.isActive && c.type !== 'Custody' && c.type !== 'Gateway'));
  readonly cashTotal = computed(() => this.cashAccounts().filter((c) => c.isActive && c.type !== 'Custody' && c.type !== 'Gateway').reduce((a, c) => a + c.balance, 0));
  readonly gatewayAccounts = computed(() => this.cashAccounts().filter((c) => c.isActive && c.type === 'Gateway'));
  readonly gatewayTotal = computed(() => this.cashAccounts().filter((c) => c.type === 'Gateway').reduce((a, c) => a + c.balance, 0));
  readonly custodyTotal = computed(() => this.cashAccounts().filter((c) => c.type === 'Custody').reduce((a, c) => a + c.balance, 0));
  readonly activeParties = computed(() => this.parties().filter((p) => p.isActive));

  // ---------- vouchers
  readonly voucherOpen = signal(false);
  readonly voucherEditing = signal<Voucher | null>(null);
  readonly voucherDetail = signal<Voucher | null>(null);
  readonly matching = signal<Voucher | null>(null);
  readonly openDocs = signal<AccDocument[]>([]);
  allocLines: { documentId: number; amount: number }[] = [];
  presetLines: { documentId: number; amount: number }[] | null = null;

  readonly vForm = this.fb.group({
    type: ['Receipt' as VoucherType],
    purpose: ['Party' as 'Party' | 'Other'],
    cashAccountId: [null as number | null, Validators.required],
    partyId: [null as number | null],
    counterAccountId: [null as number | null],
    costCenterId: [null as number | null],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    voucherDate: [new Date().toISOString().slice(0, 10), Validators.required],
    method: ['Cash' as VoucherMethod],
    reference: [''],
    notes: [''],
  });
  private readonly voucherType = signal<VoucherType>('Receipt');
  private readonly counterTick = signal(0);

  // Not every receipt is revenue and not every payment is an expense: the account chosen says what the money is.
  readonly counterChoices = computed(() => {
    this.counterTick();
    const cash = new Set(this.cashAccounts().map((c) => c.accountId));
    const receipt = this.voucherType() === 'Receipt';

    return this.accounts().filter(
      (a) => a.isPostable && a.isActive && !cash.has(a.id) && a.systemKey !== 'ar' && a.systemKey !== 'ap' &&
        (receipt ? a.type !== 'Expense' : a.type !== 'Revenue'),
    );
  });

  readonly voucherColumns: DtColumn[] = [
    { key: 'number', label: 'acc.number', value: (v: Voucher) => v.number, width: '120px' },
    { key: 'type', label: 'acc.type', value: (v: Voucher) => v.type, filter: 'select', optionLabel: (x: string) => this.i18n.t('acc.voucher.' + x), width: '130px' },
    { key: 'date', label: 'acc.date', value: (v: Voucher) => v.voucherDate.slice(0, 10), filter: 'none', width: '110px' },
    { key: 'who', label: 'acc.tr.who', value: (v: Voucher) => v.partyName ?? v.counterAccountName },
    { key: 'cash', label: 'acc.tr.cashAccount', value: (v: Voucher) => v.cashAccountName, filter: 'select' },
    { key: 'amount', label: 'acc.amount', value: (v: Voucher) => v.amount, type: 'number', filter: 'none', width: '120px' },
    { key: 'free', label: 'acc.tr.unmatched', value: (v: Voucher) => v.unallocated, type: 'number', filter: 'none', width: '120px' },
    { key: 'status', label: 'a.status', value: (v: Voucher) => v.status, filter: 'select', optionLabel: (x: string) => this.i18n.t('acc.st.' + x), width: '150px' },
    { key: 'actions', label: '', width: '90px' },
  ];

  // ---------- transfers
  readonly transferOpen = signal(false);
  readonly transferEditing = signal<Transfer | null>(null);
  readonly transferDetail = signal<Transfer | null>(null);
  readonly tForm = this.fb.group({
    fromCashAccountId: [null as number | null, Validators.required],
    toCashAccountId: [null as number | null, Validators.required],
    amount: [0, [Validators.required, Validators.min(0.01)]],
    transferDate: [new Date().toISOString().slice(0, 10), Validators.required],
    reference: [''],
    notes: [''],
  });
  readonly transferColumns: DtColumn[] = [
    { key: 'number', label: 'acc.number', value: (t: Transfer) => t.number, width: '120px' },
    { key: 'date', label: 'acc.date', value: (t: Transfer) => t.transferDate.slice(0, 10), filter: 'none', width: '110px' },
    { key: 'route', label: 'acc.tr.route', value: (t: Transfer) => `${t.fromName} → ${t.toName}` },
    { key: 'amount', label: 'acc.amount', value: (t: Transfer) => t.amount, type: 'number', filter: 'none', width: '120px' },
    { key: 'status', label: 'a.status', value: (t: Transfer) => t.status, filter: 'select', optionLabel: (x: string) => this.i18n.t('acc.st.' + x), width: '150px' },
    { key: 'actions', label: '', width: '90px' },
  ];


  // ---------- cash held by the shipping companies

  readonly carriers = signal<Carrier[]>([]);
  readonly held = signal<CarrierCollection[]>([]);
  readonly carrierSettlements = signal<CarrierSettlement[]>([]);
  readonly csOpen = signal(false);
  readonly csEditing = signal<CarrierSettlement | null>(null);
  readonly csDetail = signal<CarrierSettlement | null>(null);
  readonly csChoices = signal<CarrierCollection[]>([]);
  readonly csPicked = signal<Set<number>>(new Set());
  csCarrier: number | null = null;
  csTo: number | null = null;
  csDate = new Date().toISOString().slice(0, 10);
  csFees = 0;
  csDifference = 0;
  csReference = '';
  csNotes = '';

  heldTotal(): number {
    return this.held().reduce((a, h) => a + h.amount, 0);
  }

  csCollected(): number {
    return Math.round(this.csChoices().filter((h) => this.csPicked().has(h.voucherId)).reduce((a, h) => a + h.amount, 0) * 100) / 100;
  }

  csSuggested(): number {
    return Math.round(this.csChoices().filter((h) => this.csPicked().has(h.voucherId)).reduce((a, h) => a + h.suggestedFee, 0) * 100) / 100;
  }

  loadCarriers(): void {
    this.api.getCarriers().subscribe((c) => this.carriers.set(c.filter((x) => x.isActive)));
    this.api.getCarrierCollections().subscribe((h) => this.held.set(h));
    this.api.getCarrierSettlements().subscribe((s) => this.carrierSettlements.set(s));
  }

  startCarrierSettlement(c: CarrierSettlement | null): void {
    this.csDetail.set(null);
    this.csEditing.set(c);
    this.csCarrier = c?.carrierId ?? null;
    this.csTo = c?.toCashAccountId ?? null;
    this.csDate = c?.settlementDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    this.csFees = c?.fees ?? 0;
    this.csDifference = c?.difference ?? 0;
    this.csReference = c?.reference ?? '';
    this.csNotes = c?.notes ?? '';
    this.csPicked.set(new Set(c?.items.map((i) => i.voucherId) ?? []));
    this.csChoices.set([]);
    if (this.csCarrier !== null) this.loadChoices();
    this.csOpen.set(true);
  }

  pickCarrier(id: number | null): void {
    this.csCarrier = id;
    this.csPicked.set(new Set());
    this.csFees = 0;
    this.csDifference = 0;
    this.csChoices.set([]);
    if (id !== null) this.loadChoices();
  }

  private loadChoices(): void {
    this.api.getCarrierCollections(this.csCarrier, this.csEditing()?.id ?? null).subscribe((r) => this.csChoices.set(r));
  }

  togglePick(id: number): void {
    this.csPicked.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    this.csFees = this.csSuggested();
  }

  pickAllCollections(all: boolean): void {
    this.csPicked.set(all ? new Set(this.csChoices().map((h) => h.voucherId)) : new Set());
    this.csFees = this.csSuggested();
  }

  saveCarrierSettlement(): void {
    const collected = this.csCollected();
    const fees = Math.round((Number(this.csFees) || 0) * 100) / 100;
    const difference = Math.round((Number(this.csDifference) || 0) * 100) / 100;
    const body = {
      carrierId: this.csCarrier as number, toCashAccountId: this.csTo as number, settlementDate: this.csDate, amountReceived: Math.round((collected - fees - difference) * 100) / 100,
      fees, difference, reference: this.csReference.trim() || null, notes: this.csNotes.trim() || null, voucherIds: [...this.csPicked()],
    };
    const e = this.csEditing();

    if (body.amountReceived < 0) {
      this.toast.error(this.i18n.t('acc.tr.feesTooHigh'));
      return;
    }

    if (difference > 0 && !body.notes) {
      this.toast.error(this.i18n.t('acc.tr.differenceNeedsNote'));
      return;
    }

    this.saving.set(true);
    const request: Observable<number | void> = e ? this.api.updateCarrierSettlement(e.id, body) : this.api.createCarrierSettlement(body);

    request.subscribe({
      next: (id) => {
        this.saving.set(false);
        this.csOpen.set(false);
        this.toast.success(this.i18n.t('inv.saved'));
        this.loadCarriers();
        this.viewCarrierSettlement(e ? e.id : (id as number));
      },
      error: () => this.saving.set(false),
    });
  }

  viewCarrierSettlement(id: number): void {
    this.api.getCarrierSettlement(id).subscribe((c) => this.csDetail.set(c));
  }

  // ---------- money held by the online payment gateways

  readonly gwHeld = signal<GatewayCollection[]>([]);
  readonly gatewaySettlements = signal<GatewaySettlement[]>([]);
  readonly gsOpen = signal(false);
  readonly gsEditing = signal<GatewaySettlement | null>(null);
  readonly gsDetail = signal<GatewaySettlement | null>(null);
  readonly gsChoices = signal<GatewayCollection[]>([]);
  readonly gsPicked = signal<Set<number>>(new Set());
  gsGateway: number | null = null;
  gsTo: number | null = null;
  gsDate = new Date().toISOString().slice(0, 10);
  gsReceived = 0;
  gsFees = 0;
  gsDifference = 0;
  gsReference = '';
  gsNotes = '';

  gwHeldTotal(): number {
    return Math.round(this.gwHeld().reduce((a, h) => a + h.amount, 0) * 100) / 100;
  }

  // Payments count +, refunds -
  gsCollected(): number {
    return Math.round(this.gsChoices().filter((h) => this.gsPicked().has(h.voucherId)).reduce((a, h) => a + h.amount, 0) * 100) / 100;
  }

  // What is still unexplained: collected - received - fees - difference (must be 0)
  gsBalance(): number {
    return Math.round((this.gsCollected() - (Number(this.gsReceived) || 0) - (Number(this.gsFees) || 0) - (Number(this.gsDifference) || 0)) * 100) / 100;
  }

  loadGateways(): void {
    this.api.getGatewayCollections().subscribe((h) => this.gwHeld.set(h));
    this.api.getGatewaySettlements().subscribe((s) => this.gatewaySettlements.set(s));
  }

  startGatewaySettlement(c: GatewaySettlement | null): void {
    this.gsDetail.set(null);
    this.gsEditing.set(c);
    this.gsGateway = c?.gatewayCashAccountId ?? (this.gatewayAccounts().length === 1 ? this.gatewayAccounts()[0].id : null);
    this.gsTo = c?.toCashAccountId ?? null;
    this.gsDate = c?.settlementDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    this.gsReceived = c?.amountReceived ?? 0;
    this.gsFees = c?.fees ?? 0;
    this.gsDifference = c?.difference ?? 0;
    this.gsReference = c?.reference ?? '';
    this.gsNotes = c?.notes ?? '';
    this.gsPicked.set(new Set(c?.items.map((i) => i.voucherId) ?? []));
    this.gsChoices.set([]);
    if (this.gsGateway !== null) this.loadGwChoices();
    this.gsOpen.set(true);
  }

  pickGateway(id: number | null): void {
    this.gsGateway = id;
    this.gsPicked.set(new Set());
    this.gsReceived = 0;
    this.gsFees = 0;
    this.gsDifference = 0;
    this.gsChoices.set([]);
    if (id !== null) this.loadGwChoices();
  }

  private loadGwChoices(): void {
    this.api.getGatewayCollections(this.gsGateway, this.gsEditing()?.id ?? null).subscribe((r) => this.gsChoices.set(r));
  }

  // The expected payout is offered after every change (the user types the real figures from the gateway statement)
  private suggestGw(): void {
    this.gsReceived = Math.max(0, this.gsCollected() - (Number(this.gsFees) || 0) - (Number(this.gsDifference) || 0));
  }

  toggleGwPick(id: number): void {
    this.gsPicked.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    this.suggestGw();
  }

  pickAllGw(all: boolean): void {
    this.gsPicked.set(all ? new Set(this.gsChoices().map((h) => h.voucherId)) : new Set());
    this.suggestGw();
  }

  saveGatewaySettlement(): void {
    const round = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
    const body = {
      gatewayCashAccountId: this.gsGateway as number, toCashAccountId: this.gsTo as number, settlementDate: this.gsDate,
      amountReceived: round(this.gsReceived), fees: round(this.gsFees), difference: round(this.gsDifference),
      reference: this.gsReference.trim() || null, notes: this.gsNotes.trim() || null, voucherIds: [...this.gsPicked()],
    };
    const e = this.gsEditing();

    if (this.gsBalance() !== 0) {
      this.toast.error(this.i18n.t('acc.tr.gwUnbalanced'));
      return;
    }

    if (body.difference > 0 && !body.notes) {
      this.toast.error(this.i18n.t('acc.tr.differenceNeedsNote'));
      return;
    }

    this.saving.set(true);
    const request: Observable<number | void> = e ? this.api.updateGatewaySettlement(e.id, body) : this.api.createGatewaySettlement(body);

    request.subscribe({
      next: (id) => {
        this.saving.set(false);
        this.gsOpen.set(false);
        this.toast.success(this.i18n.t('inv.saved'));
        this.loadGateways();
        this.viewGatewaySettlement(e ? e.id : (id as number));
      },
      error: () => this.saving.set(false),
    });
  }

  viewGatewaySettlement(id: number): void {
    this.api.getGatewaySettlement(id).subscribe((c) => this.gsDetail.set(c));
  }

  afterGatewaySettlement(id: number): void {
    this.refresh.update((n) => n + 1);
    this.viewGatewaySettlement(id);
    this.loadGateways();
    this.loadCash();
  }

  afterCarrierSettlement(id: number): void {
    this.refresh.update((n) => n + 1);
    this.viewCarrierSettlement(id);
    this.loadCarriers();
    this.loadCash();
  }

  // ---------- cash accounts
  readonly cashOpen = signal(false);
  readonly cashEditing = signal<CashAccount | null>(null);
  readonly cForm = this.fb.group({
    name: [''], nameAr: ['', Validators.required], type: ['Cash' as CashAccountType], accountId: [null as number | null, Validators.required],
    bankName: [''], accountNumber: [''], isActive: [true], responsibleName: [''], currencyCode: [''],
  });
  // The ways of payment this box takes (empty = every way)
  allowed: string[] = [];
  readonly cashColumns: DtColumn[] = [
    { key: 'name', label: 'a.name', value: (c: CashAccount) => c.name },
    { key: 'type', label: 'acc.type', value: (c: CashAccount) => c.type, filter: 'select', optionLabel: (x: string) => this.i18n.t('acc.cash.' + x), width: '120px' },
    { key: 'code', label: 'acc.code', value: (c: CashAccount) => c.accountCode, filter: 'none', width: '110px' },
    { key: 'number', label: 'acc.tr.accountNumber', value: (c: CashAccount) => c.accountNumber, filter: 'none' },
    { key: 'balance', label: 'acc.balance', value: (c: CashAccount) => c.balance, type: 'number', filter: 'none', width: '130px' },
    { key: 'active', label: 'a.active', value: (c: CashAccount) => c.isActive, type: 'bool', width: '90px' },
    { key: 'actions', label: '', width: '100px' },
  ];

  // An ordinary asset account that no other cash / bank account uses
  readonly cashLedgerChoices = computed(() => {
    const used = new Set(this.cashAccounts().filter((c) => c.id !== this.cashEditing()?.id).map((c) => c.accountId));
    return this.accounts().filter((a) => a.type === 'Asset' && a.isPostable && a.isActive && !a.systemKey && !used.has(a.id));
  });

  ngOnInit(): void {
    if (this.onlyTab)
      this.tab.set(this.onlyTab);

    this.ctx.load();
    this.loadCash();
    this.loadVouchers();
    this.loadTransfers();
    this.loadCarriers();
    this.loadGateways();
    this.api.getParties().subscribe((p) => this.parties.set(p));
    this.api.getCostCenters().subscribe({ next: (c) => this.costCenters.set(c.filter((x) => x.isActive)), error: () => undefined });
    this.api.getAccounts().subscribe((a) => { this.accounts.set(a); this.counterTick.update((n) => n + 1); });
  }

  print(): void {
    printArea();
  }

  loadCash(): void { this.api.getCashAccounts().subscribe((c) => this.cashAccounts.set(c)); }
  loadVouchers(): void { this.api.getVouchers({ type: this.vType, status: this.vStatus }).subscribe((v) => this.vouchers.set(v)); }
  loadTransfers(): void { this.api.getTransfers().subscribe((t) => this.transfers.set(t)); }

  // ---------- vouchers

  startVoucher(type: VoucherType, v: Voucher | null, expense = false): void {
    this.voucherDetail.set(null);
    this.voucherEditing.set(v);
    this.voucherType.set(type);
    this.allocLines = [];
    this.presetLines = v ? v.allocations.filter((a) => a.isPlanned && !a.isReversed).map((a) => ({ documentId: a.documentId, amount: a.amount })) : null;
    this.vForm.reset({
      type, purpose: v?.purpose ?? (expense ? 'Other' : 'Party'), cashAccountId: v?.cashAccountId ?? null, partyId: v?.partyId ?? null, counterAccountId: v?.counterAccountId ?? null, costCenterId: v?.costCenterId ?? null,
      amount: v?.amount ?? 0, voucherDate: v?.voucherDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10), method: v?.method ?? 'Cash',
      reference: v?.reference ?? '', notes: v?.notes ?? '',
    });
    this.openDocs.set([]);
    if (v?.partyId) this.loadOpenDocs(v.partyId, type);
    this.voucherOpen.set(true);
  }

  setPurpose(p: 'Party' | 'Other'): void {
    this.vForm.patchValue({ purpose: p, partyId: null, counterAccountId: null });
    this.openDocs.set([]);
    this.allocLines = [];
  }

  partyPicked(): void {
    const id = this.vForm.controls.partyId.value;
    this.allocLines = [];
    this.presetLines = null;
    this.openDocs.set([]);
    if (id !== null) this.loadOpenDocs(id, this.vForm.controls.type.value ?? 'Receipt');
  }

  // The open documents this kind of voucher can settle
  private loadOpenDocs(partyId: number, voucherType: VoucherType): void {
    const party = this.parties().find((p) => p.id === partyId);
    if (!party) {
      // The parties may still be loading: try again once they are known
      this.api.getParties().subscribe((list) => { this.parties.set(list); if (list.some((p) => p.id === partyId)) this.loadOpenDocs(partyId, voucherType); });
      return;
    }
    const types = settledTypes(voucherType, party.kind);
    this.api.getDocuments({ partyId, status: 'Posted', openOnly: true }).subscribe((r) => this.openDocs.set(r.filter((d) => types.includes(d.type))));
  }

  saveVoucher(): void {
    if (this.vForm.invalid) {
      this.vForm.markAllAsTouched();
      return;
    }

    const v = this.vForm.getRawValue();
    const party = v.purpose === 'Party';

    if (party && v.partyId === null) { this.toast.error(this.i18n.t('acc.tr.pickParty')); return; }
    if (!party && v.counterAccountId === null) { this.toast.error(this.i18n.t('acc.tr.pickCounter')); return; }

    const body = {
      type: v.type as VoucherType, purpose: v.purpose as 'Party' | 'Other', cashAccountId: v.cashAccountId as number, partyId: party ? v.partyId : null,
      counterAccountId: party ? null : v.counterAccountId, costCenterId: party ? null : v.costCenterId, amount: Number(v.amount), voucherDate: v.voucherDate as string, method: v.method as VoucherMethod,
      reference: emptyToNull(v.reference), notes: emptyToNull(v.notes), allocations: party ? this.allocLines : [],
    };
    const e = this.voucherEditing();

    this.saving.set(true);
    const request: Observable<number | void> = e ? this.api.updateVoucher(e.id, body) : this.api.createVoucher(body);

    request.subscribe({
      next: (id) => {
        this.saving.set(false);
        this.voucherOpen.set(false);
        this.toast.success(this.i18n.t('inv.saved'));
        this.loadVouchers();
        this.viewVoucher(e ? e.id : (id as number));
      },
      error: () => this.saving.set(false),
    });
  }

  viewVoucher(id: number): void {
    this.api.getVoucher(id).subscribe((v) => this.voucherDetail.set(v));
  }

  reloadVoucher(id: number): void {
    this.refresh.update((n) => n + 1);
    this.viewVoucher(id);
    this.loadVouchers();
    this.loadCash();
  }

  startMatch(v: Voucher): void {
    this.allocLines = [];
    const party = this.parties().find((p) => p.id === v.partyId);
    if (!party || v.partyId === null) return;
    const types = settledTypes(v.type, party.kind);
    this.api.getDocuments({ partyId: v.partyId, status: 'Posted', openOnly: true }).subscribe((r) => {
      this.openDocs.set(r.filter((d) => types.includes(d.type)));
      this.matching.set(v);
    });
  }

  saveMatch(v: Voucher): void {
    if (this.allocLines.length === 0) return;
    this.saving.set(true);
    this.api.allocate({ sourceKind: 'voucher', sourceId: v.id, lines: this.allocLines }).subscribe({
      next: () => {
        this.saving.set(false);
        this.matching.set(null);
        this.toast.success(this.i18n.t('inv.saved'));
        this.reloadVoucher(v.id);
      },
      error: () => this.saving.set(false),
    });
  }

  // ---------- transfers

  startTransfer(t: Transfer | null): void {
    this.transferDetail.set(null);
    this.transferEditing.set(t);
    this.tForm.reset({
      fromCashAccountId: t?.fromCashAccountId ?? null, toCashAccountId: t?.toCashAccountId ?? null, amount: t?.amount ?? 0,
      transferDate: t?.transferDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10), reference: t?.reference ?? '', notes: t?.notes ?? '',
    });
    this.transferOpen.set(true);
  }

  saveTransfer(): void {
    if (this.tForm.invalid) {
      this.tForm.markAllAsTouched();
      return;
    }

    const v = this.tForm.getRawValue();

    if (v.fromCashAccountId === v.toCashAccountId) {
      this.toast.error(this.i18n.t('acc.tr.sameAccount'));
      return;
    }

    const body = {
      fromCashAccountId: v.fromCashAccountId as number, toCashAccountId: v.toCashAccountId as number, amount: Number(v.amount),
      transferDate: v.transferDate as string, reference: emptyToNull(v.reference), notes: emptyToNull(v.notes),
    };
    const e = this.transferEditing();

    this.saving.set(true);
    const request: Observable<unknown> = e ? this.api.updateTransfer(e.id, body) : this.api.createTransfer(body);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.transferOpen.set(false);
        this.toast.success(this.i18n.t('inv.saved'));
        this.afterTransfer();
      },
      error: () => this.saving.set(false),
    });
  }

  // Reloads the list and the open transfer (after an approval step)
  afterTransfer(): void {
    this.refresh.update((n) => n + 1);
    this.api.getTransfers().subscribe((list) => {
      this.transfers.set(list);
      const open = this.transferDetail();
      if (open) this.transferDetail.set(list.find((x) => x.id === open.id) ?? null);
    });
    this.loadCash();
  }

  // ---------- cash accounts

  startCash(c: CashAccount | null): void {
    this.cashEditing.set(c);
    this.cForm.reset({
      name: c && c.nameEn !== c.nameAr ? c.nameEn : '', nameAr: c?.nameAr ?? c?.nameEn ?? '', type: c?.type ?? 'Cash', accountId: c?.accountId ?? null,
      bankName: c?.bankName ?? '', accountNumber: c?.accountNumber ?? '', isActive: c?.isActive ?? true,
      responsibleName: c?.responsibleName ?? '', currencyCode: c?.currencyCode ?? '',
    });
    this.allowed = [...(c?.allowedMethods ?? [])];
    this.cashOpen.set(true);
  }

  toggleAllowed(method: string, on: boolean): void {
    this.allowed = on ? [...this.allowed.filter((m) => m !== method), method] : this.allowed.filter((m) => m !== method);
  }

  saveCash(): void {
    if (this.cForm.invalid) {
      this.cForm.markAllAsTouched();
      return;
    }

    const v = this.cForm.getRawValue();
    const body = {
      name: emptyToNull(v.name), nameAr: emptyToNull(v.nameAr), type: v.type as CashAccountType, accountId: v.accountId as number,
      bankName: emptyToNull(v.bankName), accountNumber: emptyToNull(v.accountNumber), isActive: !!v.isActive,
      responsibleName: emptyToNull(v.responsibleName), currencyCode: emptyToNull(v.currencyCode), allowedMethods: this.allowed,
      // The bank details are kept as they are (they are edited in Accounting settings > Banks)
      bankBranchId: this.cashEditing()?.bankBranchId ?? null, bankAccountKind: this.cashEditing()?.bankAccountKind ?? null,
      accountHolder: this.cashEditing()?.accountHolder ?? null, iban: this.cashEditing()?.iban ?? null,
    };
    const e = this.cashEditing();

    this.saving.set(true);
    const request: Observable<unknown> = e ? this.api.updateCashAccount(e.id, body) : this.api.createCashAccount(body);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.cashOpen.set(false);
        this.toast.success(this.i18n.t('inv.saved'));
        this.loadCash();
      },
      error: () => this.saving.set(false),
    });
  }
}
