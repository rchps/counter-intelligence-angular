import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  signal,
} from '@angular/core';
import { dayIndexAt, salesChartLayout } from '../../core/sales-chart';
import { formatDollarsAndCents, formatWholeDollars } from '../../core/money';
import { shortDate, type SalesSeriesPoint } from '../../core/sales-math';

interface Tip {
  title: string;
  thatDay: string;
  runningTotal: string | null;
  goalPace: string | null;
  x: number;
}

// The running total against the goal pace as an SVG line
// chart, with a crosshair tooltip that follows the pointer and the arrow/Home/End keys. The geometry
// is core/sales-chart.ts; this component measures its own width, draws, and handles interaction.
@Component({
  selector: 'app-sales-chart',
  templateUrl: './sales-chart.component.html',
  styleUrl: './sales-chart.component.scss',
})
export class SalesChartComponent {
  readonly series = input.required<SalesSeriesPoint[]>();
  readonly goal = input.required<number>();
  readonly sold = input.required<number>();
  readonly projected = input.required<number>();
  /** Id of the heading that names the chart, for aria-labelledby. */
  readonly labelledBy = input.required<string>();

  private readonly elementRef: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly injector = inject(Injector);

  private readonly width = signal(800);
  private readonly focusIndex = signal<number | null>(null);

  protected readonly hasData = computed(() => this.goal() > 0 || this.sold() > 0);

  protected readonly layout = computed(() =>
    this.hasData()
      ? salesChartLayout({
          series: this.series(),
          goal: this.goal(),
          sold: this.sold(),
          projected: this.projected(),
          width: this.width(),
        })
      : null,
  );

  protected readonly description = computed(() => {
    const goal = this.goal();
    return goal
      ? `Running total ${formatWholeDollars(this.sold())} against a goal pace reaching ${formatWholeDollars(goal)} by month end. ` +
          'Use the left and right arrow keys to read each day, or show the table.'
      : 'Set a goal to see the goal pace.';
  });

  protected readonly tip = computed<Tip | null>(() => {
    const layout = this.layout();
    const index = this.focusIndex();
    if (!layout || index === null || index >= layout.points.length) return null;
    const point = layout.points[index];
    return {
      title: shortDate(point.date),
      thatDay: point.sales === null ? '—' : formatDollarsAndCents(point.sales),
      runningTotal: point.showActual ? formatWholeDollars(point.sold) : null,
      goalPace: point.pace ? formatWholeDollars(point.pace) : null,
      x: layout.xOf(index),
    };
  });

  // As a share of the chart's width, so the tooltip tracks the crosshair at any rendered size.
  protected readonly tipLeftPercent = computed(() => {
    const tip = this.tip();
    return tip ? (tip.x / this.width()) * 100 : 0;
  });

  constructor() {
    // The chart element only exists while there's something to plot, so the resize observer attaches
    // after it renders and detaches when it goes away.
    effect((onCleanup) => {
      if (!this.hasData()) return;
      let observer: ResizeObserver | null = null;
      const render = afterNextRender(() => (observer = this.observeWidth()), {
        injector: this.injector,
      });
      onCleanup(() => {
        render.destroy();
        observer?.disconnect();
      });
    });
  }

  private observeWidth(): ResizeObserver | null {
    const chart = this.elementRef.nativeElement.querySelector<HTMLElement>('.sl-chart');
    if (!chart) return null;
    this.width.set(Math.max(320, chart.clientWidth || 800));
    try {
      const observer = new ResizeObserver(() => {
        if (chart.clientWidth) this.width.set(Math.max(320, chart.clientWidth));
      });
      observer.observe(chart);
      return observer;
    } catch {
      return null; // older browsers: the chart just keeps its first size
    }
  }

  protected showTip(index: number): void {
    const layout = this.layout();
    if (!layout) return;
    this.focusIndex.set(Math.max(0, Math.min(layout.points.length - 1, index)));
  }

  protected hideTip(): void {
    this.focusIndex.set(null);
  }

  protected onPointerMove(event: PointerEvent): void {
    const layout = this.layout();
    if (!layout) return;
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const viewBoxX = (event.clientX - box.left) * (layout.width / box.width);
    this.showTip(dayIndexAt(layout, viewBoxX));
  }

  protected onKeydown(event: KeyboardEvent): void {
    const layout = this.layout();
    if (!layout) return;
    const current = this.focusIndex() ?? -1;
    const lastDay = layout.points.length - 1;
    const targets: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowLeft: current - 1,
      Home: 0,
      End: lastDay,
    };
    if (!(event.key in targets)) return;
    event.preventDefault();
    this.showTip(targets[event.key]);
  }
}
