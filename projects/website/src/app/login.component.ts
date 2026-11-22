import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '@shared/core/auth.service';
import { TranslatePipe } from '@shared/core/pipes';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

  readonly form = this.fb.group({
    email: [this.route.snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  invalid(control: 'email' | 'password'): boolean {
    const c = this.form.controls[control];
    return c.touched && c.invalid;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();

    this.loading.set(true);
    this.auth.login(email ?? '', password ?? '').subscribe({
      next: (session) => {
        this.loading.set(false);

        // This page is for shoppers; the dashboard is a separate app
        if (!session.roles.includes('Customer')) {
          this.auth.logout('/login');
          return;
        }

        void this.router.navigateByUrl(this.safeReturnUrl());
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);

        // Right password but the e-mail was never confirmed: send a new code and go to the code page
        if (e.status === 403 && e.error?.code === 'email_not_verified') {
          void this.router.navigate(['/verify-email'], { queryParams: { email, resend: 1 } });
        }
      },
    });
  }

  // Only in-app paths, never another site
  private safeReturnUrl(): string {
    return this.returnUrl && this.returnUrl.startsWith('/') && !this.returnUrl.startsWith('//') ? this.returnUrl : '/account';
  }
}
