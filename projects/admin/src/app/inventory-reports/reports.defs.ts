// What each warehouse report asks the user (its filters) and where it sits in the reports page.
// The texts are in reports.i18n.ts: ir.r.<code>.title, ir.r.<code>.desc, ir.f.<filter key>

export type FilterType = 'text' | 'date' | 'number' | 'flag' | 'select' | 'warehouse' | 'supplier' | 'category' | 'brand' | 'variant';

export interface FilterDef {
  key: string;
  type: FilterType;
  // for 'select': the values, and the dictionary prefix of their names ('' value = the "all" choice)
  options?: string[];
  optionPrefix?: string;
  // 'today' | 'monthStart' | 'yearStart' | '-30' (days back) | a fixed text
  default?: string;
  required?: boolean;
  // does not go to the API (only the screen uses it)
  local?: boolean;
}

export type ReportGroup = 'stock' | 'movement' | 'trade' | 'tools';

export interface ReportDef {
  code: string;
  group: ReportGroup;
  icon: string;
  filters: FilterDef[];
  // the permissions of the dashboard that may open it (the Admin always may)
  perms: string[];
  // a report that can also be printed as stickers
  stickers?: boolean;
}

const MOVEMENT_TYPES = ['Receipt', 'Sale', 'Return', 'Adjustment', 'Damage', 'TransferOut', 'TransferIn', 'CountCorrection', 'OpeningBalance', 'SupplierReturn'];

const ITEM: FilterDef = { key: 'item', type: 'text' };
const CATEGORY: FilterDef = { key: 'categoryId', type: 'category' };
const BRAND: FilterDef = { key: 'brandId', type: 'brand' };
const WAREHOUSE: FilterDef = { key: 'warehouseId', type: 'warehouse' };

const STOCK = ['history', 'inventory'];

export const REPORTS: ReportDef[] = [
  // ---- stock status ----
  { code: 'stock-items', group: 'stock', icon: 'layers', perms: STOCK,
    filters: [ITEM, CATEGORY, BRAND, WAREHOUSE, { key: 'show', type: 'select', options: ['all', 'inStock', 'out'], optionPrefix: 'ir.o.', default: 'all' }] },

  { code: 'warehouse-inventory', group: 'stock', icon: 'home', perms: STOCK,
    filters: [WAREHOUSE, CATEGORY, BRAND, ITEM, { key: 'hideZero', type: 'flag' }, { key: 'countSheet', type: 'flag' }] },

  { code: 'item-card', group: 'stock', icon: 'file-text', perms: STOCK,
    filters: [{ key: 'variantId', type: 'variant', required: true }] },

  { code: 'reorder', group: 'stock', icon: 'flag', perms: STOCK,
    filters: [WAREHOUSE, CATEGORY, BRAND, ITEM] },

  { code: 'expiry', group: 'stock', icon: 'calendar', perms: STOCK,
    filters: [WAREHOUSE, ITEM, CATEGORY, BRAND, { key: 'withinDays', type: 'number', default: '30' },
      { key: 'show', type: 'select', options: ['all', 'expired'], optionPrefix: 'ir.o.', default: 'all' }] },

  // ---- movement and tracing ----
  { code: 'movements', group: 'movement', icon: 'refresh', perms: STOCK,
    filters: [ITEM, WAREHOUSE, { key: 'type', type: 'select', options: ['', ...MOVEMENT_TYPES], optionPrefix: 'inv.type.' },
      { key: 'from', type: 'date', default: '-30' }, { key: 'to', type: 'date', default: 'today' },
      { key: 'batch', type: 'text' }, { key: 'reference', type: 'text' }, { key: 'supplierId', type: 'supplier' }, { key: 'user', type: 'text' },
      CATEGORY, BRAND, { key: 'order', type: 'select', options: ['asc', 'desc'], optionPrefix: 'ir.o.', default: 'asc' }] },

  { code: 'consumables', group: 'movement', icon: 'package', perms: STOCK,
    filters: [WAREHOUSE, { key: 'type', type: 'select', options: ['', 'Damage', 'Adjustment', 'CountCorrection'], optionPrefix: 'inv.type.' },
      { key: 'from', type: 'date', default: '-30' }, { key: 'to', type: 'date', default: 'today' }, ITEM, CATEGORY, BRAND] },

  // ---- sales and purchasing ----
  { code: 'top-sellers', group: 'trade', icon: 'trending-up', perms: STOCK,
    filters: [{ key: 'from', type: 'date', default: '-30' }, { key: 'to', type: 'date', default: 'today' }, CATEGORY, BRAND, ITEM,
      { key: 'top', type: 'number', default: '50' },
      { key: 'sortBy', type: 'select', options: ['qty', 'amount'], optionPrefix: 'ir.o.', default: 'qty' },
      { key: 'deliveredOnly', type: 'flag' }] },

  { code: 'customer-sales', group: 'trade', icon: 'users', perms: ['orders'],
    filters: [{ key: 'customer', type: 'text', required: true }, { key: 'from', type: 'date', default: 'yearStart' }, { key: 'to', type: 'date', default: 'today' },
      ITEM, CATEGORY, BRAND] },

  { code: 'supplier-purchases', group: 'trade', icon: 'truck', perms: STOCK,
    filters: [{ key: 'supplierId', type: 'supplier' }, { key: 'from', type: 'date', default: 'yearStart' }, { key: 'to', type: 'date', default: 'today' },
      { key: 'groupBy', type: 'select', options: ['month', 'day', 'year', 'none'], optionPrefix: 'ir.o.', default: 'month' },
      ITEM, CATEGORY, BRAND, WAREHOUSE] },

  // ---- tools ----
  { code: 'barcodes', group: 'tools', icon: 'tag', perms: STOCK, stickers: true,
    filters: [ITEM, CATEGORY, BRAND, WAREHOUSE, { key: 'inStockOnly', type: 'flag' }, { key: 'copies', type: 'number', default: '1', local: true }] },
];

export const GROUPS: ReportGroup[] = ['stock', 'movement', 'trade', 'tools'];

export function reportOf(code: string | null): ReportDef | undefined {
  return REPORTS.find((r) => r.code === code);
}

// The starting value of a filter ('' when it has none)
export function defaultOf(f: FilterDef): string {
  const d = f.default ?? '';
  const now = new Date();
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;

  if (d === 'today') return iso(now);
  if (d === 'monthStart') return iso(new Date(now.getFullYear(), now.getMonth(), 1));
  if (d === 'yearStart') return iso(new Date(now.getFullYear(), 0, 1));

  if (/^-\d+$/.test(d)) {
    const back = new Date(now);
    back.setDate(back.getDate() + Number(d));
    return iso(back);
  }

  return d;
}
