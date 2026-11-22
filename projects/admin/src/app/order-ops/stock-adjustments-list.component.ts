import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { InventoryApiService } from '@shared/core/inventory-api.service';
import { Warehouse } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { OrderOpsApi, StockAdjustmentList, StockAdjustmentStatus } from './order-ops.api';
import './adjustments.i18n';

type View = 'all' | 'toApprove';

const STATUSES: StockAdjustmentStatus[] = ['Pending', 'Approved', 'Rejected', 'Cancelled'];

// Stock adjustments: what waits for the head of the warehouse, and everything that was recorded
@Component({
  selector: 'app-stock-adjustments-list',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './stock-adjustments-list.component.html',
  styleUrl: './stock-adjustments-list.component.css',
})
export class StockAdjustmentsListComponent implements OnInit {
  private readonly api = inject(OrderOpsApi);
  private readonly inventory = inject(InventoryApiService);
  private readonly router = inject(Router);

  readonly statuses = STATUSES;
  readonly view = signal<View>('all');
  readonly status = signal('');
  readonly warehouseId = signal('');
  readonly search = signal('');
  readonly data = signal<StockAdjustmentList | null>(null);
  readonly warehouses = signal<Warehouse[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.inventory.getWarehouses().pipe(catchError(() => of([] as Warehouse[]))).subscribe((w) => this.warehouses.set(w));
    this.load();
  }

  setView(v: View): void {
    this.view.set(v);
    this.load();
  }

  load(): void {
    this.loading.set(this.data() === null);

    this.api
      .getAdjustments({
        view: this.view() === 'all' ? '' : this.view(),
        status: this.status(),
        warehouseId: this.warehouseId() ? Number(this.warehouseId()) : null,
        search: this.search().trim(),
      })
      .subscribe({
        next: (d) => {
          this.data.set(d);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  open(id: number): void {
    void this.router.navigate(['/inventory/adjustments', id]);
  }

  signed(n: number): string {
    return n > 0 ? `+${n}` : `${n}`;
  }
}
