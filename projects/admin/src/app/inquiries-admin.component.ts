import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApiService } from '@shared/core/admin-api.service';
import { I18nService } from '@shared/core/i18n.service';
import { INQUIRY_STATUSES, Inquiry, InquiryStatus, PagedResult } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { parseUtc } from '@shared/core/utc';
import { PagerComponent } from '@shared/components/pager.component';

@Component({
  selector: 'app-inquiries-admin',
  standalone: true,
  imports: [ReactiveFormsModule, DatePipe, TranslatePipe, PagerComponent],
  templateUrl: './inquiries-admin.component.html',
})
export class InquiriesAdminComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly statuses = INQUIRY_STATUSES;

  readonly result = signal<PagedResult<Inquiry> | null>(null);
  readonly selected = signal<Inquiry | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly replyOpen = signal(false);
  readonly replying = signal(false);

  private status: InquiryStatus | '' = '';
  private page = 1;

  readonly replyForm = this.fb.nonNullable.group({
    subject: ['', Validators.required],
    message: ['', Validators.required],
  });

  readonly form = this.fb.group({
    status: ['New' as InquiryStatus],
    adminNote: [''],
  });

  ngOnInit(): void {
    this.load();
  }

  date(value: string): Date {
    return parseUtc(value);
  }

  setFilter(value: string): void {
    this.status = value as InquiryStatus | '';
    this.page = 1;
    this.load();
  }

  goTo(page: number): void {
    this.page = page;
    this.load();
  }

  open(id: number): void {
    this.api.getInquiry(id).subscribe((inquiry) => {
      this.selected.set(inquiry);
      this.replyOpen.set(false);
      this.form.reset({ status: inquiry.status, adminNote: inquiry.adminNote ?? '' });

      // The server marked it as "Read": reflect it in the list
      this.result.update((r) =>
        r ? { ...r, items: r.items.map((x) => (x.id === inquiry.id ? { ...x, status: inquiry.status } : x)) } : r,
      );
    });
  }

  startReply(inquiry: Inquiry): void {
    const subject = this.i18n.t('a.inq.replySubjectDefault', { name: inquiry.name });

    this.replyForm.reset({ subject, message: `${this.i18n.t('a.inq.replyGreeting', { name: inquiry.name })}\n\n` });
    this.replyOpen.set(true);
  }

  sendReply(inquiry: Inquiry): void {
    if (this.replyForm.invalid) return;

    const { subject, message } = this.replyForm.getRawValue();

    this.replying.set(true);
    this.api.replyInquiry(inquiry.id, subject.trim(), message.trim()).subscribe({
      next: () => {
        this.replying.set(false);
        this.replyOpen.set(false);
        this.toast.success(this.i18n.t('a.inq.replySent'));
        this.open(inquiry.id);
      },
      error: () => this.replying.set(false),
    });
  }

  save(): void {
    const inquiry = this.selected();
    if (!inquiry) return;

    const v = this.form.getRawValue();
    const status = (v.status ?? 'New') as InquiryStatus;
    const note = (v.adminNote ?? '').trim() || null;

    this.saving.set(true);
    this.api.updateInquiryStatus(inquiry.id, status, note).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success(this.i18n.t('a.inq.updated'));
        this.selected.set({ ...inquiry, status, adminNote: note });
        this.result.update((r) =>
          r ? { ...r, items: r.items.map((x) => (x.id === inquiry.id ? { ...x, status } : x)) } : r,
        );
      },
      error: () => this.saving.set(false),
    });
  }

  remove(inquiry: Inquiry): void {
    if (!confirm(this.i18n.t('a.inq.confirmDelete'))) return;

    this.api.deleteInquiry(inquiry.id).subscribe(() => {
      this.toast.success(this.i18n.t('a.inq.deleted'));
      this.selected.set(null);
      this.load();
    });
  }

  private load(): void {
    this.loading.set(true);

    this.api.getInquiries({ status: this.status, page: this.page, pageSize: 10 }).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
