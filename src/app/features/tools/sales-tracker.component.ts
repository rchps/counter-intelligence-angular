import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  Injector,
  signal,
  untracked,
} from '@angular/core';
import {
  formatCents,
  formatMoney,
  formatSigned,
  fromCsv,
  localToday,
  parseMoney,
  shortDate,
  summarize,
  toCsv,
  type MonthRecord,
  type SalesSeriesPoint,
  type SalesStore,
  type SalesSummary,
} from '../../core/sales-math';
import { SalesStoreService } from '../../core/sales-store.service';

interface StatusInfo {
  kind: 'ahead' | 'behind' | 'done';
  text: string;
}

interface ChartTick {
  y: number;
  label: string;
}

interface ChartXLabel {
  x: number;
  label: string;
}

interface ChartPoint {
  x: number;
  y: number;
  text: string;
}

interface ChartLayout {
  width: number;
  height: number;
  plotTop: number;
  ticks: ChartTick[];
  xLabels: ChartXLabel[];
  pacePath: string;
  actualPath: string;
  areaPath: string;
  goalLabel: ChartPoint | null;
  endDot: { x: number; y: number } | null;
  endLabel: ChartPoint | null;
  points: SalesSeriesPoint[];
  x: (index: number) => number;
  y: (value: number) => number;
}

interface TipData {
  title: string;
  thatDay: string;
  runningTotal: string | null;
  goalPace: string | null;
  crossX: number;
}

const pad = (n: number): string => String(n).padStart(2, '0');
const EMPTY_MONTH: MonthRecord = { goal: null, sales: {}, overrides: {} };
const CHART_HEIGHT = 240;
const CHART_PAD = { left: 56, right: 76, top: 12, bottom: 26 };

