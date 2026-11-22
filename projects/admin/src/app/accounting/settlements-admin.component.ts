import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe, NgTemplateOutlet, SlicePipe } from '@angular/common';
import { Observable } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { ModalComponent } from '@shared/components/modal.component';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { AccountingContext } from '@shared/core/accounting-context.service';
import { AccDocument, Party, Settlement, SettlementCheck, STATUSES } from '@shared/core/accounting.models';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { printArea } from '@shared/core/print';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { AccEntryDetailsComponent } from './acc-entry-details.component';
import { AccAuditComponent } from './acc-audit.component';
import { AccWorkflowComponent } from './acc-workflow.component';

import { IntroComponent } from '../intro.component';
// Final clearance of a supplier / customer: the documents it covers are chosen, the scope and the balance are checked,
// and only then can it be sent for approval. When it is issued, the invoices are settled and closed.
@Component({
  selector: 'app-settlements-admin',
  standalone: true,
  imports: [IntroComponent, FormsModule, DecimalPipe, NgTemplateOutlet, SlicePipe, TranslatePipe, DataTableComponent, ModalComponent, AccWorkflowComponent, AccAuditComponent, AccEntryDetailsComponent],
  templateUrl: './settlements-admin.component.html',
})
export class SettlementsAdminComponent implements OnInit {
  private readonly api = inject(AccountingApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly ctx = inject(AccountingContext);
  readonly auth = inject(AuthService);

  // Shown inside the settlements hub: the hub has the heading
  @Input() embedded = false;

  readonly canPrepare = this.auth.can('accounting.settlements');
  readonly statuses = STATUSES;
  fStatus = '';

  readonly rows = signal<Settlement[]>([]);
  readonly detail = signal<Settlement | null>(null);
  readonly verification = signal<SettlementCheck | null>(null);
  readonly refresh = signal(0);
  readonly parties = signal<Party[]>([]);
  readonly activeParties = computed(() => this.parties().filter((p) => p.isActive));

  readonly editorOpen = signal(false);
  readonly editing = signal<Settlement | null>(null);
  readonly saving = signal(false);
  readonly partyId = signal<number | null>(null);
  readonly scopeDocs = signal<AccDocument[]>([]);
  readonly picked = signal<Set<number>>(new Set());
  readonly checkResult = signal<SettlementCheck | null>(null);
  date = new Date().toISOString().slice(0, 10);
  adjustment = 0;
  reason = '';
  notes = '';

  readonly columns: DtColumn[] = [
    { key: 'number', label: 'acc.number', value: (s: Settlement) => s.number, width: '120px' },
    { key: 'party', label: 'acc.party', value: (s: Settlement) => s.partyName },
    { key: 'date', label: 'acc.date', value: (s: Settlement) => s.settlementDate.slice(0, 10), filter: 'none', width: '110px' },
    { key: 'items', label: 'acc.st2.docs', value: (s: Settlement) => s.items.length, type: 'number', filter: 'none', width: '90px' },
    { key: 'adj', label: 'acc.st2.adjustment', value: (s: Settlement) => s.adjustmentAmount, type: 'number', filter: 'none', width: '120px' },
    { key: 'status', label: 'a.status', value: (s: Settlement) => s.status, filter: 'select', optionLabel: (x: string) => this.i18n.t(x === 'Posted' ? 'acc.st.issued' : 'acc.st.' + x), width: '150px' },
    { key: 'actions', label: '', width: '90px' },
  ];

  ngOnInit(): void {
    this.ctx.load();
    this.load();
    this.api.getParties().subscribe((p) => this.parties.set(p));
  }

  load(): void {
    this.api.getSettlements({ status: this.fStatus }).subscribe((r) => this.rows.set(r));
  }

  view(id: number): void {
    this.verification.set(null);
    this.api.getSettlement(id).subscribe((s) => this.detail.set(s));
  }

  reload(id: number): void {
    this.refresh.update((n) => n + 1);
    this.api.getSettlement(id).subscribe((s) => this.detail.set(s));
    this.load();
  }

  print(): void {
    printArea();
  }

  verify(id: number): void {
    this.api.verifySettlement(id).subscribe((c) => {
      this.verification.set(c);
      this.reload(id);
    });
  }

  // ---------- editor

  startEdit(s: Settlement | null): void {
    this.detail.set(null);
    this.editing.set(s);
    this.checkResult.set(null);
    this.date = s?.settlementDate.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    this.adjustment = s?.adjustmentAmount ?? 0;
    this.reason = s?.adjustmentReason ?? '';
    this.notes = s?.notes ?? '';
    this.picked.set(new Set(s?.items.map((i) => i.documentId) ?? []));
    this.partyId.set(s?.partyId ?? null);
    this.scopeDocs.set([]);
    if (s) this.loadScope(s.partyId);
    this.editorOpen.set(true);
  }

  pickParty(id: number | null): void {
    this.partyId.set(id);
    this.picked.set(new Set());
    this.checkResult.set(null);
    this.scopeDocs.set([]);
    if (id !== null) this.loadScope(id);
  }

  // Every approved document of the party that is not closed yet (paid ones too: they are what gets closed)
  private loadScope(partyId: number): void {
    this.api.getDocuments({ partyId, status: 'Posted' }).subscribe((r) => this.scopeDocs.set(r.filter((d) => !d.isClosed || this.picked().has(d.id))));
  }

  toggle(id: number): void {
    this.picked.update((set) => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
    this.checkResult.set(null);
  }

  pickAll(all: boolean): void {
    this.picked.set(all ? new Set(this.scopeDocs().map((d) => d.id)) : new Set());
    this.checkResult.set(null);
  }

  private body() {
    return {
      partyId: this.partyId() as number, settlementDate: this.date, adjustmentAmount: Number(this.adjustment) || 0,
      adjustmentReason: this.reason.trim() || null, notes: this.notes.trim() || null, documentIds: [...this.picked()],
    };
  }

  check(): void {
    this.api.checkSettlement(this.body()).subscribe((c) => this.checkResult.set(c));
  }

  save(): void {
    this.saving.set(true);
    const e = this.editing();
    const request: Observable<number | void> = e ? this.api.updateSettlement(e.id, this.body()) : this.api.createSettlement(this.body());

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
