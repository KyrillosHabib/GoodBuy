import { Component, OnInit, inject, signal } from '@angular/core';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { AdminApiService } from '@shared/core/admin-api.service';
import { I18nService } from '@shared/core/i18n.service';
import { ReviewAdmin } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';

import { IntroComponent } from './intro.component';
// Customers' reviews of the products: approve (shown on the website), hide, answer, delete
@Component({
  selector: 'app-reviews-admin',
  standalone: true,
  imports: [IntroComponent, TranslatePipe, DataTableComponent],
  templateUrl: './reviews-admin.component.html',
})
export class ReviewsAdminComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly items = signal<ReviewAdmin[]>([]);

  readonly columns: DtColumn[] = [
    { key: 'product', label: 'review.admin.product', value: (r: ReviewAdmin) => `${r.productName} ${r.name}` },
    { key: 'rating', label: 'review.admin.rating', value: (r: ReviewAdmin) => r.rating, type: 'number', filter: 'none', width: '110px' },
    { key: 'comment', label: 'review.admin.comment', value: (r: ReviewAdmin) => r.comment, filter: 'none' },
    { key: 'status', label: 'inv.status', value: (r: ReviewAdmin) => (r.isApproved ? 'shown' : 'waiting'), filter: 'select', optionLabel: (v: string) => this.i18n.t('review.admin.' + v), width: '130px' },
    { key: 'actions', label: '', width: '300px' },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getReviews().subscribe((r) => this.items.set(r));
  }

  act(r: ReviewAdmin, action: 'approve' | 'hide'): void {
    this.api.moderateReview(r.id, action).subscribe(() => { this.toast.success(this.i18n.t('inv.saved')); this.load(); });
  }

  reply(r: ReviewAdmin): void {
    const text = prompt(this.i18n.t('review.admin.replyPrompt'), r.reply ?? '');

    if (text === null) return;

    this.api.moderateReview(r.id, 'reply', text).subscribe(() => { this.toast.success(this.i18n.t('inv.saved')); this.load(); });
  }

  remove(r: ReviewAdmin): void {
    if (!confirm(this.i18n.t('inv.confirmDelete'))) return;

    this.api.moderateReview(r.id, 'delete').subscribe(() => this.load());
  }
}
