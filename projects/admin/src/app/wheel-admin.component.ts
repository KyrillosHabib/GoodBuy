import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { ModalComponent } from '@shared/components/modal.component';
import { AdminApiService } from '@shared/core/admin-api.service';
import { I18nService } from '@shared/core/i18n.service';
import { WheelCampaign, WheelCampaignInput, WheelPrizeKind, WheelSliceInput } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { ToastService } from '@shared/core/toast.service';
import { Observable } from 'rxjs';
import { fromLocalInput, toLocalInput } from './discounts-admin.component';

import { IntroComponent } from './intro.component';
const COLORS = ['#2563eb', '#f97316', '#16a34a', '#db2777', '#7c3aed', '#eab308', '#0891b2', '#dc2626'];

// Wheel of fortune campaigns. The slices, their chances (they must add up to 100%), who sees the wheel, when, how many spins, and the results.
// The wheel on the website only draws: the winner is drawn by the server with these chances.
@Component({
  selector: 'app-wheel-admin',
  standalone: true,
  imports: [IntroComponent, FormsModule, TranslatePipe, DataTableComponent, ModalComponent],
  templateUrl: './wheel-admin.component.html',
})
export class WheelAdminComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly items = signal<WheelCampaign[]>([]);
  readonly open = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<WheelCampaign | null>(null);

  f: WheelCampaignInput = this.blank();
  starts = '';
  ends = '';
  timing: 'now' | 'later' = 'now';

  readonly columns: DtColumn[] = [
    { key: 'name', label: 'disc.name', value: (c: WheelCampaign) => c.name },
    { key: 'status', label: 'inv.status', value: (c: WheelCampaign) => c.status, filter: 'select', optionLabel: (v: string) => this.i18n.t('disc.status.' + v), width: '110px' },
    { key: 'spins', label: 'wheel.admin.statSpins', value: (c: WheelCampaign) => c.stats.spins, type: 'number', filter: 'none', width: '100px' },
    { key: 'prizes', label: 'wheel.admin.statPrizes', value: (c: WheelCampaign) => c.stats.prizes, type: 'number', filter: 'none', width: '110px' },
    { key: 'used', label: 'wheel.admin.statUsed', value: (c: WheelCampaign) => c.stats.couponsUsed, type: 'number', filter: 'none', width: '130px' },
    { key: 'sales', label: 'wheel.admin.statSales', value: (c: WheelCampaign) => c.stats.sales, type: 'number', filter: 'none', width: '120px' },
    { key: 'actions', label: '', width: '170px' },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getWheelCampaigns().subscribe((c) => this.items.set(c));
  }

  private blank(): WheelCampaignInput {
    return {
      name: '', isActive: true, startsAtUtc: null, endsAtUtc: null, showDelaySeconds: 0, audience: 'AllVisitors', allowedEmails: null,
      maxSpinsPerVisitor: 1, maxSpinsPerIp: 3, couponValidityDays: 7, maxDiscountAmount: null, minOrderAmount: null, requireEmail: false, slices: [],
    };
  }

  private slice(label: string, labelAr: string, kind: WheelPrizeKind, value: number, probability: number, i: number): WheelSliceInput {
    return { label, labelAr, kind, value, probability, color: COLORS[i % COLORS.length] };
  }

  edit(c: WheelCampaign | null): void {
    this.editing.set(c);
    this.f = c
      ? { ...c, slices: c.slices.map((s) => ({ ...s })) }
      : this.blank();

    if (!c) this.example();

    this.starts = toLocalInput(this.f.startsAtUtc);
    this.ends = toLocalInput(this.f.endsAtUtc);
    this.timing = this.f.showDelaySeconds > 0 ? 'later' : 'now';
    this.open.set(true);
  }

  timingChanged(): void {
    this.f.showDelaySeconds = this.timing === 'now' ? 0 : Math.max(5, this.f.showDelaySeconds);
  }

  total(): number {
    return Math.round(this.f.slices.reduce((sum, s) => sum + (Number(s.probability) || 0), 0) * 100) / 100;
  }

  addSlice(): void {
    this.f.slices.push(this.slice('', '', 'Percent', 5, 0, this.f.slices.length));
  }

  // Every slice gets the same chance (the last one takes the rounding so the total is exactly 100)
  equalize(): void {
    const n = this.f.slices.length;

    if (n === 0) return;

    const each = Math.floor((10000 / n)) / 100;
    this.f.slices.forEach((s) => (s.probability = each));
    this.f.slices[n - 1].probability = Math.round((100 - each * (n - 1)) * 100) / 100;
  }

  example(): void {
    this.f.slices = [
      this.slice('5% off', 'خصم 5%', 'Percent', 5, 30, 0),
      this.slice('10% off', 'خصم 10%', 'Percent', 10, 20, 1),
      this.slice('Free shipping', 'شحن مجاني', 'FreeShipping', 0, 15, 2),
      this.slice('15% off', 'خصم 15%', 'Percent', 15, 5, 3),
      this.slice('Try again', 'حاول مرة أخرى', 'NoPrize', 0, 30, 4),
    ];
  }

  save(): void {
    const f = this.f;
    const num = (v: number | null) => (v === null || (v as unknown) === '' ? null : Number(v));

    if (!f.name.trim() || f.slices.length < 2 || f.slices.some((s) => !s.label.trim())) {
      this.toast.error(this.i18n.t('inv.fixFields'));
      return;
    }

    if (this.total() !== 100) {
      this.toast.error(this.i18n.t('wheel.admin.totalError', { n: this.total() }));
      return;
    }

    const body: WheelCampaignInput = {
      ...f,
      name: f.name.trim(),
      showDelaySeconds: this.timing === 'now' ? 0 : Number(f.showDelaySeconds) || 5,
      maxSpinsPerVisitor: Number(f.maxSpinsPerVisitor) || 1,
      maxSpinsPerIp: Number(f.maxSpinsPerIp) || 1,
      couponValidityDays: Number(f.couponValidityDays) || 7,
      maxDiscountAmount: num(f.maxDiscountAmount),
      minOrderAmount: num(f.minOrderAmount),
      allowedEmails: f.audience === 'SpecificCustomers' ? (f.allowedEmails ?? '').trim() : null,
      startsAtUtc: fromLocalInput(this.starts),
      endsAtUtc: fromLocalInput(this.ends),
      slices: f.slices.map((s) => ({
        ...s,
        label: s.label.trim(),
        labelAr: s.labelAr?.trim() || null,
        value: s.kind === 'Percent' || s.kind === 'FixedAmount' ? Number(s.value) || 0 : 0,
        probability: Number(s.probability) || 0,
      })),
    };
    const e = this.editing();
    const request: Observable<unknown> = e ? this.api.updateWheelCampaign(e.id, body) : this.api.createWheelCampaign(body);

    this.saving.set(true);
    request.subscribe({
      next: () => { this.saving.set(false); this.open.set(false); this.toast.success(this.i18n.t('inv.saved')); this.load(); },
      error: () => this.saving.set(false),
    });
  }

  remove(c: WheelCampaign): void {
    if (!confirm(this.i18n.t('inv.confirmDelete'))) return;

    this.api.deleteWheelCampaign(c.id).subscribe(() => this.load());
  }
}
