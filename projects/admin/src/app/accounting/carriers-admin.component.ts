import { Component, OnInit, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { ModalComponent } from '@shared/components/modal.component';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { Carrier } from '@shared/core/accounting.models';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { emptyToNull } from '@shared/core/translation-forms';

import { IntroComponent } from '../intro.component';
function rateGroup(fb: FormBuilder, v?: { zone: string | null; fixedFee: number; percentFee: number }) {
  return fb.group({
    zone: [v?.zone ?? ''],
    fixedFee: [v?.fixedFee ?? 0, [Validators.min(0)]],
    percentFee: [v?.percentFee ?? 0, [Validators.min(0), Validators.max(100)]],
  });
}
type RateGroup = ReturnType<typeof rateGroup>;

// The shipping companies that deliver the orders and collect the cash on delivery, and what each one keeps from that cash
@Component({
  selector: 'app-carriers-admin',
  standalone: true,
  imports: [IntroComponent, ReactiveFormsModule, DecimalPipe, TranslatePipe, DataTableComponent, ModalComponent],
  templateUrl: './carriers-admin.component.html',
})
export class CarriersAdminComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AccountingApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);
  private readonly auth = inject(AuthService);

  readonly canEdit = this.auth.can('accounting.settings', 'accounting.treasury');
  readonly carriers = signal<Carrier[]>([]);
  readonly open = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<Carrier | null>(null);

  readonly columns: DtColumn[] = [
    { key: 'name', label: 'a.name', value: (c: Carrier) => c.name },
    { key: 'rates', label: 'acc.car.rates', value: (c: Carrier) => c.rates.length, type: 'number', filter: 'none' },
    { key: 'active', label: 'a.active', value: (c: Carrier) => c.isActive, type: 'bool', width: '100px' },
    { key: 'actions', label: '', width: '100px' },
  ];

  readonly rates = new FormArray<RateGroup>([]);
  readonly form = this.fb.group({ name: [''], nameAr: ['', Validators.required], notes: [''], isActive: [true], rates: this.rates });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getCarriers().subscribe((c) => this.carriers.set(c));
  }

  newRate(): RateGroup {
    return rateGroup(this.fb);
  }

  startEdit(c: Carrier | null): void {
    this.editing.set(c);
    this.form.reset({ name: c && c.nameEn !== c.nameAr ? c.nameEn : '', nameAr: c?.nameAr ?? c?.nameEn ?? '', notes: c?.notes ?? '', isActive: c?.isActive ?? true });
    this.rates.clear();
    if (c) for (const r of c.rates) this.rates.push(rateGroup(this.fb, r));
    else this.rates.push(rateGroup(this.fb));
    this.open.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const body = {
      name: emptyToNull(v.name), nameAr: emptyToNull(v.nameAr), isActive: !!v.isActive, notes: emptyToNull(v.notes),
      rates: v.rates.map((r) => ({ zone: emptyToNull(r.zone), fixedFee: Number(r.fixedFee) || 0, percentFee: Number(r.percentFee) || 0 })),
    };
    const e = this.editing();

    this.saving.set(true);
    const request: Observable<unknown> = e ? this.api.updateCarrier(e.id, body) : this.api.createCarrier(body);

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.open.set(false);
        this.toast.success(this.i18n.t('inv.saved'));
        this.load();
      },
      error: () => this.saving.set(false),
    });
  }
}
