import { HttpErrorResponse } from '@angular/common/http';
import { Component, HostListener, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AccountApiService } from '@shared/core/account-api.service';
import { AuthService } from '@shared/core/auth.service';
import { TranslatePipe } from '@shared/core/pipes';
import { emptyToNull } from '@shared/core/translation-forms';
import { PASSWORD_PATTERN, PHONE_PATTERN, sameAs } from './auth-shared';
import { AuthDrawerService } from './auth-drawer.service';

@Component({
  selector: 'app-auth-drawer',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './auth-drawer.component.html',
})
export class AuthDrawerComponent {
  readonly drawer = inject(AuthDrawerService);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly api = inject(AccountApiService);
  private readonly router = inject(Router);

  readonly loading = signal(false);

  readonly loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  readonly registerForm = this.fb.group(
    {
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.pattern(PHONE_PATTERN)],
      password: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN)]],
      confirm: ['', Validators.required],
    },
    { validators: sameAs('password', 'confirm') },
  );

  constructor() {
    // The e-mail typed before (e.g. on the forgot-password page) is put in the box when the drawer opens
    effect(() => {
      if (this.drawer.isOpen() && this.drawer.prefillEmail) this.loginForm.patchValue({ email: this.drawer.prefillEmail });
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.drawer.close();
  }

  bad(form: { controls: Record<string, { touched: boolean; invalid: boolean }> }, name: string): boolean {
    const c = form.controls[name];

    return c.touched && c.invalid;
  }

  login(): void {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { email, password } = this.loginForm.getRawValue();

    this.loading.set(true);
    this.auth.login(email ?? '', password ?? '').subscribe({
      next: (session) => {
        this.loading.set(false);

        // This drawer is for shoppers; the dashboard is a separate app
        if (!session.roles.includes('Customer')) {
          this.auth.logout('/');
          return;
        }

        this.loginForm.reset();
        this.drawer.close();

        const back = this.drawer.returnUrl;

        if (back && back.startsWith('/') && !back.startsWith('//')) void this.router.navigateByUrl(back);
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);

        // Right password but the e-mail was never confirmed: a new code is sent and the code page opens
        if (e.status === 403 && e.error?.code === 'email_not_verified') {
          this.drawer.close();
          void this.router.navigate(['/verify-email'], { queryParams: { email, resend: 1 } });
        }
      },
    });
  }

  register(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const v = this.registerForm.getRawValue();

    this.loading.set(true);
    this.api.register({ email: v.email ?? '', password: v.password ?? '', fullName: v.fullName ?? '', phone: emptyToNull(v.phone) }).subscribe({
      next: (info) => {
        this.loading.set(false);
        this.drawer.close();
        // The code that was e-mailed is typed on its own page
        void this.router.navigate(['/verify-email'], {
          queryParams: { email: info.email ?? v.email, wait: info.resendAfterSeconds, returnUrl: this.drawer.returnUrl },
        });
      },
      error: () => this.loading.set(false),
    });
  }

  forgot(): void {
    const email = this.loginForm.value.email || null;

    this.drawer.close();
    void this.router.navigate(['/forgot-password'], { queryParams: { email } });
  }
}
