import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AdminApiService } from '@shared/core/admin-api.service';
import { I18nService } from '@shared/core/i18n.service';
import { ReturnPolicy } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';

import { IntroComponent } from './intro.component';
// The returns and exchange policy: the rules are chosen here and the website writes its policy page from them
@Component({
  selector: 'app-return-policy-admin',
  standalone: true,
  imports: [IntroComponent, FormsModule, TranslatePipe],
  templateUrl: './return-policy-admin.component.html',
})
export class ReturnPolicyAdminComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly policy = signal<ReturnPolicy | null>(null);
  readonly saving = signal(false);

  ngOnInit(): void {
    this.api.getReturnPolicy().subscribe((p) => {
      p.conditions ??= {};
      p.conditions['en'] ??= '';
      p.conditions['ar'] ??= '';
      this.policy.set(p);
    });
  }

  save(): void {
    const p = this.policy();
    if (!p) return;

    this.saving.set(true);
    this.api.saveReturnPolicy({ ...p, returnWindowDays: Number(p.returnWindowDays) || 0, exchangeWindowDays: Number(p.exchangeWindowDays) || 0 }).subscribe({
      next: () => { this.saving.set(false); this.toast.success(this.i18n.t('inv.saved')); },
      error: () => this.saving.set(false),
    });
  }
}
