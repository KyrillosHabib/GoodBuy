import { Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { AccountingContext } from '@shared/core/accounting-context.service';
import { Approvable, WorkflowKind } from '@shared/core/accounting.models';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';

// The status of an item and the steps of its approval: prepared by one person, approved by another.
// The buttons shown follow the permissions of the signed-in user; the API checks the same rules again.
@Component({
  selector: 'app-acc-workflow',
  standalone: true,
  imports: [TranslatePipe, SlicePipe],
  templateUrl: './acc-workflow.component.html',
})
export class AccWorkflowComponent implements OnInit {
  @Input({ required: true }) kind!: WorkflowKind;
  @Input({ required: true }) id!: number;
  @Input({ required: true }) item!: Approvable;
  // The permission of the people who prepare this kind of item
  @Input({ required: true }) preparePermission!: string;
  // The permission of the people who approve it
  @Input() approvePermission = 'accounting.approve';
  @Output() done = new EventEmitter<void>();

  readonly auth = inject(AuthService);
  private readonly api = inject(AccountingApiService);
  private readonly ctx = inject(AccountingContext);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly busy = signal(false);

  ngOnInit(): void {
    this.ctx.load();
  }

  canSubmit(): boolean {
    return (this.item.status === 'Draft' || this.item.status === 'Rejected') && this.auth.can(this.preparePermission);
  }

  canApproveNow(): boolean {
    const allowSelf = this.ctx.settings()?.allowSelfApproval ?? false;
    return allowSelf || this.item.createdByName !== this.auth.email();
  }

  canCancel(): boolean {
    const s = this.item.status;
    if (s === 'Posted') return this.auth.can(this.approvePermission);
    if (s === 'Draft' || s === 'Rejected' || s === 'PendingApproval') return this.auth.can(this.preparePermission, this.approvePermission);
    return false;
  }

  run(action: 'submit' | 'approve' | 'reject' | 'cancel', needsReason = false): void {
    let reason: string | undefined;

    if (needsReason) {
      const text = prompt(this.i18n.t(action === 'reject' ? 'acc.wf.askReject' : this.item.status === 'Posted' ? 'acc.wf.askReverse' : 'acc.wf.askCancel'));
      if (!text || !text.trim()) return;
      reason = text.trim();
    } else if (action === 'approve' && !confirm(this.i18n.t(this.kind === 'settlement' ? 'acc.wf.confirmIssue' : 'acc.wf.confirmApprove'))) {
      return;
    }

    this.busy.set(true);
    this.api.workflow(this.kind, this.id, action, reason).subscribe({
      next: () => {
        this.busy.set(false);
        this.toast.success(this.i18n.t('acc.wf.done'));
        this.done.emit();
      },
      error: () => this.busy.set(false),
    });
  }
}
