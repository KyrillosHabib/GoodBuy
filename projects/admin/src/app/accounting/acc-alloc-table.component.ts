import { Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { DecimalPipe, SlicePipe } from '@angular/common';
import { AccDocument } from '@shared/core/accounting.models';
import { TranslatePipe } from '@shared/core/pipes';

// Open documents of one party with an amount box for each: used to match money (or a credit note) to invoices.
// It tells the parent which amounts were typed; "fill" spreads what is available over the oldest documents first.
@Component({
  selector: 'app-acc-alloc-table',
  standalone: true,
  imports: [DecimalPipe, SlicePipe, TranslatePipe],
  templateUrl: './acc-alloc-table.component.html',
})
export class AccAllocTableComponent {
  @Input({ required: true }) docs: AccDocument[] = [];
  // What can be matched (the unmatched part of the voucher / credit note)
  @Input() available = 0;
  // Amounts already written on a draft voucher
  @Input() set preset(value: { documentId: number; amount: number }[] | null) {
    if (!value) return;
    const next: Record<number, number> = {};
    for (const v of value) next[v.documentId] = v.amount;
    this.amounts.set(next);
    this.emit();
  }
  @Output() changed = new EventEmitter<{ documentId: number; amount: number }[]>();

  readonly amounts = signal<Record<number, number | undefined>>({});

  used(): number {
    return Math.round(Object.values(this.amounts()).reduce<number>((a, b) => a + (b ?? 0), 0) * 100) / 100;
  }

  set(d: AccDocument, raw: string): void {
    const n = Math.max(0, Math.min(Number(raw) || 0, d.outstanding));
    this.amounts.update((m) => ({ ...m, [d.id]: n }));
    this.emit();
  }

  fill(): void {
    let left = this.available;
    const next: Record<number, number> = {};
    const ordered = [...this.docs].sort((a, b) => (a.dueDate ?? a.issueDate).localeCompare(b.dueDate ?? b.issueDate));

    for (const d of ordered) {
      const take = Math.min(left, d.outstanding);
      if (take > 0) next[d.id] = Math.round(take * 100) / 100;
      left = Math.round((left - take) * 100) / 100;
    }

    this.amounts.set(next);
    this.emit();
  }

  clear(): void {
    this.amounts.set({});
    this.emit();
  }

  private emit(): void {
    this.changed.emit(
      Object.entries(this.amounts())
        .filter(([, amount]) => (amount ?? 0) > 0)
        .map(([id, amount]) => ({ documentId: Number(id), amount: amount as number })),
    );
  }
}
