import { Component, OnInit, inject, signal } from '@angular/core';
import { SlicePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { AuditLog } from '@shared/core/accounting.models';
import { TranslatePipe } from '@shared/core/pipes';

import { IntroComponent } from '../intro.component';
// Who did what and when, on every accounting item (read only)
@Component({
  selector: 'app-audit-admin',
  standalone: true,
  imports: [IntroComponent, FormsModule, SlicePipe, TranslatePipe],
  templateUrl: './audit-admin.component.html',
})
export class AuditAdminComponent implements OnInit {
  private readonly api = inject(AccountingApiService);

  readonly entityTypes = ['document', 'voucher', 'journal', 'transfer', 'settlement', 'carrier-settlement', 'allocation', 'account', 'party', 'carrier', 'cash-account', 'issue', 'settings'];
  readonly rows = signal<AuditLog[]>([]);
  entityType = '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.api.getAudit(this.entityType || undefined, undefined, 500).subscribe((r) => this.rows.set(r));
  }
}
