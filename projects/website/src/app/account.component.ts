import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AccountApiService } from '@shared/core/account-api.service';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { Address, CustomerProfile, Order } from '@shared/core/models';
import { OrdersApiService } from '@shared/core/orders-api.service';
import { MoneyPipe } from './money.pipe';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { emptyToNull } from '@shared/core/translation-forms';
import { PASSWORD_PATTERN, PHONE_PATTERN, sameAs } from './auth-shared';

type Tab = 'profile' | 'orders' | 'addresses' | 'password';

// "My account": details, saved addresses and password. (Orders and the cart come in the next steps.)
@Component({
  selector: 'app-account',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, TranslatePipe, MoneyPipe],
  templateUrl: './account.component.html',
})
export class AccountComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AccountApiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly ordersApi = inject(OrdersApiService);

  readonly tab = signal<Tab>('profile');
  readonly busy = signal(false);
  readonly profile = signal<CustomerProfile | null>(null);
  readonly addresses = signal<Address[]>([]);
  readonly orders = signal<Order[]>([]);
  // null = list, 'new' = adding, number = editing that address
  readonly editing = signal<null | 'new' | number>(null);

  readonly profileForm = this.fb.group({
    fullName: ['', Validators.required],
    phone: ['', Validators.pattern(PHONE_PATTERN)],
  });

  readonly passwordForm = this.fb.group(
    {
      current: ['', Validators.required],
      password: ['', [Validators.required, Validators.pattern(PASSWORD_PATTERN)]],
      confirm: ['', Validators.required],
    },
    { validators: sameAs('password', 'confirm') },
  );

  readonly addressForm = this.fb.group({
    label: [''],
    recipientName: ['', Validators.required],
    phone: ['', [Validators.required, Validators.pattern(PHONE_PATTERN)]],
    country: ['', Validators.required],
    city: ['', Validators.required],
    region: [''],
    line1: ['', Validators.required],
    line2: [''],
    postalCode: [''],
    isDefault: [false],
  });

  ngOnInit(): void {
    this.api.getMe().subscribe((p) => {
      this.profile.set(p);
      this.profileForm.patchValue({ fullName: p.fullName, phone: p.phone ?? '' });
    });
    this.loadAddresses();
    this.ordersApi.mine().subscribe((o) => this.orders.set(o));
  }

  logout(): void {
    this.auth.logout('/');
  }

  // ---------- profile ----------

  saveProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    const v = this.profileForm.getRawValue();

    this.busy.set(true);
    this.api.updateMe({ fullName: (v.fullName ?? '').trim(), phone: emptyToNull(v.phone), language: this.i18n.lang() }).subscribe({
      next: (p) => {
        this.busy.set(false);
        this.profile.set(p);
        this.toast.success(this.i18n.t('account.saved'));
      },
      error: () => this.busy.set(false),
    });
  }

  // ---------- password ----------

  savePassword(): void {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const v = this.passwordForm.getRawValue();

    this.busy.set(true);
    this.api.changePassword(v.current ?? '', v.password ?? '').subscribe({
      next: () => {
        this.busy.set(false);
        this.passwordForm.reset();
        this.toast.success(this.i18n.t('auth.passwordChanged'));
      },
      error: () => this.busy.set(false),
    });
  }

  // ---------- addresses ----------

  bad(control: keyof AccountComponent['addressForm']['controls']): boolean {
    const c = this.addressForm.controls[control];
    return c.touched && c.invalid;
  }

  private loadAddresses(): void {
    this.api.getAddresses().subscribe((list) => this.addresses.set(list));
  }

  addNew(): void {
    this.addressForm.reset({ isDefault: this.addresses().length === 0, recipientName: this.profile()?.fullName ?? '', phone: this.profile()?.phone ?? '' });
    this.editing.set('new');
  }

  edit(a: Address): void {
    this.addressForm.reset({ ...a, label: a.label ?? '', region: a.region ?? '', line2: a.line2 ?? '', postalCode: a.postalCode ?? '' });
    this.editing.set(a.id);
  }

  saveAddress(): void {
    if (this.addressForm.invalid) {
      this.addressForm.markAllAsTouched();
      return;
    }

    const v = this.addressForm.getRawValue();
    const body = {
      label: emptyToNull(v.label),
      recipientName: (v.recipientName ?? '').trim(),
      phone: (v.phone ?? '').trim(),
      country: (v.country ?? '').trim(),
      city: (v.city ?? '').trim(),
      region: emptyToNull(v.region),
      line1: (v.line1 ?? '').trim(),
      line2: emptyToNull(v.line2),
      postalCode: emptyToNull(v.postalCode),
      isDefault: !!v.isDefault,
    };
    const id = this.editing();
    const request = typeof id === 'number' ? this.api.updateAddress(id, body) : this.api.createAddress(body);

    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.editing.set(null);
        this.loadAddresses();
        this.toast.success(this.i18n.t('account.saved'));
      },
      error: () => this.busy.set(false),
    });
  }

  makeDefault(a: Address): void {
    this.api.setDefaultAddress(a.id).subscribe(() => this.loadAddresses());
  }

  remove(a: Address): void {
    if (!confirm(this.i18n.t('account.confirmDelete'))) return;

    this.api.deleteAddress(a.id).subscribe(() => this.loadAddresses());
  }
}
