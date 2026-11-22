import { Component, Input, signal } from '@angular/core';

// Small dependency-free SVG charts for the accounting dashboard. Numbers and axes always read left to right (also in Arabic).

export const PALETTE = ['#177a93', '#e08a2e', '#7c5cc4', '#3f9e6a', '#c2446b', '#8a97a0', '#c9a227', '#4a78d6'];

// The colour of the chosen site theme (white-on-black in the dark mode), so the charts follow the theme the owner picked
export function themeColor(): string {
  const root = document.documentElement;
  const css = getComputedStyle(root);
  const dark = root.dataset['theme'] === 'dark';
  const v = (dark ? css.getPropertyValue('--hl') : css.getPropertyValue('--primary')).trim();

  return /^#[0-9a-fA-F]{6}$/.test(v) ? v : PALETTE[0];
}

// The floating box that shows the numbers of the point under the mouse
const TIP_CSS = `
  .cw { position: relative; }
  .tip { position: absolute; top: 4px; z-index: 5; pointer-events: none; min-width: 150px; max-width: 260px; background: var(--surface, #fff); color: var(--text, #111); border: 1px solid var(--border, #e5e5e5); border-radius: 10px; box-shadow: 0 10px 30px rgba(0, 0, 0, .16); padding: .55rem .7rem; font-size: .82rem; line-height: 1.5; }
  .tip b { display: block; margin-bottom: .2rem; }
  .tip .r { display: flex; align-items: center; gap: .45rem; }
  .tip .r i { width: 9px; height: 9px; border-radius: 3px; flex: none; }
  .tip .r span { flex: 1; }
  .tip .r strong { direction: ltr; }
  .empty { text-align: center; padding: 2rem 0; }
  .legend { display: flex; gap: 1rem; flex-wrap: wrap; font-size: .8rem; justify-content: center; }
  .legend i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-inline-end: .35rem; }
`;

function tipPos(pct: number): string {
  // near the edges the box opens to the other side so it never leaves the card
  return pct > 62 ? `right:${(100 - pct).toFixed(1)}%` : `left:${pct.toFixed(1)}%`;
}

export interface ChartSeries { name: string; values: number[]; color?: string }
export interface ChartItem { label: string; value: number; color?: string }

export function compact(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return (n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1) + 'M';
  if (a >= 1_000) return (n / 1_000).toFixed(a >= 10_000 ? 0 : 1) + 'K';
  return Math.round(n).toString();
}

// "nice" top of the axis and its ticks
function axis(min: number, max: number): { lo: number; hi: number; ticks: number[] } {
  const lo = Math.min(0, min);
  let hi = Math.max(0, max);
  if (hi === lo) hi = lo + 1;
  const raw = (hi - lo) / 4;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(hi / step) * step;
  const bottom = Math.floor(lo / step) * step;
  const ticks: number[] = [];
  for (let v = bottom; v <= top + step / 2; v += step) ticks.push(v);
  return { lo: bottom, hi: top, ticks };
}

const W = 600;
const H = 230;
const L = 46;
const R = 10;
const T = 10;
const B = 26;

// ---------------------------------------------------------------- line / area
@Component({
  selector: 'app-line-chart',
  standalone: true,
  templateUrl: './line-chart.component.html',
  styles: [TIP_CSS],
})
export class LineChartComponent {
  @Input() labels: string[] = [];
  @Input() series: ChartSeries[] = [];
  @Input() area = false;
  @Input() title = '';
  @Input() emptyText = '';

  readonly W = W; readonly H = H; readonly L = L; readonly R = R; readonly T = T;
  readonly hi = signal<number | null>(null);

  hasData(): boolean { return this.series.some((s) => s.values.some((v) => v !== 0)); }
  ax() { const all = this.series.flatMap((s) => s.values); return axis(Math.min(...all, 0), Math.max(...all, 0)); }
  slot(): number { return (W - L - R) / Math.max(1, this.labels.length - 1); }
  x(i: number): number { return this.labels.length <= 1 ? (L + W - R) / 2 : L + (i * (W - L - R)) / (this.labels.length - 1); }
  y(v: number): number { const a = this.ax(); return T + (1 - (v - a.lo) / (a.hi - a.lo)) * (H - T - B); }
  fmt(n: number): string { return compact(n); }
  color(s: ChartSeries, i: number): string { return s.color ?? PALETTE[i % PALETTE.length]; }
  showLabel(i: number): boolean { const n = this.labels.length; return n <= 12 || i % Math.ceil(n / 12) === 0; }
  pos(): string { return tipPos((this.x(this.hi() ?? 0) / W) * 100); }
  path(s: ChartSeries): string { return s.values.map((v, i) => `${i === 0 ? 'M' : 'L'}${this.x(i).toFixed(1)},${this.y(v).toFixed(1)}`).join(' '); }
  areaPath(s: ChartSeries): string {
    if (s.values.length === 0) return '';
    const base = this.y(0).toFixed(1);
    return `${this.path(s)} L${this.x(s.values.length - 1).toFixed(1)},${base} L${this.x(0).toFixed(1)},${base} Z`;
  }
}

