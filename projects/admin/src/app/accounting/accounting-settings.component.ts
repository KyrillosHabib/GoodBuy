import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { AccountingContext } from '@shared/core/accounting-context.service';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';

import { IntroComponent } from '../intro.component';
// Who may approve, which period is closed, the credit limits and the VAT rate
@Component({
  selector: 'app-accounting-settings',
  standalone: true,
  imports: [IntroComponent, ReactiveFormsModule, TranslatePipe],
  templateUrl: './accounting-settings.component.html',
})
export class AccountingSettingsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AccountingApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);
  readonly ctx = inject(AccountingContext);

  readonly canEdit = this.auth.can('accounting.settings');
  readonly saving = signal(false);

  readonly form = this.fb.group({
    lockedUntil: [''],
    allowSelfApproval: [false],
    enforceCreditLimit: [true],
    defaultTaxRate: [14, [Validators.min(0), Validators.max(100)]],
  });

  ngOnInit(): void {
    this.api.getSettings().subscribe((s) => {
      this.ctx.settings.set(s);
      this.form.reset({ lockedUntil: s.lockedUntil?.slice(0, 10) ?? '', allowSelfApproval: s.allowSelfApproval, enforceCreditLimit: s.enforceCreditLimit, defaultTaxRate: s.defaultTaxRate });
      if (!this.canEdit) this.form.disable();
    });
  }

  save(): void {
    const current = this.ctx.settings();
    if (this.form.invalid || !current) return;
    const v = this.form.getRawValue();

    this.saving.set(true);
    // The rules of the automatic posting live on another screen: they are sent back unchanged
    this.api
      .saveSettings({
        ...current,
        lockedUntil: v.lockedUntil || null, allowSelfApproval: !!v.allowSelfApproval, enforceCreditLimit: !!v.enforceCreditLimit, defaultTaxRate: Number(v.defaultTaxRate) || 0,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success(this.i18n.t('inv.saved'));
          this.ctx.load(true);
        },
        error: () => this.saving.set(false),
      });
  }
}
