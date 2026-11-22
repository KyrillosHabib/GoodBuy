import { Component, OnInit, inject, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ImageFieldComponent } from '@shared/components/image-field.component';
import { DataTableComponent, DtColumn } from '@shared/components/data-table.component';
import { ModalComponent } from '@shared/components/modal.component';
import { AdminApiService } from '@shared/core/admin-api.service';
import { I18nService } from '@shared/core/i18n.service';
import { AuctionAdmin, AuctionBidAdmin, AuctionInput, VariantPick } from '@shared/core/models';
import { ProductImagePipe, TranslatePipe } from '@shared/core/pipes';
import './auctions-admin.i18n';
import { ToastService } from '@shared/core/toast.service';
import { Observable } from 'rxjs';
import { fromLocalInput, toLocalInput } from './discounts-admin.component';
import { VariantPickerComponent } from './variant-picker.component';

import { IntroComponent } from './intro.component';
// Auctions on items and packages: opening price, the smallest raise allowed, the lowest price the owner accepts,
// the end time. The highest bid and the winner are shown here; the winner is also told by e-mail when the auction ends.
@Component({
  selector: 'app-auctions-admin',
  standalone: true,
  imports: [IntroComponent, FormsModule, ReactiveFormsModule, ImageFieldComponent, ProductImagePipe, TranslatePipe, DataTableComponent, ModalComponent, VariantPickerComponent],
  templateUrl: './auctions-admin.component.html',
})
export class AuctionsAdminComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly items = signal<AuctionAdmin[]>([]);
  readonly open = signal(false);
  readonly saving = signal(false);
  readonly editing = signal<AuctionAdmin | null>(null);
  // The items sold in this auction (one or several, each with how many units)
  readonly lot = signal<{ variantId: number; name: string; quantity: number }[]>([]);
  readonly imageCtl = new FormControl<string>('', { nonNullable: true });
  title = '';
  readonly bidsOf = signal<AuctionAdmin | null>(null);
  readonly bids = signal<AuctionBidAdmin[]>([]);

  f: AuctionInput = this.blank();
  starts = '';
  ends = '';

  readonly columns: DtColumn[] = [
    { key: 'item', label: 'auction.admin.item', value: (a: AuctionAdmin) => a.itemName },
    { key: 'prices', label: 'auction.admin.prices', value: (a: AuctionAdmin) => a.startingPrice, type: 'number', filter: 'none', width: '150px' },
    { key: 'current', label: 'auction.currentBid', value: (a: AuctionAdmin) => a.currentPrice, type: 'number', filter: 'none', width: '110px' },
    { key: 'ends', label: 'disc.ends', value: (a: AuctionAdmin) => a.endsAtUtc, filter: 'none', width: '150px' },
    { key: 'status', label: 'inv.status', value: (a: AuctionAdmin) => a.status, filter: 'select', optionLabel: (v: string) => this.i18n.t('auction.status.' + v), width: '230px' },
    { key: 'actions', label: '', width: '250px' },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getAuctions().subscribe((a) => this.items.set(a));
  }

  private blank(): AuctionInput {
    return { variantId: 0, quantity: 1, startingPrice: 100, minIncrement: 10, reservePrice: null, startsAtUtc: '', endsAtUtc: '' };
  }

  time(iso: string): string {
    return new Date(iso).toLocaleString(this.i18n.lang() === 'ar' ? 'ar-EG' : 'en-GB', { dateStyle: 'short', timeStyle: 'short' });
  }

  edit(a: AuctionAdmin | null): void {
    this.editing.set(a);
    this.f = a
      ? { variantId: a.variantId, quantity: a.quantity, startingPrice: a.startingPrice, minIncrement: a.minIncrement, reservePrice: a.reservePrice, startsAtUtc: a.startsAtUtc, endsAtUtc: a.endsAtUtc }
      : this.blank();
    this.starts = toLocalInput(a?.startsAtUtc ?? new Date().toISOString());
    this.ends = toLocalInput(a?.endsAtUtc ?? new Date(Date.now() + 3 * 86400000).toISOString());
    this.title = a?.title ?? '';
    this.imageCtl.setValue(a?.imageUrl ?? '');
    this.lot.set(a ? (a.items && a.items.length > 0 ? a.items : [{ variantId: a.variantId, name: a.itemName, label: '', quantity: a.quantity }]).map((i) => ({ variantId: i.variantId, name: `${i.name} ${i.label}`.trim(), quantity: i.quantity })) : []);
    this.open.set(true);
  }

  // Adds an item to the lot (the same item again adds one more unit)
  pick(v: VariantPick | null): void {
    if (!v) return;

    const list = this.lot();
    const same = list.find((x) => x.variantId === v.id);

    if (same) this.lot.set(list.map((x) => (x === same ? { ...x, quantity: x.quantity + 1 } : x)));
    else this.lot.set([...list, { variantId: v.id, name: `${v.productName} ${v.label}`.trim(), quantity: 1 }]);
  }

  setQty(index: number, value: string): void {
    const q = Math.max(1, Math.floor(Number(value)) || 1);

    this.lot.set(this.lot().map((x, i) => (i === index ? { ...x, quantity: q } : x)));
  }

  removeItem(index: number): void {
    this.lot.set(this.lot().filter((_, i) => i !== index));
  }

  save(): void {
    const f = this.f;
    const reserve = f.reservePrice === null || (f.reservePrice as unknown) === '' ? null : Number(f.reservePrice);

    if (this.lot().length === 0 || !(Number(f.startingPrice) > 0) || !(Number(f.minIncrement) > 0) || !this.starts || !this.ends) {
      this.toast.error(this.i18n.t('inv.fixFields'));
      return;
    }

    if (new Date(this.ends) <= new Date(this.starts)) {
      this.toast.error(this.i18n.t('auction.admin.endAfterStart'));
      return;
    }

    if (reserve !== null && reserve < Number(f.startingPrice)) {
      this.toast.error(this.i18n.t('auction.admin.reserveLow'));
      return;
    }

    const body: AuctionInput = {
      ...f,
      variantId: this.lot()[0].variantId,
      quantity: this.lot()[0].quantity,
      items: this.lot().map((x) => ({ variantId: x.variantId, quantity: x.quantity })),
      title: this.title.trim() || null,
      imageUrl: this.imageCtl.value.trim() || null,
      startingPrice: Number(f.startingPrice),
      minIncrement: Number(f.minIncrement),
      reservePrice: reserve,
      startsAtUtc: fromLocalInput(this.starts) ?? '',
      endsAtUtc: fromLocalInput(this.ends) ?? '',
    };
    const e = this.editing();
    const request: Observable<unknown> = e ? this.api.updateAuction(e.id, body) : this.api.createAuction(body);

    this.saving.set(true);
    request.subscribe({
      next: () => { this.saving.set(false); this.open.set(false); this.toast.success(this.i18n.t('inv.saved')); this.load(); },
      error: () => this.saving.set(false),
    });
  }

  showBids(a: AuctionAdmin): void {
    this.bidsOf.set(a);
    this.bids.set([]);
    this.api.getAuctionBids(a.id).subscribe((b) => this.bids.set(b));
  }

  cancel(a: AuctionAdmin): void {
    if (!confirm(this.i18n.t('auction.admin.confirmCancel'))) return;

    this.api.cancelAuction(a.id).subscribe(() => this.load());
  }
}
