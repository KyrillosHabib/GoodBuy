import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TranslatePipe } from '@shared/core/pipes';
import { InventoryOpsApi, TransferList, TransferStatus } from './ops.api';
import './ops.i18n';

type View = 'all' | 'toApprove' | 'toDispatch' | 'toReceive' | 'mine';

const STATUSES: TransferStatus[] = ['Draft', 'Requested', 'Approved', 'InTransit', 'Received', 'Rejected', 'Cancelled'];

// Transfer requests between warehouses: what waits for me (to approve, to send, to receive), my own requests, and everything
@Component({
  selector: 'app-transfers-list',
  standalone: true,
  imports: [RouterLink, TranslatePipe],
  templateUrl: './transfers-list.component.html',
  styleUrl: './transfers-list.component.css',
})
export class TransfersListComponent implements OnInit {
  private readonly api = inject(InventoryOpsApi);
  private readonly router = inject(Router);

  readonly statuses = STATUSES;
  readonly view = signal<View>('all');
  readonly status = signal('');
  readonly search = signal('');
  readonly data = signal<TransferList | null>(null);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.load();
  }

  setView(v: View): void {
    this.view.set(v);
    this.load();
  }

  load(): void {
    this.loading.set(this.data() === null);

    this.api.getTransfers({ view: this.view() === 'all' ? '' : this.view(), status: this.status(), search: this.search().trim() }).subscribe({
      next: (d) => {
        this.data.set(d);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  open(id: number): void {
    void this.router.navigate(['/inventory/transfers', id]);
  }
}