const compactMoney = (value: number): string =>
  value >= 1000
    ? '$' + (value / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'k'
    : '$' + value;

// Ported from sales.html. Pure math (monthDays/isSellingDay/summarize/parseMoney/toCsv/fromCsv) lives in
// core/sales-math.ts; this component owns only the page's own state (which month, raw input text,
// the save indicator) and formatting glue.
@Component({
  selector: 'app-sales-tracker',
  templateUrl: './sales-tracker.component.html',
  styleUrl: './sales-tracker.component.scss',
})
export class SalesTrackerComponent {
  private readonly salesStore = inject(SalesStoreService);
  private readonly elementRef: ElementRef<HTMLElement> = inject(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly today = localToday();
  protected readonly weekdayHeads = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  protected readonly month = signal(this.today.slice(0, 7));
  private readonly store = signal<SalesStore>(this.salesStore.load());

  protected readonly goalText = signal('');
  protected readonly goalInvalid = signal(false);
  protected readonly todayText = signal('');
  protected readonly todayInvalid = signal(false);
  protected readonly dayTexts = signal<Record<string, string>>({});
  protected readonly dayInvalid = signal<Record<string, boolean>>({});

  protected readonly savedMessage = signal(
    this.salesStore.isAvailable()
      ? 'Saved on this computer only. Nothing is sent anywhere.'
      : "This browser won't save (private window?). Export a CSV before you close the page.",
  );
  protected readonly savedIsWarning = signal(!this.salesStore.isAvailable());

  protected readonly isThisMonth = computed(() => this.today.slice(0, 7) === this.month());
  protected readonly todayLabel = computed(() => `Today's sales · ${shortDate(this.today)}`);

  private readonly monthData = computed<MonthRecord>(
    () => this.store().months[this.month()] ?? EMPTY_MONTH,
  );
  protected readonly goal = computed(() => this.monthData().goal || 0);

  protected readonly summary = computed<SalesSummary>(() => {
    const data = this.monthData();
    return summarize({
      month: this.month(),
      goal: data.goal || 0,
      sales: data.sales,
      overrides: data.overrides,
      today: this.today,
    });
  });

  protected readonly leadingBlanks = computed(() => {
    const days = this.summary().days;
    return days.length ? (days[0].weekday + 6) % 7 : 0;
  });
  protected readonly blankRange = computed(() => Array.from({ length: this.leadingBlanks() }));

  // ---- Hero ----
  protected readonly heroLabel = computed(() => {
    const summary = this.summary();
    return this.goal() && !summary.goalMet && summary.neededPerDay === null
      ? 'Short of goal'
      : 'Needed per selling day';
  });

  protected readonly heroValue = computed(() => {
    const goal = this.goal();
    const summary = this.summary();
    if (!goal) return '—';
    if (summary.goalMet) return formatMoney(0);
    if (summary.neededPerDay === null) return formatMoney(summary.remaining);
    return formatMoney(summary.neededPerDay);
  });

  protected readonly heroSub = computed(() => {
    const goal = this.goal();
    const summary = this.summary();
    if (!goal) return 'Set a goal to get started.';
    if (summary.goalMet) return `Goal hit with ${formatMoney(summary.sold - goal)} to spare.`;
    if (summary.neededPerDay === null) return 'No selling days left in this month.';
    const openDaysText = `${summary.openDays} selling day${summary.openDays === 1 ? '' : 's'}`;
    const missingText = summary.missingPast
      ? ` · ${summary.missingPast} past day${summary.missingPast === 1 ? '' : 's'} not entered`
      : '';
    return `${formatMoney(summary.remaining)} to go over ${openDaysText}${missingText}`;
  });

  protected readonly status = computed<StatusInfo | null>(() => {
    const goal = this.goal();
    const summary = this.summary();
    if (!goal) return null;
    if (summary.goalMet) return { kind: 'done', text: '✓ Goal hit. Everything else is gravy.' };
    if (summary.neededPerDay === null) return null;
    if (summary.paceToDate <= 0 && summary.sold <= 0) return null;
    const ahead = summary.aheadBy >= 0;
    return {
      kind: ahead ? 'ahead' : 'behind',
      text: ahead
        ? `▲ Ahead of pace by ${formatMoney(summary.aheadBy)}`
        : `▼ Behind pace by ${formatMoney(-summary.aheadBy)}`,
    };
  });

  // ---- Meter ----
  protected readonly showMeter = computed(() => this.goal() > 0);
  protected readonly meterSoldPercent = computed(() => Math.min(100, this.summary().percent));
  protected readonly meterPacePercent = computed(() => {
    const goal = this.goal();
    return goal ? Math.min(100, (this.summary().paceToDate / goal) * 100) : 0;
  });
  protected readonly meterValueNow = computed(() => Math.round(this.meterSoldPercent()));
  protected readonly meterValueText = computed(
    () => `${Math.round(this.summary().percent)}% of goal`,
  );
  protected readonly meterSoldText = computed(
    () => `${Math.round(this.summary().percent)}% of ${formatMoney(this.goal())}`,
  );
  protected readonly meterPaceText = computed(
    () => `Pace today: ${formatMoney(this.summary().paceToDate)}`,
  );

  // ---- KPIs ----
  protected readonly kpiSold = computed(() => formatMoney(this.summary().sold));
  protected readonly kpiSoldDetail = computed(() =>
    this.goal() ? `${formatMoney(this.summary().remaining)} left` : '',
  );
  protected readonly kpiBaseline = computed(() =>
    this.goal() ? formatMoney(this.summary().baseline) : '—',
  );
  protected readonly kpiBaselineDetail = computed(
    () => `${this.summary().sellingDays} selling days`,
  );
  protected readonly kpiAverage = computed(() =>
    this.summary().enteredSellingDays ? formatMoney(this.summary().average) : '—',
  );
  protected readonly kpiAverageDetail = computed(() => {
    const n = this.summary().enteredSellingDays;
    return n ? `over ${n} day${n === 1 ? '' : 's'}` : 'no days yet';
  });
  protected readonly kpiProjected = computed(() =>
    this.summary().enteredSellingDays ? formatMoney(this.summary().projected) : '—',
  );
  protected readonly kpiProjectedDetail = computed(() => {
    const summary = this.summary();
    const goal = this.goal();
    return summary.enteredSellingDays && goal
      ? `${formatSigned(summary.projected - goal)} vs goal`
      : '';
  });

  // ---- Chart: cumulative sales vs goal pace ----
  protected readonly chartWidth = signal(800);
  protected readonly hasChartData = computed(() => this.goal() > 0 || this.summary().sold > 0);

  protected readonly chartLayout = computed<ChartLayout | null>(() => {
    if (!this.hasChartData()) return null;
    const width = this.chartWidth();
    const plotW = width - CHART_PAD.left - CHART_PAD.right;
    const plotH = CHART_HEIGHT - CHART_PAD.top - CHART_PAD.bottom;
    const summary = this.summary();
    const goal = this.goal();
    const points = summary.series;
    const top = Math.max(goal, summary.projected || 0, summary.sold || 0, 1) * 1.08;
    const x = (i: number): number =>
      CHART_PAD.left + (points.length > 1 ? (i / (points.length - 1)) * plotW : 0);
    const y = (v: number): number => CHART_PAD.top + plotH - (v / top) * plotH;

    const rawStep = top / 4;
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const niceStep =
      [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? magnitude * 10;
    const ticks: ChartTick[] = [];
    for (let v = 0; v <= top; v += niceStep) ticks.push({ y: y(v), label: compactMoney(v) });

    const xLabels: ChartXLabel[] = [];
    points.forEach((p, i) => {
      if (i === 0 || i === points.length - 1 || (p.day % 7 === 1 && points.length - p.day > 2)) {
        xLabels.push({ x: x(i), label: String(p.day) });
      }
    });

    const pacePath =
      goal > 0 ? points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.pace)}`).join('') : '';
    // Actual days are always a prefix of the month, so an index into `shown` is also an index into
    // `points` — sales.html relies on the same thing.
    const shown = points.filter((p) => p.showActual);
    const lastIndex = shown.length - 1;
    const actualPath = shown.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.sold)}`).join('');
    const areaPath = `${actualPath}L${x(lastIndex)},${y(0)}L${x(0)},${y(0)}Z`;
    const last = shown[lastIndex];
    const endDot = last && summary.sold > 0 ? { x: x(lastIndex), y: y(last.sold) } : null;

    return {
      width,
      height: CHART_HEIGHT,
      plotTop: CHART_PAD.top,
      ticks,
      xLabels,
      pacePath,
      actualPath: shown.length > 1 ? actualPath : '',
      areaPath: shown.length > 1 ? areaPath : '',
      goalLabel:
        goal > 0
          ? { x: width - CHART_PAD.right + 8, y: y(goal) + 4, text: `Goal ${compactMoney(goal)}` }
          : null,
      endDot,
      endLabel: endDot
        ? { x: endDot.x + 8, y: endDot.y - 8, text: compactMoney(Math.round(last.sold)) }
        : null,
      points,
      x,
      y,
    };
  });

  protected readonly chartPlotBottom = computed(() => CHART_HEIGHT - CHART_PAD.bottom);
  protected readonly chartRightEdge = computed(() => this.chartWidth() - CHART_PAD.right);
  protected readonly chartLeftEdge = CHART_PAD.left;

  protected readonly chartDescription = computed(() => {
    const goal = this.goal();
    return goal
      ? `Running total ${formatMoney(this.summary().sold)} against a goal pace reaching ${formatMoney(goal)} by month end. ` +
          'Use the left and right arrow keys to read each day, or show the table.'
      : 'Set a goal to see the goal pace.';
  });

  protected readonly focusIndex = signal<number | null>(null);

  protected readonly tip = computed<TipData | null>(() => {
    const layout = this.chartLayout();
    const index = this.focusIndex();
    if (!layout || index === null || index >= layout.points.length) return null;
    const point = layout.points[index];
    return {
      title: shortDate(point.date),
      thatDay: point.sales === null ? '—' : formatCents(point.sales),
      runningTotal: point.showActual ? formatMoney(point.sold) : null,
      goalPace: point.pace ? formatMoney(point.pace) : null,
      crossX: layout.x(index),
    };
  });

  // Positioned as a share of the SVG's own width, so it tracks the crosshair at any rendered size.
  protected readonly tipLeftPercent = computed(() => {
    const tip = this.tip();
    return tip ? (tip.crossX / this.chartWidth()) * 100 : 0;
  });

  protected readonly showDayTable = signal(false);

  // ---- Weekly breakdown / stats / tools ----
  protected readonly toolsMessage = signal('');
  protected readonly clearArmed = signal(false);
  private clearTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    // Calendar/goal/today display text resets to match the newly-viewed month's stored data — but only
    // on a month change, not on every keystroke (sales.html's buildCalendar() has the same boundary).
    effect(() => {
      const month = this.month();
      untracked(() => this.resetTextsForMonth(month));
    });

    // The chart only exists once there's something to plot (and is removed again if that goes away), so
    // its resize observer follows the element in and out rather than attaching once at startup.
    effect((onCleanup) => {
      if (!this.hasChartData()) return;
      let observer: ResizeObserver | null = null;
      const render = afterNextRender(() => (observer = this.attachChartResizeObserver()), {
        injector: this.injector,
      });
      onCleanup(() => {
        render.destroy();
        observer?.disconnect();
      });
    });

    // Confetti: once per month, the moment the goal is first hit (not on every visit).
    effect(() => {
      if (this.summary().goalMet && !this.monthData().celebrated) {
        untracked(() => this.celebrateOnce());
      }
    });
  }

  private attachChartResizeObserver(): ResizeObserver | null {
    const chartBox = this.elementRef.nativeElement.querySelector<HTMLElement>('.sl-chart');
    if (!chartBox) return null;
    this.chartWidth.set(Math.max(320, chartBox.clientWidth || 800));
    try {
      const observer = new ResizeObserver(() => {
        if (chartBox.clientWidth) this.chartWidth.set(Math.max(320, chartBox.clientWidth));
      });
      observer.observe(chartBox);
      return observer;
    } catch {
      return null; // older browsers: the chart just keeps its first size
    }
  }

  protected showTip(index: number): void {
    const layout = this.chartLayout();
    if (!layout) return;
    this.focusIndex.set(Math.max(0, Math.min(layout.points.length - 1, index)));
  }

  protected hideTip(): void {
    this.focusIndex.set(null);
  }

  protected onChartPointerMove(event: PointerEvent): void {
    const layout = this.chartLayout();
    if (!layout) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const px = (event.clientX - rect.left) * (layout.width / rect.width);
    const plotW = layout.width - CHART_PAD.left - CHART_PAD.right;
    this.showTip(Math.round(((px - CHART_PAD.left) / plotW) * (layout.points.length - 1)));
  }

  protected onChartKeydown(event: KeyboardEvent): void {
    const layout = this.chartLayout();
    if (!layout) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      this.showTip((this.focusIndex() ?? -1) + (event.key === 'ArrowRight' ? 1 : -1));
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      this.showTip(event.key === 'Home' ? 0 : layout.points.length - 1);
    }
  }

  protected weekRange(start: string, end: string): string {
    return `${this.dayLabel(start)}–${this.dayLabel(end)}`;
  }

  protected formatMoney(value: number): string {
    return formatMoney(value);
  }

  protected formatCents(value: number): string {
    return formatCents(value);
  }

  protected formatSigned(value: number): string {
    return formatSigned(value);
  }

  // ---- Export / import / clear ----
  protected exportCsv(): void {
    const blob = new Blob([toCsv(this.store())], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `sales-tracker-${localToday()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    this.toolsMessage.set('Exported. Keep the file somewhere safe; it has your sales numbers.');
  }

  protected async onImportFile(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const imported = fromCsv(await file.text());
    const keys = Object.keys(imported.months);
    const months = { ...this.store().months };
    for (const key of keys) {
      const existing = months[key] ?? EMPTY_MONTH;
      const incoming = imported.months[key];
      months[key] = {
        ...existing,
        goal: incoming.goal !== null ? incoming.goal : existing.goal,
        sales: { ...existing.sales, ...incoming.sales },
        overrides: { ...existing.overrides, ...incoming.overrides },
      };
    }
    input.value = '';
    this.replaceStore({ months });
    this.resetTextsForMonth(this.month());
    this.toolsMessage.set(
      keys.length
        ? `Imported ${keys.length} month${keys.length === 1 ? '' : 's'}.`
        : 'Nothing to import in that file.',
    );
  }

  // Two-step clear (no pop-up): first press arms it, second press clears.
  protected onClearClick(): void {
    clearTimeout(this.clearTimer);
    if (!this.clearArmed()) {
      this.clearArmed.set(true);
      this.clearTimer = setTimeout(() => this.clearArmed.set(false), 4000);
      return;
    }
    this.clearArmed.set(false);
    const months = { ...this.store().months };
    delete months[this.month()];
    this.replaceStore({ months });
    this.resetTextsForMonth(this.month());
    this.toolsMessage.set('This month is cleared.');
  }

  // Skipped for people who ask for reduced motion; the "Goal hit" message still shows.
  private celebrateOnce(): void {
    this.updateMonth((data) => ({ ...data, celebrated: true }));
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this.launchConfetti();
  }

  private launchConfetti(): void {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText =
      'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:60';
    document.body.appendChild(canvas);
    const ratio = window.devicePixelRatio || 1;
    canvas.width = innerWidth * ratio;
    canvas.height = innerHeight * ratio;
    const context = canvas.getContext('2d');
    if (!context) {
      canvas.remove();
      return;
    }
    context.scale(ratio, ratio);

    // The page's own palette (Radix steps used elsewhere), so it looks like it belongs.
    const colors = ['#46a758', '#0090ff', '#ffc53d', '#e5484d', '#6e56cf', '#12a594', '#d6409f'];
    const pieces = Array.from({ length: 160 }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.3,
      y: innerHeight * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 14 - 6,
      size: 6 + Math.random() * 6,
      spin: Math.random() * Math.PI,
      spinSpeed: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    const started = performance.now();
    const duration = 3200;

    const frame = (now: number): void => {
      const elapsed = now - started;
      context.clearRect(0, 0, innerWidth, innerHeight);
      context.globalAlpha = Math.max(0, 1 - Math.max(0, elapsed - duration + 800) / 800);
      for (const piece of pieces) {
        piece.vy += 0.35; // gravity
        piece.vx *= 0.99; // air
        piece.x += piece.vx;
        piece.y += piece.vy;
        piece.spin += piece.spinSpeed;
        context.save();
        context.translate(piece.x, piece.y);
        context.rotate(piece.spin);
        context.fillStyle = piece.color;
        context.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2);
        context.restore();
      }
      if (elapsed < duration) requestAnimationFrame(frame);
      else canvas.remove();
    };
    requestAnimationFrame(frame);
  }

  private resetTextsForMonth(month: string): void {
    const data = this.store().months[month] ?? EMPTY_MONTH;
    this.goalText.set(data.goal ? data.goal.toLocaleString('en-US') : '');
    this.todayText.set(
      this.today.slice(0, 7) === month && this.today in data.sales
        ? String(data.sales[this.today])
        : '',
    );
    const texts: Record<string, string> = {};
    for (const [date, value] of Object.entries(data.sales)) texts[date] = String(value);
    this.dayTexts.set(texts);
    this.goalInvalid.set(false);
    this.todayInvalid.set(false);
    this.dayInvalid.set({});
  }

  private updateMonth(fn: (data: MonthRecord) => MonthRecord): void {
    const month = this.month();
    const current = this.store().months[month] ?? EMPTY_MONTH;
    this.replaceStore({ months: { ...this.store().months, [month]: fn(current) } });
  }

  private replaceStore(next: SalesStore): void {
    this.store.set(next);
    const saved = this.salesStore.save(next);
    this.savedIsWarning.set(!saved);
    this.savedMessage.set(
      saved
        ? `✓ Saved on this computer at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}. Only you can see it.`
        : "This browser won't save (private window?). Export a CSV before you close the page.",
    );
  }

  // Returns whether the text was invalid (mirrors sales.html's readMoneyInto: bad input is rejected
  // and never saved; a blank box is valid and clears that day's entry).
  private commitSales(date: string, text: string): boolean {
    const parsed = parseMoney(text);
    if (Number.isNaN(parsed)) return true;
    this.updateMonth((data) => {
      const sales = { ...data.sales };
      if (parsed === null) delete sales[date];
      else sales[date] = parsed;
      return { ...data, sales };
    });
    return false;
  }

  protected onMonthInputChange(value: string): void {
    if (/^\d{4}-\d{2}$/.test(value)) this.month.set(value);
  }

  protected shiftMonth(by: number): void {
    const [year, monthNumber] = this.month().split('-').map(Number);
    const moved = new Date(year, monthNumber - 1 + by, 1);
    this.month.set(`${moved.getFullYear()}-${pad(moved.getMonth() + 1)}`);
  }

  protected onGoalInput(value: string): void {
    this.goalText.set(value);
    const parsed = parseMoney(value);
    const bad = Number.isNaN(parsed);
    this.goalInvalid.set(bad);
    if (bad) return;
    this.updateMonth((data) => ({ ...data, goal: parsed }));
  }

  protected onGoalBlur(): void {
    const goal = this.monthData().goal;
    this.goalText.set(goal ? goal.toLocaleString('en-US') : '');
  }

  protected onTodayInput(value: string): void {
    this.todayText.set(value);
    this.dayTexts.update((texts) => ({ ...texts, [this.today]: value }));
    const bad = this.commitSales(this.today, value);
    this.todayInvalid.set(bad);
    this.dayInvalid.update((map) => ({ ...map, [this.today]: bad }));
  }

  protected onTodayBlur(): void {
    const value = this.monthData().sales[this.today];
    this.todayText.set(value !== undefined ? String(value) : '');
  }

  protected onDayInput(date: string, value: string): void {
    this.dayTexts.update((texts) => ({ ...texts, [date]: value }));
    const bad = this.commitSales(date, value);
    this.dayInvalid.update((map) => ({ ...map, [date]: bad }));
    if (date === this.today) {
      this.todayText.set(value);
      this.todayInvalid.set(bad);
    }
  }

  // Enter jumps to the next selling day's box (fast end-of-week catch-up).
  protected onDayEnter(event: Event, date: string): void {
    event.preventDefault();
    const next = this.summary().days.find((day) => day.date > date && day.selling);
    if (!next) return;
    this.elementRef.nativeElement.querySelector<HTMLInputElement>(`#sl-day-${next.date}`)?.focus();
  }

  protected toggleSellingDay(date: string): void {
    const day = this.summary().days.find((d) => d.date === date);
    if (!day) return;
    const nowSelling = !day.selling;
    const byDefault = day.weekday >= 1 && day.weekday <= 5;
    this.updateMonth((data) => {
      const overrides = { ...data.overrides };
      if (nowSelling === byDefault) delete overrides[date];
      else overrides[date] = nowSelling;
      return { ...data, overrides };
    });
  }

  protected dayLabel(date: string): string {
    return shortDate(date).replace(/^\w+, /, '');
  }

  protected dayFullLabel(date: string): string {
    return shortDate(date);
  }

  protected hitText(day: { sales: number | null; selling: boolean }): string {
    const baseline = this.summary().baseline;
    if (day.sales === null || !day.selling || !baseline) return '';
    return day.sales >= baseline ? '✓ at baseline' : `${formatMoney(baseline - day.sales)} under`;
  }
}
