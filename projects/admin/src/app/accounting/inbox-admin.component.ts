import { Component, OnInit, inject, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { AccountingDashboard, PostingIssue } from '@shared/core/accounting.models';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';

import { IntroComponent } from '../intro.component';
// Everything that needs a person: what the system could not book, decisions it cannot take alone, and what waits for approval
@Component({
  selector: 'app-inbox-admin',
  standalone: true,
  imports: [IntroComponent, RouterLink, SlicePipe, TranslatePipe],
  templateUrl: './inbox-admin.component.html',
})
export class InboxAdminComponent implements OnInit {
  private readonly api = inject(AccountingApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly issues = signal<PostingIssue[]>([]);
  readonly dash = signal<AccountingDashboard['pending'] | null>(null);
  readonly resolved = signal(false);
  readonly busy = signal(false);

  ngOnInit(): void {
    this.load();
    this.api.getPending().subscribe((p) => this.dash.set(p));
  }

  load(): void {
    this.api.getIssues(this.resolved()).subscribe((r) => this.issues.set(r));
  }

  setResolved(v: boolean): void {
    this.resolved.set(v);
    this.load();
  }

  // The entries the system can make again once the cause (a missing account, a closed period) was fixed
  retryable(i: PostingIssue): boolean {
    return i.eventKey === 'order-delivered' || i.eventKey === 'order-paid' || i.eventKey === 'po-received';
  }

  retry(i: PostingIssue): void {
    this.busy.set(true);
    this.api.retryIssue(i.id).subscribe({
      next: (ok) => {
        this.busy.set(false);
        ok ? this.toast.success(this.i18n.t('acc.inbox.fixed')) : this.toast.error(this.i18n.t('acc.inbox.stillFailing'));
        this.load();
      },
      error: () => this.busy.set(false),
    });
  }

  resolve(i: PostingIssue): void {
    this.busy.set(true);
    this.api.resolveIssue(i.id).subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: () => this.busy.set(false),
    });
  }
}
