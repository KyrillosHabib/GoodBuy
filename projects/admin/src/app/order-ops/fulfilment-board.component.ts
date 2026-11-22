import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { ModalComponent } from '@shared/components/modal.component';
import { TranslatePipe } from '@shared/core/pipes';
import { I18nService } from '@shared/core/i18n.service';
import { ToastService } from '@shared/core/toast.service';
import { FulfilmentBoard, FulfilmentGroup, FulfilmentGroupKey, FulfilmentItem, FulfilmentOrder, OrderOpsApi } from './order-ops.api';
import { stageClass, stageKey } from './order-stage';
import './fulfilment.i18n';

const PAGE_SIZE = 20;
const METHODS = ['CashOnDelivery', 'Card', 'Tabby', 'Tamara', 'Fawry', 'MobileWallet', 'Paymob'];

// The five boxes of the top of the screen. Each one filters the table (the "view" of the API).
const KPIS: { key: FulfilmentGroupKey; label: string; css: string; tip: boolean }[] = [
  { key: 'new', label: 'ful.kpi.new', css: 'k-new', tip: false },
  { key: 'working', label: 'ful.kpi.working', css: 'k-work', tip: false },
  { key: 'ready', label: 'ful.kpi.ready', css: 'k-ready', tip: false },
  { key: 'problem', label: 'ful.kpi.problem', css: 'k-bad', tip: true },
  { key: 'late', label: 'ful.kpi.late', css: 'k-late', tip: true },
];

// The warehouse task board: the lines of confirmed orders, who prepares them and where they stand.
// The head of the department allocates lines to warehouses; the employees of a warehouse prepare their own lines.
@Component({
  selector: 'app-fulfilment-board',
  standalone: true,
  imports: [TranslatePipe, ModalComponent],
  templateUrl: './fulfilment-board.component.html',
  styleUrl: './fulfilment-board.component.css',
})
export class FulfilmentBoardComponent implements OnInit {
  private readonly api = inject(OrderOpsApi);
  private readonly toast = inject(ToastService);
  private readonly i18n = inject(I18nService);

  readonly kpis = KPIS;
  readonly methods = METHODS;

