import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ModalComponent } from '@shared/components/modal.component';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { Account, PostingAccountMode, PostingCatalog, PostingLine, PostingLineInput, PostingSide, PostingTemplate } from '@shared/core/accounting.models';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';

import { IntroComponent } from '../intro.component';
// One row of the debit details / credit details while it is being edited
interface Row {
  accountMode: PostingAccountMode; accountId: number | null; roleKey: string | null; amountSource: string; usePercent: boolean; percent: number;
  linkParty: boolean; description: string;
}
interface Draft { isActive: boolean; notes: string; debit: Row[]; credit: Row[]; }

const GROUPS = ['sales', 'purchases', 'money'] as const;

// Automatic entries: for every kind of operation the system books by itself, what is DEBITED (debit details) and what is CREDITED (credit details)
@Component({
  selector: 'app-posting-templates-admin',
  standalone: true,
  imports: [IntroComponent, FormsModule, TranslatePipe, ModalComponent],
  templateUrl: './posting-templates-admin.component.html',
  styleUrl: './posting-templates-admin.component.css',
})
export class PostingTemplatesAdminComponent implements OnInit {
  private readonly api = inject(AccountingApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  readonly canEdit = this.auth.can('accounting.settings');
  readonly groups = GROUPS;
  readonly sides = ['debit', 'credit'] as const;
  readonly catalog = signal<PostingCatalog | null>(null);
  readonly accounts = signal<Account[]>([]);
  readonly postable = computed(() => this.accounts().filter((a) => a.isPostable && a.isActive));
  readonly editing = signal<PostingTemplate | null>(null);
  readonly saving = signal(false);
  draft: Draft = { isActive: true, notes: '', debit: [], credit: [] };

  ngOnInit(): void {
    this.load();
    this.api.getAccounts().subscribe((a) => this.accounts.set(a));
  }

  load(): void {
    this.api.getPostingTemplates().subscribe((c) => this.catalog.set(c));
  }

  inGroup(g: string): PostingTemplate[] {
    return (this.catalog()?.templates ?? []).filter((t) => t.group === g);
  }

  // A short line for the list: what each row is
  summary(rows: PostingLine[]): string {
    if (rows.length === 0) return '—';
    return rows.map((l) => this.label(l)).join(' + ');
  }

  private label(l: PostingLine): string {
    const percent = l.usePercent ? ` ${l.percent}%` : '';
    switch (l.accountMode) {
      case 'Fixed': return (l.accountLabel ?? '?') + percent;
      case 'Role': return (l.roleName ?? '?') + percent;
      default: return this.i18n.t('accs.auto.mode.' + l.accountMode) + percent;
    }
  }

  modesOf(t: PostingTemplate): PostingAccountMode[] {
    const modes: PostingAccountMode[] = ['Fixed', 'Role'];
    if (t.partyKind) modes.push('Party');
    if (t.hasDocumentLines) modes.push('DocumentLines');
    if (t.hasTreasury) modes.push('Treasury');
    if (t.hasCounter) modes.push('Counter');
    return modes;
  }

  rowsOf(side: 'debit' | 'credit'): Row[] {
    return this.draft[side];
  }

  private toRow(l: PostingLine): Row {
    return {
      accountMode: l.accountMode, accountId: l.accountId, roleKey: l.roleKey, amountSource: l.amountSource, usePercent: l.usePercent, percent: l.percent,
      linkParty: l.linkParty, description: l.description ?? '',
    };
  }

  open(t: PostingTemplate): void {
    this.draft = { isActive: t.isActive || !t.isCustomized, notes: t.notes ?? '', debit: t.debit.map((l) => this.toRow(l)), credit: t.credit.map((l) => this.toRow(l)) };
    this.editing.set(t);
  }

  changeMode(r: Row, mode: PostingAccountMode, t: PostingTemplate): void {
    r.accountMode = mode;
    r.accountId = null;
    r.roleKey = null;
    r.amountSource = mode === 'DocumentLines' ? 'lines' : (t.sources.includes(r.amountSource) ? r.amountSource : t.sources[0]);
    if (mode === 'Party') r.linkParty = true;
  }

  addRow(side: 'debit' | 'credit', t: PostingTemplate): void {
    this.draft[side].push({ accountMode: 'Fixed', accountId: null, roleKey: null, amountSource: t.sources[0], usePercent: false, percent: 100, linkParty: false, description: '' });
  }

  removeRow(side: 'debit' | 'credit', i: number): void {
    this.draft[side].splice(i, 1);
  }

  private toInput(side: PostingSide, r: Row): PostingLineInput {
    return {
      side, accountMode: r.accountMode, accountId: r.accountMode === 'Fixed' ? r.accountId : null, roleKey: r.accountMode === 'Role' ? r.roleKey : null,
      amountSource: r.accountMode === 'DocumentLines' ? 'lines' : r.amountSource, usePercent: r.usePercent, percent: r.usePercent ? +r.percent : 100,
      linkParty: r.linkParty, description: r.description.trim() || null,
    };
  }

  save(t: PostingTemplate): void {
    this.saving.set(true);
    const lines = [...this.draft.debit.map((r) => this.toInput('Debit', r)), ...this.draft.credit.map((r) => this.toInput('Credit', r))];

    this.api.savePostingTemplate(t.eventKey, { isActive: this.draft.isActive, notes: this.draft.notes.trim() || null, lines }).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.toast.success(this.i18n.t('inv.saved'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }

  reset(t: PostingTemplate): void {
    if (!confirm(this.i18n.t('accs.auto.resetConfirm'))) return;
    this.api.resetPostingTemplate(t.eventKey).subscribe(() => {
      this.editing.set(null);
      this.toast.success(this.i18n.t('inv.saved'));
      this.load();
    });
  }
}
