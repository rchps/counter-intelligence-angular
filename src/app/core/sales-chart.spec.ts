import { summarize } from './sales-math';
import {
  CHART_HEIGHT,
  CHART_PAD,
  compactMoney,
  dayIndexAt,
  niceStep,
  salesChartLayout,
  type SalesChartInput,
} from './sales-chart';

// September 2026 (30 days), goal $44,000, $1,000 a day entered for Sep 1-4; "today" is Sep 4.
const SUMMARY = summarize({
  month: '2026-09',
  goal: 44000,
  sales: { '2026-09-01': 1000, '2026-09-02': 1000, '2026-09-03': 1000, '2026-09-04': 1000 },
  today: '2026-09-04',
});
const INPUT: SalesChartInput = {
  series: SUMMARY.series,
  goal: 44000,
  sold: SUMMARY.sold,
  projected: SUMMARY.projected,
  width: 800,
};

describe('compactMoney / niceStep', () => {
  it('abbreviates thousands', () => {
    expect(compactMoney(950)).toBe('$950');
    expect(compactMoney(12500)).toBe('$12.5k');
  });

  it('picks a round step giving about four grid lines', () => {
    expect(niceStep(47520)).toBe(20000);
    expect(niceStep(1000)).toBe(250);
  });
});

describe('salesChartLayout', () => {
  const layout = salesChartLayout(INPUT);

  it('spans the plot area inside the padding', () => {
    expect(layout.xOf(0)).toBe(CHART_PAD.left);
    expect(layout.xOf(29)).toBe(800 - CHART_PAD.right);
    expect(layout.plotBottom).toBe(CHART_HEIGHT - CHART_PAD.bottom);
  });

  it('labels grid lines from $0 up in round steps', () => {
    expect(layout.ticks.map((tick) => tick.label)).toEqual(['$0', '$20k', '$40k']);
  });

  it('labels the first and last day and each week mark that does not crowd the last', () => {
    expect(layout.dayLabels.map((label) => label.label)).toEqual(['1', '8', '15', '22', '30']);
  });

  it('draws the goal pace, the running total through today, and labels both ends', () => {
    expect(layout.pacePath.startsWith(`M${CHART_PAD.left},`)).toBe(true);
    expect(layout.actualPath.split('L')).toHaveLength(4); // Sep 1-4
    expect(layout.areaPath.endsWith('Z')).toBe(true);
    expect(layout.goalLabel?.text).toBe('Goal $44k');
    expect(layout.endLabel?.text).toBe('$4k');
  });

  it('draws no pace line without a goal, and no running-total line for a single day', () => {
    const oneDay = summarize({
      month: '2026-09',
      goal: 0,
      sales: { '2026-09-01': 500 },
      today: '2026-09-01',
    });
    const bare = salesChartLayout({ ...INPUT, series: oneDay.series, goal: 0, sold: 500 });
    expect(bare.pacePath).toBe('');
    expect(bare.goalLabel).toBeNull();
    expect(bare.actualPath).toBe('');
    expect(bare.endLabel?.text).toBe('$500');
  });
});

describe('dayIndexAt', () => {
  const layout = salesChartLayout(INPUT);

  it('finds the nearest day and clamps outside the plot', () => {
    expect(dayIndexAt(layout, layout.xOf(10) + 3)).toBe(10);
    expect(dayIndexAt(layout, 0)).toBe(0);
    expect(dayIndexAt(layout, 5000)).toBe(29);
  });
});
