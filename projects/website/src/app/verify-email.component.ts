import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AccountApiService } from '@shared/core/account-api.service';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { Countdown } from './auth-shared';

// Step 2 of sign-up: the 6-digit code that was e-mailed to the customer
@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './verify-email.component.html',
})
export class VerifyEmailComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AccountApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly timer = new Countdown();
  readonly loading = signal(false);
  readonly email = this.route.snapshot.queryParamMap.get('email') ?? '';

  readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.pattern(/^[0-9]{6}$/)]],
  });

  ngOnInit(): void {
    if (!this.email) {
      void this.router.navigate(['/register']);
      return;
    }

    const q = this.route.snapshot.queryParamMap;

    // Coming from the login page (right password, e-mail not confirmed yet): send a fresh code
    if (q.get('resend')) {
      this.sendCode();
    } else {
      this.timer.start(Number(q.get('wait')) || 60);
    }
  }

  // Digits only; sends itself when the 6th digit is typed
  onType(): void {
    const digits = (this.form.controls.code.value ?? '').replace(/\D/g, '').slice(0, 6);

    this.form.controls.code.setValue(digits, { emitEvent: false });

    if (digits.length === 6 && !this.loading()) this.submit();
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.api.verifyEmail(this.email, this.form.getRawValue().code ?? '').subscribe({
      next: (session) => {
        this.loading.set(false);
        this.auth.setSession(session);
        this.toast.success(this.i18n.t('auth.verified'));

        const back = this.route.snapshot.queryParamMap.get('returnUrl');

        void this.router.navigateByUrl(back && back.startsWith('/') && !back.startsWith('//') ? back : '/account');
      },
      error: () => {
        this.loading.set(false);
        this.form.controls.code.reset('');
      },
    });
  }

  resend(event: Event): void {
    event.preventDefault();
    this.sendCode();
  }

  private sendCode(): void {
    this.api.resendOtp(this.email, 'verify').subscribe({
      next: (info) => {
        this.timer.start(info.resendAfterSeconds);
        this.toast.info(this.i18n.t('auth.codeSent'));
      },
    });
  }
}
