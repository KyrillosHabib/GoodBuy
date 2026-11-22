import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AccountApiService } from '@shared/core/account-api.service';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { Countdown, PASSWORD_PATTERN, sameAs } from './auth-shared';

// Two steps on one page: 1) e-mail -> a code is sent   2) code + new password
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './forgot-password.component.html',
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AccountApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly timer = new Countdown();
  readonly step = signal<1 | 2>(1);
  readonly loading = signal(false);
  readonly email = signal('');

  readonly emailForm = this.fb.group({
    email: [this.route.snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email]],
  });

  readonly resetForm = this.fb.group(
    {
      code: ['', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]],
      password: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN)]],
      confirm: ['', Validators.required],
    },
    { validators: sameAs('password', 'confirm') },
  );

  sendCode(): void {
    if (this.emailForm.invalid) {
      this.emailForm.markAllAsTouched();
      return;
    }

    const email = (this.emailForm.getRawValue().email ?? '').trim();

    this.loading.set(true);
    this.api.forgotPassword(email).subscribe({
      next: (info) => {
        this.loading.set(false);
        this.email.set(email);
        this.step.set(2);
        this.timer.start(info.resendAfterSeconds);
        // Same message whether or not the e-mail has an account
        this.toast.info(this.i18n.t('auth.codeSentIfExists'));
      },
      error: () => this.loading.set(false),
    });
  }

  resend(event: Event): void {
    event.preventDefault();

    this.api.resendOtp(this.email(), 'reset').subscribe({
      next: (info) => {
        this.timer.start(info.resendAfterSeconds);
        this.toast.info(this.i18n.t('auth.codeSentIfExists'));
      },
    });
  }

  reset(): void {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    const v = this.resetForm.getRawValue();

    this.loading.set(true);
    this.api.resetPassword(this.email(), v.code ?? '', v.password ?? '').subscribe({
      next: () => {
        this.loading.set(false);
        this.toast.success(this.i18n.t('auth.passwordChanged'));
        void this.router.navigate(['/login'], { queryParams: { email: this.email() } });
      },
      error: () => this.loading.set(false),
    });
  }
}
