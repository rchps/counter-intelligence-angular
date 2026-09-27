import type { SalesSeriesPoint } from './sales-math';

// The geometry of the "sales vs goal pace" line chart, as plain
// numbers and SVG path strings, so the component only has to draw them. Coordinates are in the SVG's
// viewBox: `width` wide (the chart's rendered width) by CHART_HEIGHT tall.

export const CHART_HEIGHT = 240;
export const CHART_PAD = { left: 56, right: 76, top: 12, bottom: 26 };

export interface ChartText {
  x: number;
  y: number;
  text: string;
}

export interface SalesChartInput {
  series: SalesSeriesPoint[];
  goal: number;
  sold: number;
  projected: number;
  /** Rendered width in pixels; the viewBox matches it so text isn't stretched. */
  width: number;
}

export interface SalesChartLayout {
  width: number;
  height: number;
  plotLeft: number;
  plotRight: number;
  plotTop: number;
  plotBottom: number;
  /** Horizontal grid lines and their dollar labels. */
  ticks: { y: number; label: string }[];
  /** Day numbers along the bottom. */
  dayLabels: { x: number; label: string }[];
  /** Dashed goal-pace line; empty with no goal. */
  pacePath: string;
  /** Running-total line and the area under it; empty until two or more days are plotted. */
  actualPath: string;
  areaPath: string;
  goalLabel: ChartText | null;
  endDot: { x: number; y: number } | null;
  endLabel: ChartText | null;
  points: SalesSeriesPoint[];
  /** Horizontal position of day `index` (0-based). */
  xOf: (index: number) => number;
}

/** "$950", "$12.5k" */
export function compactMoney(value: number): string {
  return value >= 1000
    ? '$' + (value / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 }) + 'k'
    : '$' + value;
}

// A round step (1, 2, 2.5, 5 or 10 times a power of ten) giving about four grid lines up to `top`.
export function niceStep(top: number): number {
  const rawStep = top / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  // 10 x magnitude always covers rawStep, so the fallback never runs; it only satisfies the type.
  return (
    [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((step) => step >= rawStep) ?? magnitude * 10
  );
}

export function salesChartLayout({
  series,
  goal,
  sold,
  projected,
  width,
}: SalesChartInput): SalesChartLayout {
  const plotLeft = CHART_PAD.left;
  const plotRight = width - CHART_PAD.right;
  const plotTop = CHART_PAD.top;
  const plotBottom = CHART_HEIGHT - CHART_PAD.bottom;
  const plotWidth = plotRight - plotLeft;
  const plotHeight = plotBottom - plotTop;

  // Headroom above the biggest number the chart has to show.
  const top = Math.max(goal, projected || 0, sold || 0, 1) * 1.08;
  const xOf = (index: number): number =>
    plotLeft + (series.length > 1 ? (index / (series.length - 1)) * plotWidth : 0);
  const yOf = (value: number): number => plotBottom - (value / top) * plotHeight;

  const ticks: SalesChartLayout['ticks'] = [];
  const step = niceStep(top);
  for (let value = 0; value <= top; value += step) {
    ticks.push({ y: yOf(value), label: compactMoney(value) });
  }

  // First and last day, plus every 8th/15th/22nd/29th unless it would crowd the last day's label.
  const dayLabels: SalesChartLayout['dayLabels'] = [];
  series.forEach((point, index) => {
    const isEnd = index === 0 || index === series.length - 1;
    const isWeekMark = point.day % 7 === 1 && series.length - point.day > 2;
    if (isEnd || isWeekMark) dayLabels.push({ x: xOf(index), label: String(point.day) });
  });

  const lineThrough = (values: number[]): string =>
    values.map((value, index) => `${index ? 'L' : 'M'}${xOf(index)},${yOf(value)}`).join('');

  // Days with actual sales are always a prefix of the month (through the last day entered, or
  // today), so an index into `shown` is also an index into `series`.
  const shown = series.filter((point) => point.showActual);
  const lastIndex = shown.length - 1;
  const last = shown[lastIndex];
  const hasLine = shown.length > 1;
  const actualPath = hasLine ? lineThrough(shown.map((point) => point.sold)) : '';
  const endDot = last && sold > 0 ? { x: xOf(lastIndex), y: yOf(last.sold) } : null;

  return {
    width,
    height: CHART_HEIGHT,
    plotLeft,
    plotRight,
    plotTop,
    plotBottom,
    ticks,
    dayLabels,
    pacePath: goal > 0 ? lineThrough(series.map((point) => point.pace)) : '',
    actualPath,
    areaPath: hasLine ? `${actualPath}L${xOf(lastIndex)},${yOf(0)}L${xOf(0)},${yOf(0)}Z` : '',
    goalLabel:
      goal > 0 ? { x: plotRight + 8, y: yOf(goal) + 4, text: `Goal ${compactMoney(goal)}` } : null,
    endDot,
    endLabel: endDot
      ? { x: endDot.x + 8, y: endDot.y - 8, text: compactMoney(Math.round(last.sold)) }
      : null,
    points: series,
    xOf,
  };
}

/** The day nearest a horizontal position in viewBox units, clamped to the month. */
export function dayIndexAt(layout: SalesChartLayout, x: number): number {
  const ratio = (x - layout.plotLeft) / (layout.plotRight - layout.plotLeft);
  const index = Math.round(ratio * (layout.points.length - 1));
  return Math.max(0, Math.min(layout.points.length - 1, index));
}
