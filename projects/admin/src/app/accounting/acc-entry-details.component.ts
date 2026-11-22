import { Component, Input, OnChanges, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AccountingApiService } from '@shared/core/accounting-api.service';
import { JournalEntry, JournalLine } from '@shared/core/accounting.models';
import { TranslatePipe } from '@shared/core/pipes';

// The journal entry of an operation: ONE table of its lines (account, party, category, note, debit, credit), a totals row,
// and a clear line saying whether debit = credit. It is used by the journal, documents, vouchers, transfers and settlements.
// Give it the entry you already have, or only its id and it loads it.
@Component({
  selector: 'app-acc-entry-details',
  standalone: true,
  imports: [DecimalPipe, TranslatePipe],
  templateUrl: './acc-entry-details.component.html',
  styleUrl: './acc-entry-details.component.css',
})
export class AccEntryDetailsComponent implements OnChanges {
  private readonly api = inject(AccountingApiService);

  // The entry when it is already loaded ...
  @Input() entry: JournalEntry | null = null;
  // ... or just its id
  @Input() entryId: number | null = null;

  readonly current = signal<JournalEntry | null>(null);

  ngOnChanges(): void {
    if (this.entry) {
      this.current.set(this.entry);
    } else if (this.entryId) {
      this.api.getJournalEntry(this.entryId).subscribe((e) => this.current.set(e));
    } else {
      this.current.set(null);
    }
  }

  lines(): JournalLine[] { return this.current()?.lines ?? []; }
  debitTotal(): number { return this.round(this.lines().reduce((s, l) => s + (+l.debit || 0), 0)); }
  creditTotal(): number { return this.round(this.lines().reduce((s, l) => s + (+l.credit || 0), 0)); }
  balanced(): boolean { return this.debitTotal() === this.creditTotal(); }
  private round(v: number): number { return Math.round((v + Number.EPSILON) * 100) / 100; }
}
