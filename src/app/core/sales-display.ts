import { formatMoney, formatSigned, type SalesSummary } from './sales-math';

// Ported from sales.html's render(): the words and numbers in the Sales Tracker's hero, progress
// meter and KPI tiles, worked out from the month's summary. Pure, so the wording is tested directly.

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

export interface SalesStatus {
  kind: 'ahead' | 'behind' | 'done';
  text: string;
}

export interface SalesHero {
  label: string;
  value: string;
  sub: string;
  /** Ahead/behind/goal-hit pill; always words and a sign, never color alone (WCAG 1.4.1). */
  status: SalesStatus | null;
}

export function salesHero(summary: SalesSummary, goal: number): SalesHero {
  if (!goal) {
    return {
      label: 'Needed per selling day',
      value: '—',
      sub: 'Set a goal to get started.',
      status: null,
    };
  }
  if (summary.goalMet) {
    return {
      label: 'Needed per selling day',
      value: formatMoney(0),
      sub: `Goal hit with ${formatMoney(summary.sold - goal)} to spare.`,
      status: { kind: 'done', text: '✓ Goal hit. Everything else is gravy.' },
    };
  }
  if (summary.neededPerDay === null) {
    return {
      label: 'Short of goal',
      value: formatMoney(summary.remaining),
      sub: 'No selling days left in this month.',
      status: null,
    };
  }
  const missing = summary.missingPast
    ? ` · ${plural(summary.missingPast, 'past day')} not entered`
    : '';
  return {
    label: 'Needed per selling day',
    value: formatMoney(summary.neededPerDay),
    sub: `${formatMoney(summary.remaining)} to go over ${plural(summary.openDays, 'selling day')}${missing}`,
    status: paceStatus(summary),
  };
}

// Nothing to compare yet until pace has started or something has been sold.
function paceStatus(summary: SalesSummary): SalesStatus | null {
  if (summary.paceToDate <= 0 && summary.sold <= 0) return null;
  return summary.aheadBy >= 0
    ? { kind: 'ahead', text: `▲ Ahead of pace by ${formatMoney(summary.aheadBy)}` }
    : { kind: 'behind', text: `▼ Behind pace by ${formatMoney(-summary.aheadBy)}` };
}

export interface SalesMeter {
  /** Share of the goal sold, 0-100 (the bar's fill). */
  soldPercent: number;
  /** Where pace says you should be today, 0-100 (the marker). */
  pacePercent: number;
  /** The progress bar's aria-valuenow: soldPercent, rounded. */
  valueNow: number;
  valueText: string;
  soldText: string;
  paceText: string;
}

/** Null with no goal: there's nothing to measure progress against. */
export function salesMeter(summary: SalesSummary, goal: number): SalesMeter | null {
  if (!goal) return null;
  const percent = Math.round(summary.percent);
  const soldPercent = Math.min(100, summary.percent);
  return {
    soldPercent,
    pacePercent: Math.min(100, (summary.paceToDate / goal) * 100),
    valueNow: Math.round(soldPercent),
    valueText: `${percent}% of goal`,
    soldText: `${percent}% of ${formatMoney(goal)}`,
    paceText: `Pace today: ${formatMoney(summary.paceToDate)}`,
  };
}

export interface SalesKpi {
  label: string;
  value: string;
  detail: string;
}

export function salesKpis(summary: SalesSummary, goal: number): SalesKpi[] {
  const entered = summary.enteredSellingDays;
  return [
    {
      label: 'Sold so far',
      value: formatMoney(summary.sold),
      detail: goal ? `${formatMoney(summary.remaining)} left` : '',
    },
    {
      label: 'Daily baseline',
      value: goal ? formatMoney(summary.baseline) : '—',
      detail: `${summary.sellingDays} selling days`,
    },
    {
      label: 'Average per day',
      value: entered ? formatMoney(summary.average) : '—',
      detail: entered ? `over ${plural(entered, 'day')}` : 'no days yet',
    },
    {
      label: 'Month-end at this pace',
      value: entered ? formatMoney(summary.projected) : '—',
      detail: entered && goal ? `${formatSigned(summary.projected - goal)} vs goal` : '',
    },
  ];
}
