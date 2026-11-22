import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService } from '@shared/core/i18n.service';
import { OrderEmailTemplates } from '@shared/core/models';
import { OrdersApiService } from '@shared/core/orders-api.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';

import { IntroComponent } from './intro.component';
const STATUSES = ['Confirmed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
const LANGS = ['en', 'ar'];

// The e-mails the customer gets when an order reaches a status: on/off and the words, in both languages.
// They are sent from the Orders page when the administrator saves a new status.
@Component({
  selector: 'app-order-emails-admin',
  standalone: true,
  imports: [IntroComponent, FormsModule, TranslatePipe],
  templateUrl: './order-emails-admin.component.html',
})
export class OrderEmailsAdminComponent implements OnInit {
  private readonly api = inject(OrdersApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  // Kept in the class: curly braces cannot be written directly in an Angular template
  readonly placeholders = '{customer} · {order} · {items} · {total} · {days} · {note}';
  readonly statuses = STATUSES;
  readonly langs = LANGS;
  readonly data = signal<OrderEmailTemplates | null>(null);
  readonly saving = signal(false);

  ngOnInit(): void {
    this.api.getEmailTemplates().subscribe((d) => {
      // Every status and language has a text box to bind to
      for (const s of STATUSES) {
        const t = (d.templates[s] ??= { enabled: false, subject: {}, body: {} });
        for (const l of LANGS) {
          t.subject[l] ??= '';
          t.body[l] ??= '';
        }
      }

      this.data.set(d);
    });
  }

  save(): void {
    const d = this.data();
    if (!d) return;

    this.saving.set(true);
    this.api.saveEmailTemplates(d).subscribe({
      next: () => { this.saving.set(false); this.toast.success(this.i18n.t('inv.saved')); },
      error: () => this.saving.set(false),
    });
  }
}
