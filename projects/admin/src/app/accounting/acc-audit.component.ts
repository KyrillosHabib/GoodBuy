import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { AuditLog } from '@shared/core/accounting.models';
import { TranslatePipe } from '@shared/core/pipes';

// Who did what, and when, on one item (read-only)
@Component({
  selector: 'app-acc-audit',
  standalone: true,
  imports: [TranslatePipe, SlicePipe],
  templateUrl: './acc-audit.component.html',
})
export class AccAuditComponent implements OnChanges {
  @Input({ required: true }) entityType!: string;
  @Input({ required: true }) entityId!: number;
  // Change it to reload (after an approval step)
  @Input() refresh = 0;

  private readonly api = inject(AccountingApiService);
  readonly rows = signal<AuditLog[]>([]);

  ngOnChanges(): void {
    this.api.getAudit(this.entityType, this.entityId, 50).subscribe({ next: (r) => this.rows.set(r), error: () => this.rows.set([]) });
  }
}
