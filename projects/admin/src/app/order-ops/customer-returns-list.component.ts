import { Component, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@shared/core/pipes';
import { CustomerReturnList, CustomerReturnStatus, OrderOpsApi } from './order-ops.api';
import './fulfilment.i18n';

type View = 'all' | 'toReceive' | 'toInspect' | 'toApprove' | 'quarantine';

const VIEWS: View[] = ['all', 'toReceive', 'toInspect', 'toApprove', 'quarantine'];
const STATUSES: CustomerReturnStatus[] = ['Requested', 'Returned', 'Inspection', 'AwaitingApproval', 'Quarantine', 'Completed', 'Cancelled'];

// Returns of customers: what waits to be received, checked or approved, what is isolated, and everything
@Component({
  selector: 'app-customer-returns-list',
  standalone: true,
  imports: [TranslatePipe],
  templateUrl: './customer-returns-list.component.html',
  styleUrl: './customer-returns-list.component.css',
})
export class CustomerReturnsListComponent implements OnInit {
  private readonly api = inject(OrderOpsApi);
  private readonly router = inject(Router);

  readonly views = VIEWS;
  readonly statuses = STATUSES;
  readonly view = signal<View>('all');
  readonly status = signal('');
  readonly search = signal('');
  readonly data = signal<CustomerReturnList | null>(null);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.load();
  }

  setView(v: View): void {
    this.view.set(v);
    this.load();
  }

  badge(v: View): number {
    const c = this.data()?.counts;

    if (!c) return 0;

    return v === 'toReceive' ? c.toReceive : v === 'toInspect' ? c.toInspect : v === 'toApprove' ? c.toApprove : v === 'quarantine' ? c.quarantine : 0;
  }

  load(): void {
    this.loading.set(this.data() === null);

    this.api.getReturns({ view: this.view() === 'all' ? '' : this.view(), status: this.status(), search: this.search().trim() }).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  open(id: number): void {
    void this.router.navigate(['/customer-returns', id]);
  }
}
