import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, of, switchMap } from 'rxjs';
import { catchError } from 'rxjs';
import { AuthService } from '@shared/core/auth.service';
import { I18nService } from '@shared/core/i18n.service';
import { InventoryApiService } from '@shared/core/inventory-api.service';
import { VariantPick } from '@shared/core/models';
import { TranslatePipe } from '@shared/core/pipes';
import { printArea } from '@shared/core/print';
import { BarcodeComponent } from './barcode';
import { FilterDef, REPORTS, ReportDef, defaultOf, reportOf } from './reports.defs';
import './reports.i18n';
import { ColumnType, InventoryReport, InventoryReportsApi, ReportColumn, ReportLookups } from './reports.api';

type Cell = string | number | null | undefined;

// One screen for every warehouse report: its filters, the numbers on top, the tables, printing, Excel export and stickers
@Component({
  selector: 'app-report-view',
  standalone: true,
  imports: [RouterLink, TranslatePipe, BarcodeComponent],
  templateUrl: './report-view.component.html',
  styleUrl: './report-view.component.css',
})
export class ReportViewComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(InventoryReportsApi);
  private readonly inventory = inject(InventoryApiService);
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly def = signal<ReportDef | undefined>(undefined);
  readonly values = signal<Record<string, string>>({});
  readonly applied = signal<Record<string, string>>({});
  readonly lookups = signal<ReportLookups>({ warehouses: [], suppliers: [], categories: [], brands: [] });
  readonly report = signal<InventoryReport | null>(null);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly missing = signal(false);
  readonly view = signal<'table' | 'stickers'>('table');

  readonly variantLabel = signal('');
  readonly variantResults = signal<VariantPick[]>([]);
  readonly variantInput = new Subject<string>();

  readonly requiredOf = (f: FilterDef) => !!f.required;

  // the reports this user may open (for the "open another report" list)
  readonly openable = computed(() => REPORTS.filter((r) => this.auth.can(...r.perms)));

  readonly visibleSummary = computed(() => (this.report()?.summary ?? []).filter((m) => m.value !== null && m.value !== undefined && m.value !== ''));

  // "Warehouse: Cairo · From: 2026-10-01" for the head of the printed page
  readonly filterLines = computed(() => {
    const d = this.def();
    const used = this.applied();
    this.i18n.lang();

    if (!d) return [];

    return d.filters
      .filter((f) => (used[f.key] ?? '') !== '')
      .map((f) => ({ label: this.i18n.t('ir.f.' + f.key), value: this.displayValue(f, used[f.key]) }));
  });

  // The stickers: one per item, repeated as many times as asked (never more than 2000 in all)
  readonly stickers = computed(() => {
    const table = this.report()?.tables[0];
    const copies = Math.min(100, Math.max(1, Number(this.applied()['copies'] ?? this.values()['copies']) || 1));
    const list: { item: string; label: string; barcode: string }[] = [];

    for (const row of table?.rows ?? []) {
      for (let i = 0; i < copies && list.length < 2000; i++) {
        list.push({ item: this.str(row['item']), label: this.str(row['label']), barcode: this.str(row['barcode']) });
      }
    }

    return list;
  });

  ngOnInit(): void {
    this.api.getLookups().pipe(catchError(() => of(null))).subscribe((l) => { if (l) this.lookups.set(l); });

    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => this.open(p.get('code')));

    // typing the name of an item: wait a little, then look it up
    this.variantInput
      .pipe(
        debounceTime(250),
        distinctUntilChanged(),
        switchMap((q) => this.inventory.searchVariants(q.trim()).pipe(catchError(() => of([])))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((list) => this.variantResults.set(list));
  }

  private open(code: string | null): void {
    const d = reportOf(code);

    if (!d || !this.auth.can(...d.perms)) {
      void this.router.navigate(['/inventory/reports']);
      return;
    }

    this.def.set(d);
    this.report.set(null);
    this.error.set(false);
    this.missing.set(false);
    this.view.set('table');
    this.variantLabel.set('');
    this.variantResults.set([]);
    this.values.set(this.startingValues(d));

    if (!d.filters.some(this.requiredOf)) this.run();
  }

  private startingValues(d: ReportDef): Record<string, string> {
    return Object.fromEntries(d.filters.map((f) => [f.key, defaultOf(f)]));
  }

  val(key: string): string {
    return this.values()[key] ?? '';
  }

  set(key: string, value: string): void {
    this.values.update((v) => ({ ...v, [key]: value }));
  }

  go(code: string): void {
    void this.router.navigate(['/inventory/reports', code]);
  }

  reset(): void {
    const d = this.def();
    if (!d) return;

    this.values.set(this.startingValues(d));
    this.variantLabel.set('');
    this.missing.set(false);
  }

  pickVariant(v: VariantPick): void {
    this.set('variantId', String(v.id));
    this.variantLabel.set(`${v.productName}${v.label ? ' — ' + v.label : ''} · ${v.sku}`);
    this.variantResults.set([]);
    this.run();
  }

  clearVariant(): void {
    this.set('variantId', '');
    this.variantLabel.set('');
    this.report.set(null);
  }

  run(): void {
    const d = this.def();
    if (!d) return;

    const values = this.values();

    if (d.filters.some((f) => f.required && !(values[f.key] ?? '').trim())) {
      this.missing.set(true);
      return;
    }

    this.missing.set(false);
    this.loading.set(true);
    this.error.set(false);

    const toApi = Object.fromEntries(d.filters.filter((f) => !f.local).map((f) => [f.key, (values[f.key] ?? '').trim()]));

    this.api.run(d.code, toApi).subscribe({
      next: (r) => {
        this.report.set(r);
        this.applied.set({ ...values });
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.error.set(true);
      },
    });
  }

  // ---------------------------------------------------------------- printing and export

  print(): void {
    const wide = (this.report()?.tables ?? []).some((t) => t.columns.length > 8) && this.view() === 'table';
    const style = document.createElement('style');

    style.textContent = `@page { size: A4 ${wide ? 'landscape' : 'portrait'}; margin: 10mm; }`;
    document.head.appendChild(style);
    window.addEventListener('afterprint', () => style.remove(), { once: true });

    printArea();
  }

  // A file Excel opens with the right Arabic letters (UTF-8 with a mark at the start)
  exportCsv(): void {
    const r = this.report();
    const d = this.def();
    if (!r || !d) return;

    const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const lines: string[] = [q(this.i18n.t('ir.r.' + d.code + '.title')), q(`${this.i18n.t('ir.generated')}: ${this.stamp(r.generatedAtUtc)}`)];

    for (const l of this.filterLines()) lines.push(`${q(l.label)},${q(l.value)}`);
    lines.push('');

    for (const m of this.visibleSummary()) lines.push(`${q(this.metricLabel(m.key))},${q(this.fmt(m.value, m.type, m.key))}`);
    if (this.visibleSummary().length > 0) lines.push('');

    for (const t of r.tables) {
      if (t.title) lines.push(q(this.titleOf(t.title)));
      lines.push(t.columns.map((c) => q(this.colLabel(c.key))).join(','));

      for (const row of t.rows) lines.push(t.columns.map((c) => this.csvCell(row[c.key], c)).join(','));

      if (t.totals) lines.push(t.columns.map((c, i) => (t.totals![c.key] != null ? this.csvCell(t.totals![c.key], c) : i === 0 ? q(this.i18n.t('ir.total')) : '')).join(','));

      lines.push('');
    }

    const blob = new Blob(['\ufeff' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    a.href = url;
    a.download = `${d.code}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  private csvCell(value: Cell, c: ReportColumn): string {
    if (value === null || value === undefined || value === '') return '';
    if (c.type === 'int' || c.type === 'money') return String(value);

    // a text that starts with = + - @ would be run as a formula by Excel
    const text = this.fmt(value, c.type, c.key);
    const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;

    return `"${safe.replace(/"/g, '""')}"`;
  }

  // ---------------------------------------------------------------- showing values

  colLabel(key: string): string {
    return this.i18n.t('ir.c.' + key);
  }

  metricLabel(key: string): string {
    const k = 'ir.m.' + key;
    const text = this.i18n.t(k);

    return text === k ? this.i18n.t('ir.c.' + key) : text;
  }

  titleOf(title: string): string {
    const k = 'ir.t.' + title;
    const text = this.i18n.t(k);

    return text === k ? title : text; // a warehouse name is shown as it is
  }

  isNum(type: ColumnType): boolean {
    return type === 'int' || type === 'money' || type === 'percent';
  }

  isLtr(type: ColumnType): boolean {
    return this.isNum(type) || type === 'date' || type === 'datetime' || type === 'code';
  }

  str(value: Cell): string {
    return value === null || value === undefined ? '' : String(value);
  }

  stamp(iso: string): string {
    return iso.slice(0, 16).replace('T', ' ') + ' UTC';
  }

  fmt(value: Cell, type: ColumnType, key = ''): string {
    if (value === null || value === undefined || value === '') return '';

    switch (type) {
      case 'int':
        return Number(value).toLocaleString('en-US');
      case 'money':
        return Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      case 'percent':
        return `${Number(value).toLocaleString('en-US', { maximumFractionDigits: 1 })}%`;
      case 'date':
        return String(value).slice(0, 10);
      case 'datetime':
        return String(value).slice(0, 16).replace('T', ' ');
      case 'movementType':
        return this.i18n.t('inv.type.' + value);
      case 'status':
        return this.i18n.t('ir.s.' + value);
      default:
        // the "sales" table of the item card names its periods by days
        return key === 'period' && ['30', '90', '365'].includes(String(value)) ? this.i18n.t('ir.p.' + value) : String(value);
    }
  }

  private displayValue(f: FilterDef, value: string): string {
    const name = (list: { id: number; name: string }[]) => list.find((x) => String(x.id) === value)?.name ?? value;
    const l = this.lookups();

    switch (f.type) {
      case 'warehouse': return name(l.warehouses);
      case 'supplier': return name(l.suppliers);
      case 'category': return name(l.categories);
      case 'brand': return name(l.brands);
      case 'variant': return this.variantLabel() || value;
      case 'flag': return this.i18n.t('ir.yes');
      case 'select': return value === '' ? this.i18n.t('ir.f.all') : this.i18n.t((f.optionPrefix ?? '') + value);
      default: return value;
    }
  }
}