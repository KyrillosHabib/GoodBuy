import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable } from 'rxjs';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { ModalComponent } from '@shared/components/modal.component';
import { I18nService } from '@shared/core/i18n.service';
import { InventoryApiService } from '@shared/core/inventory-api.service';
import { Supplier } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { emptyToNull } from '@shared/core/translation-forms';

@Component({
  selector: 'app-suppliers-admin',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, DataTableComponent, ModalComponent],
  templateUrl: './suppliers-admin.component.html',
})
export class SuppliersAdminComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(InventoryApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly suppliers = signal<Supplier[]>([]);
  readonly open = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<Supplier | null>(null);

  readonly columns: DtColumn[] = [
    { key: 'name', label: 'a.name', value: (s: Supplier) => s.name },
    { key: 'phone', label: 'contact.phone', value: (s: Supplier) => s.phone },
    { key: 'email', label: 'contact.email', value: (s: Supplier) => s.email },
    { key: 'active', label: 'a.active', value: (s: Supplier) => s.isActive, type: 'bool', width: '100px' },
    { key: 'actions', label: '', width: '170px' },
  ];

  readonly form = this.fb.group({
    name: [''],
    nameAr: ['', Validators.required],
    phone: [''],
    email: ['', Validators.email],
    address: [''],
    notes: [''],
    isActive: [true],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getSuppliers().subscribe((s) => this.suppliers.set(s));
  }

  startEdit(s: Supplier | null): void {
    this.editing.set(s);
    // When no English name was typed, the stored English name is a copy of the Arabic one: show it empty
    this.form.reset({ name: s && s.nameEn !== s.nameAr ? s.nameEn : '', nameAr: s?.nameAr ?? s?.nameEn ?? '', phone: s?.phone ?? '', email: s?.email ?? '', address: s?.address ?? '', notes: s?.notes ?? '', isActive: s?.isActive ?? true });
    this.open.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const v = this.form.getRawValue();
    const body = { name: (v.name ?? '').trim(), nameAr: emptyToNull(v.nameAr), phone: emptyToNull(v.phone), email: emptyToNull(v.email), address: emptyToNull(v.address), notes: emptyToNull(v.notes), isActive: !!v.isActive };
    const e = this.editing();

    this.saving.set(true);
    const request: Observable<unknown> = e ? this.api.updateSupplier(e.id, body) : this.api.createSupplier(body);

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

  remove(s: Supplier): void {
    if (!confirm(this.i18n.t('inv.confirmDelete'))) return;
    this.api.deleteSupplier(s.id).subscribe(() => this.load());
  }
}
