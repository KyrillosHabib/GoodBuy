import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, ViewChild } from '@angular/core';
import { Chart, ChartType, registerables } from 'chart.js';

Chart.register(...registerables);

// The colours of the charts (the same order everywhere, so a status keeps its colour)
export const CHART_COLORS = ['#e2743a', '#8b78f0', '#4a7cf7', '#4cb752', '#f5a524', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#64748b'];

export interface ChartSeries {
  label: string;
  data: number[];
  // One colour for a line / bar series. Doughnut and pie get one colour per slice automatically.
  color?: string;
  // In a bar chart: draw THIS series as a line over the bars (bars + line in one chart)
  kind?: 'bar' | 'line';
}

// One chart (line, bar, doughnut, pie, bars with a line over them, or a small sparkline) drawn with Chart.js.
// Give it labels and one or more series. It is drawn again when the data, the type or the direction (right-to-left) changes.
@Component({
  selector: 'app-chart',
  standalone: true,
  templateUrl: './chart.component.html',
  styleUrl: './chart.component.css',
})
export class ChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas', { static: true }) private readonly canvas!: ElementRef<HTMLCanvasElement>;

  @Input() type: ChartType = 'line';
  @Input() labels: string[] = [];
  @Input() series: ChartSeries[] = [];
  @Input() height = 260;
  @Input() rtl = false;
  // Bars drawn horizontally
  @Input() horizontal = false;
  // Line chart: fill the area under the line
  @Input() fill = false;
  // A tiny line with a soft fill and nothing else (for the cards)
  @Input() sparkline = false;

  private chart: Chart | null = null;
  private ready = false;

  ngAfterViewInit(): void {
    this.ready = true;
    this.draw();
  }

  ngOnChanges(): void {
    if (this.ready) this.draw();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private draw(): void {
    this.chart?.destroy();

    const color0 = this.series[0]?.color ?? CHART_COLORS[0];

    // The options differ per chart type (for example `cutout` exists only for a doughnut), so the config is not checked against one type
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let config: any;

    if (this.sparkline) {
      config = {
        type: 'line',
        data: {
          labels: this.labels,
          datasets: [{ data: this.series[0]?.data ?? [], borderColor: color0, backgroundColor: color0 + '26', fill: true, tension: 0.4, pointRadius: 0, borderWidth: 2 }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false } },
        },
      };
    } else {
      const round = this.type === 'doughnut' || this.type === 'pie';
      const text = getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#1f2937';
      const grid = 'rgba(148, 163, 184, .25)';

      const datasets = this.series.map((s, i) => {
        const color = s.color ?? CHART_COLORS[i % CHART_COLORS.length];
        const asLine = s.kind === 'line' || (this.type === 'line' && !s.kind);

        if (round) {
          return { label: s.label, data: s.data, backgroundColor: this.labels.map((_, k) => CHART_COLORS[k % CHART_COLORS.length]), borderWidth: 3, borderColor: '#fff', hoverOffset: 6 };
        }

        return asLine
          ? { type: 'line', label: s.label, data: s.data, borderColor: color, backgroundColor: color + '33', fill: this.fill, tension: 0.4, pointRadius: 0, pointHoverRadius: 5, borderWidth: 3, order: 0 }
          : { type: 'bar', label: s.label, data: s.data, backgroundColor: color, borderRadius: 6, maxBarThickness: 22, order: 1 };
      });

      config = {
        type: this.type,
        data: { labels: this.labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          indexAxis: this.horizontal ? 'y' : 'x',
          interaction: { mode: 'index', intersect: false },
          cutout: this.type === 'doughnut' ? '66%' : undefined,
          plugins: {
            legend: { display: !round && this.series.length > 1, position: 'top', rtl: this.rtl, labels: { color: text, usePointStyle: true, boxWidth: 8 } },
            tooltip: { rtl: this.rtl, textDirection: this.rtl ? 'rtl' : 'ltr', padding: 10, cornerRadius: 10 },
          },
          scales: round
            ? {}
            : {
                x: { ticks: { color: text, maxRotation: 0, autoSkip: true }, grid: { display: false }, reverse: this.rtl && !this.horizontal },
                y: { beginAtZero: true, ticks: { color: text }, grid: { color: grid, borderDash: [3, 3] }, position: this.rtl && !this.horizontal ? 'right' : 'left' },
              },
        },
      };
    }

    this.chart = new Chart(this.canvas.nativeElement, config);
  }
}
