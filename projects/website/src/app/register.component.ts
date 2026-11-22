import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@shared/core/pipes';
import { AccountApiService } from '@shared/core/account-api.service';
import { emptyToNull } from '@shared/core/translation-forms';
import { PASSWORD_PATTERN, PHONE_PATTERN, sameAs } from './auth-shared';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AccountApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly loading = signal(false);
  readonly returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');

  readonly form = this.fb.group(
    {
      fullName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.pattern(PHONE_PATTERN)],
      password: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN)]],
      confirm: ['', Validators.required],
    },
    { validators: sameAs('password', 'confirm') },
  );

  invalid(control: 'fullName' | 'email' | 'phone' | 'password'): boolean {
    const c = this.form.controls[control];
    return c.touched && c.invalid;
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();

    this.loading.set(true);
    this.api
      .register({ email: v.email ?? '', password: v.password ?? '', fullName: v.fullName ?? '', phone: emptyToNull(v.phone) })
      .subscribe({
        next: (info) => {
          this.loading.set(false);
          void this.router.navigate(['/verify-email'], {
            queryParams: { email: info.email ?? v.email, wait: info.resendAfterSeconds, returnUrl: this.returnUrl },
          });
        },
        error: () => this.loading.set(false),
      });
  }
}