// ---------------------------------------------------------------- grouped / stacked bars
@Component({
  selector: 'app-bar-chart',
  standalone: true,
  templateUrl: './bar-chart.component.html',
  styles: [TIP_CSS],
})
export class BarChartComponent {
  @Input() labels: string[] = [];
  @Input() series: ChartSeries[] = [];
  @Input() stacked = false;
  @Input() title = '';
  @Input() emptyText = '';

  readonly W = W; readonly H = H; readonly L = L; readonly R = R; readonly T = T;
  readonly hi = signal<number | null>(null);

  hasData(): boolean { return this.series.some((s) => s.values.some((v) => v !== 0)); }
  total(li: number): number { return this.series.reduce((a, s) => a + (s.values[li] ?? 0), 0); }
  pos(): string { return tipPos((this.center(this.hi() ?? 0) / W) * 100); }

  ax() {
    const n = this.labels.length;
    if (this.stacked) {
      const totals = Array.from({ length: n }, (_, i) => this.series.reduce((a, s) => a + Math.max(0, s.values[i] ?? 0), 0));
      return axis(0, Math.max(...totals, 0));
    }
    const all = this.series.flatMap((s) => s.values);
    return axis(Math.min(...all, 0), Math.max(...all, 0));
  }

  y(v: number): number { const a = this.ax(); return T + (1 - (v - a.lo) / (a.hi - a.lo)) * (H - T - B); }
  fmt(n: number): string { return compact(n); }
  color(s: ChartSeries, i: number): string { return s.color ?? PALETTE[i % PALETTE.length]; }
  showLabel(i: number): boolean { const n = this.labels.length; return n <= 12 || i % Math.ceil(n / 12) === 0; }
  slot(): number { return (W - L - R) / Math.max(1, this.labels.length); }
  center(li: number): number { return L + this.slot() * (li + 0.5); }
  barW(): number { const per = this.stacked ? 1 : this.series.length; return Math.min(46, (this.slot() * 0.72) / per); }
  barX(li: number, si: number): number {
    const per = this.stacked ? 1 : this.series.length;
    return this.center(li) - (this.barW() * per) / 2 + (this.stacked ? 0 : si * this.barW());
  }
  private below(li: number, si: number): number { return this.series.slice(0, si).reduce((a, s) => a + Math.max(0, s.values[li] ?? 0), 0); }
  barY(li: number, si: number): number {
    const v = this.series[si].values[li] ?? 0;
    if (this.stacked) return this.y(this.below(li, si) + Math.max(0, v));
    return v >= 0 ? this.y(v) : this.y(0);
  }
  barH(li: number, si: number): number {
    const v = this.series[si].values[li] ?? 0;
    return Math.max(0, Math.abs(this.y(this.stacked ? this.below(li, si) : 0) - this.y(this.stacked ? this.below(li, si) + Math.max(0, v) : v)));
  }
}

// ---------------------------------------------------------------- donut
@Component({
  selector: 'app-donut-chart',
  standalone: true,
  templateUrl: './donut-chart.component.html',
  styleUrl: './donut-chart.component.css',
})
export class DonutChartComponent {
  @Input() items: ChartItem[] = [];
  @Input() title = '';
  @Input() emptyText = '';

  readonly hi = signal<number | null>(null);

  total(): number { return this.items.reduce((a, i) => a + Math.max(0, i.value), 0); }
  fmt(n: number): string { return compact(n); }

  arcs(): { label: string; value: number; pct: number; color: string; dash: string; offset: number }[] {
    const total = this.total();
    const c = 2 * Math.PI * 42;
    let acc = 0;
    return this.items.filter((i) => i.value > 0).map((i, idx) => {
      const len = (i.value / total) * c;
      const arc = { label: i.label, value: i.value, pct: Math.round((i.value / total) * 100), color: i.color ?? PALETTE[idx % PALETTE.length], dash: `${len} ${c - len}`, offset: -acc };
      acc += len;
      return arc;
    });
  }
}

// ---------------------------------------------------------------- horizontal bars (rankings)
@Component({
  selector: 'app-hbar-chart',
  standalone: true,
  templateUrl: './h-bar-chart.component.html',
  styleUrl: './h-bar-chart.component.css',
})
export class HBarChartComponent {
  @Input() items: ChartItem[] = [];
  @Input() color = PALETTE[0];
  @Input() emptyText = '';

  pct(v: number): number { const m = Math.max(...this.items.map((i) => i.value), 1); return Math.max(2, (v / m) * 100); }
  fmt(n: number): string { return compact(n); }
}

// ---------------------------------------------------------------- sparkline
@Component({
  selector: 'app-sparkline',
  standalone: true,
  templateUrl: './sparkline.component.html',
})
export class SparklineComponent {
  @Input() values: number[] = [];
  @Input() color = PALETTE[0];

  path(): string {
    const v = this.values;
    if (v.length < 2) return '';
    const lo = Math.min(...v);
    const hi = Math.max(...v);
    const span = hi - lo || 1;
    return v.map((n, i) => `${i === 0 ? 'M' : 'L'}${((i / (v.length - 1)) * 100).toFixed(1)},${(26 - ((n - lo) / span) * 24).toFixed(1)}`).join(' ');
  }
}
