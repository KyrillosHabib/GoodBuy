import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IconComponent } from '@shared/components/icon.component';
import { environment } from '@shared/environments/environment';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { PublicApiService } from '@shared/core/public-api.service';
import { AssetUrlPipe, TranslatePipe } from '@shared/core/pipes';
import { applyTheme } from '@shared/core/theme';
import { Home } from '@shared/core/models';
import { ToastService } from '@shared/core/toast.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, AssetUrlPipe, IconComponent],
  templateUrl: './admin-login.component.html',
})
export class AdminLoginComponent implements OnInit {
  private readonly publicApi = inject(PublicApiService);
  readonly home = signal<Home | null>(null);

  private readonly fb = inject(FormBuilder);
  readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly i18n = inject(I18nService);

  readonly isProduction = environment.production;
  readonly loading = signal(false);

  readonly form = this.fb.nonNullable.group({
    email: [environment.production ? '' : 'admin@voltara.com', [Validators.required]],
    password: [environment.production ? '' : 'Admin@12345', Validators.required],
  });

  // The "choose your own password" step of an employee who signed in with the password the administrator gave
  readonly changeForm = this.fb.nonNullable.group({
    currentPassword: ['', Validators.required],
    newPassword: ['', [Validators.required, Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/)]],
    confirm: ['', Validators.required],
  });

  ngOnInit(): void {
    // The sign-in page already wears the website's colors, fonts, logo and favicon
    this.publicApi.getHome().subscribe({
      next: (h) => {
        this.home.set(h);
        applyTheme(h.settings);
      },
      error: () => undefined,
    });
  }

  changePassword(): void {
    const { currentPassword, newPassword, confirm } = this.changeForm.getRawValue();

    if (this.changeForm.invalid) {
      this.changeForm.markAllAsTouched();
      return;
    }

    if (newPassword !== confirm) {
      this.toast.error(this.i18n.t('a.pwd.mismatch'));
      return;
    }

    this.loading.set(true);
    this.auth.changeOwnPassword(currentPassword, newPassword).subscribe({
      next: () => {
        this.loading.set(false);
        this.toast.success(this.i18n.t('a.pwd.changed'));
        this.changeForm.reset();
        // The old session carries the "must change" mark: close it and sign in again with the new password
        this.auth.logout();
      },
      error: () => this.loading.set(false),
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { email, password } = this.form.getRawValue();

    this.loading.set(true);
    this.auth.login(email, password).subscribe({
      next: () => {
        this.loading.set(false);

        if (this.auth.mustChangePassword()) {
          // The temporary password they just typed is the "current" one of the next step
          this.changeForm.patchValue({ currentPassword: password });
        } else if (this.auth.canUseDashboard()) {
          void this.router.navigate(['/']);
        } else {
          this.toast.error(this.i18n.t('a.login.notAdmin'));
        }
      },
      error: () => this.loading.set(false),
    });
  }
}
