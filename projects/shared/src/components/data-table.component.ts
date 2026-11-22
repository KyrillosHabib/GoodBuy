import { NgTemplateOutlet } from '@angular/common';
import { Component, Input, TemplateRef, computed, signal } from '@angular/core';
import { TranslatePipe } from '../core/pipes';
import { PagerComponent } from './pager.component';

export type DtValue = string | number | boolean | null | undefined;

export interface DtColumn {
  key: string;
  // Translation key of the header ('' for columns without a title, e.g. thumbnails / actions)
  label: string;
  // Value used for sorting, filtering and the global search. Omit for display-only columns.
  value?: (row: any) => DtValue;
  type?: 'text' | 'number' | 'bool';
  // Header filter: a text box (default), a drop-down of the distinct values, or none
  filter?: 'text' | 'select' | 'none';
  // Text shown for a value in the drop-down filter (the value itself is what is compared): used to translate statuses
  optionLabel?: (value: string) => string;
  width?: string;
}

// A table with a search box, sorting and a filter on every column, and paging.
// The parent draws the cells: <ng-template #row let-r><td>...</td></ng-template>
@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [NgTemplateOutlet, TranslatePipe, PagerComponent],
  templateUrl: './data-table.component.html',
})
export class DataTableComponent {
  readonly sizes = [10, 25, 50, 100];

  private readonly _rows = signal<any[]>([]);

  @Input() set rows(value: any[]) {
    this._rows.set(value ?? []);
    this.page.set(1);
  }

  get rows(): any[] {
    return this._rows();
  }

  @Input({ required: true }) columns: DtColumn[] = [];
  @Input({ required: true }) rowTemplate!: TemplateRef<any>;
  // Optional: a css class for a row (for example to mark the rows that need attention)
  @Input() rowClass?: (row: any) => string;

  readonly search = signal('');
  readonly filters = signal<Record<string, string>>({});
  readonly sortKey = signal<string | null>(null);
  readonly sortDir = signal<'asc' | 'desc'>('asc');
  readonly page = signal(1);
  readonly pageSize = signal(10);

  readonly filtered = computed(() => {
    const text = this.search().trim().toLowerCase();
    const filters = this.filters();

    return this._rows().filter((row) => {
      if (text) {
        const hit = this.columns.some((c) => c.value && String(c.value(row) ?? '').toLowerCase().includes(text));
        if (!hit) return false;
      }

      return this.columns.every((c) => {
        const f = (filters[c.key] ?? '').trim().toLowerCase();
        if (!f || !c.value) return true;

        const v = String(c.value(row) ?? '').toLowerCase();

        return c.type === 'bool' || c.filter === 'select' ? v === f : v.includes(f);
      });
    });
  });

  readonly sorted = computed(() => {
    const key = this.sortKey();
    const column = this.columns.find((c) => c.key === key);
    const list = [...this.filtered()];

    if (!column?.value) return list;

    const dir = this.sortDir() === 'asc' ? 1 : -1;

    return list.sort((a, b) => dir * this.compare(column.value!(a), column.value!(b)));
  });

  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.sorted().length / this.pageSize())));

  readonly pageRows = computed(() => {
    const start = (Math.min(this.page(), this.totalPages()) - 1) * this.pageSize();

    return this.sorted().slice(start, start + this.pageSize());
  });

  hasFilters(): boolean {
    return !!this.search() || Object.values(this.filters()).some((v) => !!v);
  }

  distinct(column: DtColumn): string[] {
    const values = new Set<string>();

    for (const row of this._rows()) {
      const v = column.value?.(row);
      if (v !== null && v !== undefined && v !== '') values.add(String(v));
    }

    return [...values].sort((a, b) => a.localeCompare(b));
  }

  sortBy(column: DtColumn): void {
    if (this.sortKey() === column.key) {
      this.sortDir.update((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortKey.set(column.key);
      this.sortDir.set('asc');
    }
  }

  setSearch(value: string): void {
    this.search.set(value);
    this.page.set(1);
  }

  setFilter(key: string, value: string): void {
    this.filters.update((f) => ({ ...f, [key]: value }));
    this.page.set(1);
  }

  setPageSize(value: string): void {
    this.pageSize.set(Number(value) || 10);
    this.page.set(1);
  }

  clearFilters(): void {
    this.search.set('');
    this.filters.set({});
    this.page.set(1);
  }

  private compare(a: DtValue, b: DtValue): number {
    const aEmpty = a === null || a === undefined || a === '';
    const bEmpty = b === null || b === undefined || b === '';

    if (aEmpty && bEmpty) return 0;
    if (aEmpty) return 1;
    if (bEmpty) return -1;

    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);

    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  }
}
