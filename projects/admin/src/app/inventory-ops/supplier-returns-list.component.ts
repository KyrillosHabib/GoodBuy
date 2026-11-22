import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import { TranslatePipe } from '@shared/core/pipes';
import { InventoryOpsApi, ReturnLookups, ReturnStatus, SupplierReturnList } from './ops.api';
import './ops.i18n';

type View = 'all' | 'toApprove' | 'toReturn';

const STATUSES: ReturnStatus[] = ['Draft', 'Submitted', 'Approved', 'Completed', 'Rejected', 'Cancelled'];

// Returns to suppliers: what waits for my approval, what is ready to be sent back, and everything
@Component({
  selector: 'app-supplier-returns-list',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './supplier-returns-list.component.html',
  styleUrl: './supplier-returns-list.component.css',
})
export class SupplierReturnsListComponent implements OnInit {
  private readonly api = inject(InventoryOpsApi);
  private readonly router = inject(Router);

  readonly statuses = STATUSES;
  readonly view = signal<View>('all');
  readonly status = signal('');
  readonly supplierId = signal('');
  readonly search = signal('');
  readonly data = signal<SupplierReturnList | null>(null);
  readonly lookups = signal<ReturnLookups>({ warehouses: [], suppliers: [] });
  readonly loading = signal(true);

  ngOnInit(): void {
    this.api.getReturnLookups().pipe(catchError(() => of(null))).subscribe((l) => { if (l) this.lookups.set(l); });
    this.load();
  }

  setView(v: View): void {
    this.view.set(v);
    this.load();
  }

  load(): void {
    this.loading.set(this.data() === null);

    this.api.getSupplierReturns({ view: this.view() === 'all' ? '' : this.view(), status: this.status(), supplierId: this.supplierId(), search: this.search().trim() }).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  open(id: number): void {
    void this.router.navigate(['/inventory/returns', id]);
  }

  money(value: number): string {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
}