  readonly view = signal<'all' | FulfilmentGroupKey>('all');
  readonly search = signal('');
  readonly warehouseId = signal(0);
  readonly pay = signal('');
  readonly board = signal<FulfilmentBoard | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);

  // The moment the board was loaded: the age of the orders is counted from it
  readonly now = signal(Date.now());

  // Newest first (the API sends them like that), 20 to a page
  readonly page = signal(1);
  readonly filtered = computed(() => {
    const method = this.pay();
    const orders = this.board()?.orders ?? [];

    return method ? orders.filter((o) => o.paymentMethod === method) : orders;
  });
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / PAGE_SIZE)));
  readonly pageItems = computed(() => this.filtered().slice((this.page() - 1) * PAGE_SIZE, this.page() * PAGE_SIZE));
  readonly from = computed(() => (this.filtered().length === 0 ? 0 : (this.page() - 1) * PAGE_SIZE + 1));
  readonly to = computed(() => Math.min(this.page() * PAGE_SIZE, this.filtered().length));
  readonly pageNumbers = computed(() => {
    const total = this.pageCount();
    const start = Math.max(1, Math.min(this.page() - 2, total - 4));

    return Array.from({ length: Math.min(5, total) }, (_, i) => start + i);
  });

  private readonly openIds = signal<number[]>([]);

  // What the head picked but did not save yet: line id -> warehouse id
  readonly draft = signal<Record<number, number>>({});
  // The lines ticked by the employee
  readonly selected = signal<number[]>([]);

  // The orders ticked for the actions on several orders
  readonly chosen = signal<number[]>([]);
  readonly chosenOrders = computed(() => (this.board()?.orders ?? []).filter((o) => this.chosen().includes(o.id)));
  readonly carrierId = signal(0);
  readonly handOverFor = signal<FulfilmentOrder[] | null>(null);
  readonly tracking = signal('');

  ngOnInit(): void {
    this.load();
  }

  // ---------- the boxes
  group(key: string): FulfilmentGroup {
    return this.board()?.groups?.[key as FulfilmentGroupKey] ?? { count: 0, oldestUtc: null, warehouses: [] };
  }

  kpiLabel(key: string): string {
    return KPIS.find((k) => k.key === key)?.label ?? 'ful.tab.all';
  }

  hint(key: FulfilmentGroupKey): string {
    const g = this.group(key);

    switch (key) {
      case 'new':
        return g.oldestUtc ? this.i18n.t('ful.kpi.oldest', { t: this.ageOf(g.oldestUtc) }) : this.i18n.t('ful.kpi.none');
      case 'working':
        return g.warehouses.length > 0 ? g.warehouses.slice(0, 3).map((w) => `${w.name} ${w.count}`).join(' · ') : this.i18n.t('ful.kpi.none');
      case 'ready':
        return this.i18n.t('ful.kpi.readyHint');
      case 'problem':
        return this.i18n.t('ful.kpi.problemHint');
      default:
        return this.i18n.t('ful.kpi.lateHint');
    }
  }

  setView(v: 'all' | FulfilmentGroupKey | string): void {
    this.view.set(v as 'all' | FulfilmentGroupKey);
    this.load();
  }

  setPay(method: string): void {
    this.pay.set(method);
    this.page.set(1);
  }

  // ---------- reading the board
  load(): void {
    this.loading.set(this.board() === null);

    this.api.getBoard({ view: this.view() === 'all' ? '' : this.view(), warehouseId: this.warehouseId() || null, search: this.search().trim() }).subscribe({
      next: (b) => {
        this.board.set(b);
        this.now.set(Date.now());
        this.draft.set({});
        this.selected.set([]);
        this.chosen.set([]);
        this.page.set(1);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  goto(p: number): void {
    this.page.set(Math.min(Math.max(1, p), this.pageCount()));
  }

  // ---------- one row
  isOpen(id: number): boolean { return this.openIds().includes(id); }
  toggleOpen(id: number): void { this.openIds.update((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id])); }
  units(o: FulfilmentOrder): number { return o.items.reduce((n, i) => n + i.quantity, 0); }
  stage(o: FulfilmentOrder): string { return stageKey(o.orderStatus, o.status); }
  cls(o: FulfilmentOrder): string { return stageClass(o.orderStatus, o.status); }

  warehousesOf(o: FulfilmentOrder): string {
    const names = [...new Set(o.items.filter((i) => i.warehouse).map((i) => i.warehouse as string))];

    return names.length > 0 ? names.join(' + ') : this.i18n.t('ful.notAllocated');
  }

  payText(o: FulfilmentOrder): string {
    const method = this.i18n.t('pay.' + o.paymentMethod);

    return o.paymentStatus === 'Paid' ? `${this.i18n.t('ful.pay.paid')} · ${method}` : method;
  }

  // "2 h 10 m" since the given moment
  ageOf(utc: string): string {
    const minutes = Math.max(0, Math.floor((this.now() - new Date(utc.endsWith('Z') ? utc : utc + 'Z').getTime()) / 60000));
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    if (h === 0) return `${m} ${this.i18n.t('ful.unit.m')}`;
    if (h >= 24) return `${h} ${this.i18n.t('ful.unit.h')}`;

    return `${h} ${this.i18n.t('ful.unit.h')} ${String(m).padStart(2, '0')} ${this.i18n.t('ful.unit.m')}`;
  }

  isLate(o: FulfilmentOrder): boolean {
    return o.status !== 'ReadyToShip' && o.status !== 'NotRequired' && this.now() - new Date(o.createdAtUtc.endsWith('Z') ? o.createdAtUtc : o.createdAtUtc + 'Z').getTime() > 24 * 3600 * 1000;
  }

  // The button of the row: the next thing to do for this order
  actionKey(o: FulfilmentOrder): string {
    switch (o.status) {
      case 'NeedsAllocation': return this.board()?.canAllocate ? 'ful.act.allocate' : 'ful.act.open';
      case 'Allocated': return this.startable(o).length > 0 ? 'ful.act.start' : 'ful.act.open';
      case 'ReadyToShip': return 'ful.act.handOver';
      case 'Problem': return 'ful.act.resolve';
      default: return 'ful.act.open';
    }
  }

  rowAction(o: FulfilmentOrder, event: Event): void {
    event.stopPropagation();

    if (o.status === 'Allocated' && this.startable(o).length > 0) {
      this.run(this.api.startPicking(o.id, this.startable(o)), 'ful.ok.started');
      return;
    }

    if (o.status === 'ReadyToShip') {
      this.openHandOver([o]);
      return;
    }

    this.openIds.update((x) => (x.includes(o.id) ? x : [...x, o.id]));
  }

  // ---------- ticking orders
  isChosen(id: number): boolean { return this.chosen().includes(id); }
  toggleChosen(id: number): void { this.chosen.update((x) => (x.includes(id) ? x.filter((y) => y !== id) : [...x, id])); }

  allOnPageChosen(): boolean {
    const ids = this.pageItems().map((o) => o.id);

    return ids.length > 0 && ids.every((id) => this.chosen().includes(id));
  }

  toggleAllOnPage(): void {
    const ids = this.pageItems().map((o) => o.id);

    this.chosen.update((x) => (ids.every((id) => x.includes(id)) ? x.filter((y) => !ids.includes(y)) : [...new Set([...x, ...ids])]));
  }

  // ---------- allocation (the head)
  currentWarehouse(i: FulfilmentItem): number {
    return this.draft()[i.itemId] ?? i.warehouseId ?? 0;
  }

  pick(itemId: number, warehouseId: number): void {
    this.draft.update((d) => ({ ...d, [itemId]: warehouseId }));
  }

  private changed(o: FulfilmentOrder): { itemId: number; warehouseId: number }[] {
    return o.items
      .filter((i) => i.status !== 'Fulfilled' && this.currentWarehouse(i) !== 0 && this.currentWarehouse(i) !== (i.warehouseId ?? 0))
      .map((i) => ({ itemId: i.itemId, warehouseId: this.currentWarehouse(i) }));
  }

  changedCount(o: FulfilmentOrder): number {
    return this.changed(o).length;
  }

  saveAllocation(o: FulfilmentOrder): void {
    const lines = this.changed(o);

    if (lines.length === 0) {
      this.toast.error(this.i18n.t('ful.noChange'));
      return;
    }

    this.run(this.api.allocate(o.id, lines), 'ful.ok.allocated');
  }

  // ---------- the employees of a warehouse: the lines of one order
  isSelected(itemId: number): boolean {
    return this.selected().includes(itemId);
  }

  toggle(itemId: number): void {
    this.selected.update((s) => (s.includes(itemId) ? s.filter((x) => x !== itemId) : [...s, itemId]));
  }

  hasMine(o: FulfilmentOrder): boolean {
    return o.items.some((i) => i.mine && i.warehouseId !== null && i.status !== 'Fulfilled' && i.status !== 'NotRequired');
  }

  private picked(o: FulfilmentOrder): number[] {
    return o.items.filter((i) => this.isSelected(i.itemId)).map((i) => i.itemId);
  }

  // The lines of mine that did not start yet / that can leave the warehouse
  private startable(o: FulfilmentOrder): number[] {
    return o.items.filter((i) => i.mine && i.warehouseId !== null && i.status === 'NotStarted').map((i) => i.itemId);
  }

  private issuable(o: FulfilmentOrder): number[] {
    return o.items.filter((i) => i.mine && i.warehouseId !== null && (i.status === 'NotStarted' || i.status === 'Picking')).map((i) => i.itemId);
  }

  start(o: FulfilmentOrder): void {
    const ids = this.picked(o);

    if (ids.length === 0) {
      this.toast.error(this.i18n.t('ful.pickLines'));
      return;
    }

    this.run(this.api.startPicking(o.id, ids), 'ful.ok.started');
  }

  issue(o: FulfilmentOrder): void {
    const ids = this.picked(o);

    if (ids.length === 0) {
      this.toast.error(this.i18n.t('ful.pickLines'));
      return;
    }

    if (!confirm(this.i18n.t('ful.issueConfirm'))) return;

    this.run(this.api.issueItems(o.id, ids), 'ful.ok.issued');
  }

  // A problem is reported on one line at a time
  problem(o: FulfilmentOrder): void {
    const ids = this.picked(o);

    if (ids.length === 0) {
      this.toast.error(this.i18n.t('ful.pickLines'));
      return;
    }

    const note = prompt(this.i18n.t('ful.problemAsk'));

    if (!note || !note.trim()) return;

    this.saving.set(true);

    let left = ids.length;
    let failed = false;

    for (const id of ids) {
      this.api.reportProblem(o.id, id, note.trim()).subscribe({
        next: () => {
          if (--left === 0) this.finished(failed, 'ful.ok.problem');
        },
        error: () => {
          failed = true;
          if (--left === 0) this.finished(failed, 'ful.ok.problem');
        },
      });
    }
  }

  // ---------- the actions on several orders
  bulkStart(): void {
    const calls = this.chosenOrders().map((o) => ({ o, ids: this.startable(o) })).filter((x) => x.ids.length > 0);

    if (calls.length === 0) {
      this.toast.error(this.i18n.t('ful.noEligible'));
      return;
    }

    this.runAll(calls.map((x) => this.api.startPicking(x.o.id, x.ids)), 'ful.ok.started');
  }

  bulkIssue(): void {
    const calls = this.chosenOrders().map((o) => ({ o, ids: this.issuable(o) })).filter((x) => x.ids.length > 0);

    if (calls.length === 0) {
      this.toast.error(this.i18n.t('ful.noEligible'));
      return;
    }

    if (!confirm(this.i18n.t('ful.issueConfirm'))) return;

    this.runAll(calls.map((x) => this.api.issueItems(x.o.id, x.ids)), 'ful.ok.issued');
  }

  openHandOver(orders: FulfilmentOrder[]): void {
    if (orders.some((o) => o.status !== 'ReadyToShip' && o.status !== 'NotRequired')) {
      this.toast.error(this.i18n.t('ful.notReady'));
      return;
    }

    this.tracking.set('');
    this.handOverFor.set(orders);
  }

  confirmHandOver(): void {
    const orders = this.handOverFor() ?? [];

    if (this.carrierId() === 0) {
      this.toast.error(this.i18n.t('ful.chooseCarrierFirst'));
      return;
    }

    const tracking = orders.length === 1 ? this.tracking().trim() : '';

    this.run(this.api.handOver(orders.map((o) => o.id), this.carrierId(), tracking || null), 'ful.ok.handedOver');
    this.handOverFor.set(null);
  }

  // ---------- the pick list of one order, on paper
  printPick(o: FulfilmentOrder): void {
    const esc = (v: string | number | null | undefined) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
    const t = (k: string) => esc(this.i18n.t(k));

    const rows = o.items
      .map((i) => `<tr><td>${esc(i.productName)} <small>${esc(i.variantLabel)}</small></td><td dir="ltr">${esc(i.sku)}</td><td>${esc(i.quantity)}</td><td>${esc(i.warehouse ?? '—')}</td><td class="box"></td></tr>`)
      .join('');

    const w = window.open('', '_blank');

    if (!w) return;

    w.document.write(`<!doctype html><html dir="${this.i18n.isRtl() ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${esc(o.number)}</title>
      <style>body{font-family:Tahoma,Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:6px 8px;text-align:start}
      th{background:#eee}.box{width:40px}small{color:#555}h1{font-size:20px;margin:0 0 4px}p{margin:2px 0;color:#444}</style></head>
      <body><h1>${t('ful.pickList')} · <span dir="ltr">${esc(o.number)}</span></h1>
      <p>${esc(o.customerName)} · ${esc(o.city)} · <span dir="ltr">${esc(o.phone)}</span></p><p>${esc(o.address)}</p>${o.notes ? `<p>${t('ful.customerNote')}: ${esc(o.notes)}</p>` : ''}
      <table><thead><tr><th>${t('ful.col.item')}</th><th>SKU</th><th>${t('ful.col.qty')}</th><th>${t('ful.col.warehouse')}</th><th></th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  // ---------- running a call
  private finished(failed: boolean, okKey: string): void {
    this.saving.set(false);
    if (!failed) this.toast.success(this.i18n.t(okKey));
    this.load();
  }

  private run(call: Observable<void>, okKey: string): void {
    this.saving.set(true);
    call.subscribe({
      next: () => this.finished(false, okKey),
      error: () => {
        this.saving.set(false);
        this.load();
      },
    });
  }

  private runAll(calls: Observable<void>[], okKey: string): void {
    this.saving.set(true);
    forkJoin(calls).subscribe({
      next: () => this.finished(false, okKey),
      error: () => {
        this.saving.set(false);
        this.load();
      },
    });
  }
}
