// Ported from counter-intelligence/sales.html `window.SDS_SALES`. Names and behavior are unchanged;
// only types were added. See sales-math.spec.ts for the hand-worked worked example this is checked against.

const pad = (n: number) => String(n).padStart(2, '0');

export interface MonthDay {
  date: string;
  day: number;
  weekday: number;
}

// Every day of a month ("2026-09"): date string, day number, weekday (0 = Sunday).
export function monthDays(month: string): MonthDay[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const count = new Date(year, monthNumber, 0).getDate();
  return Array.from({ length: count }, (_, i) => {
    const day = i + 1;
    return {
      date: `${month}-${pad(day)}`,
      day,
      weekday: new Date(year, monthNumber - 1, day).getDay(),
    };
  });
}

// Monday-Friday by default; a saved override (true/false) wins.
export function isSellingDay(day: MonthDay, overrides?: Record<string, boolean>): boolean {
  if (overrides && day.date in overrides) return overrides[day.date];
  return day.weekday >= 1 && day.weekday <= 5;
}

export interface SummarizeInput {
  month: string;
  goal: number;
  sales?: Record<string, number>;
  overrides?: Record<string, boolean>;
  today: string;
}

export interface DaySummary extends MonthDay {
  selling: boolean;
  sales: number | null;
}

export interface WeekSummary {
  days: DaySummary[];
  start: string;
  end: string;
  sellingDays: number;
  target: number;
  sold: number;
  difference: number;
  hasSales: boolean;
}

export interface SalesSeriesPoint {
  date: string;
  day: number;
  sales: number | null;
  sold: number;
  pace: number;
  showActual: boolean;
}

export interface SalesSummary {
  days: DaySummary[];
  sellingDays: number;
  baseline: number;
  sold: number;
  remaining: number;
  percent: number;
  openDays: number;
  missingPast: number;
  neededPerDay: number | null;
  paceToDate: number;
  aheadBy: number;
  average: number;
  enteredSellingDays: number;
  projected: number;
  best: DaySummary | null;
  worst: DaySummary | null;
  daysAtBaseline: number;
  weeks: WeekSummary[];
  series: SalesSeriesPoint[];
  goalMet: boolean;
}

// Everything the page shows, from the month, goal, entered sales, selling-day overrides and today's date.
//   baseline      = goal ÷ selling days in the month
//   open days     = selling days from today on with no sales entered yet
//   needed/day    = (goal − sold) ÷ open days
//   pace to date  = baseline × selling days so far (past ones, plus today once it's entered)
//   average       = sold on entered selling days ÷ number of entered selling days
//   month-end     = sold + average × open days
export function summarize({
  month,
  goal,
  sales = {},
  overrides = {},
  today,
}: SummarizeInput): SalesSummary {
  const days: DaySummary[] = monthDays(month).map((day) => ({
    ...day,
    selling: isSellingDay(day, overrides),
    sales: day.date in sales ? sales[day.date] : null,
  }));
  const selling = days.filter((day) => day.selling);
  const hasGoal = goal > 0;
  const baseline = hasGoal && selling.length ? goal / selling.length : 0;
  const sold = days.reduce((sum, day) => sum + (day.sales || 0), 0);
  const isPast = (day: DaySummary) => day.date < today;
  const entered = (day: DaySummary) => day.sales !== null;

  const openDays = selling.filter((day) => !entered(day) && !isPast(day)).length;
  const missingPast = selling.filter((day) => !entered(day) && isPast(day)).length;
  const elapsedSelling = selling.filter(
    (day) => isPast(day) || (day.date === today && entered(day)),
  ).length;
  const enteredSelling = selling.filter(entered);
  const soldOnSelling = enteredSelling.reduce((sum, day) => sum + (day.sales as number), 0);
  const average = enteredSelling.length ? soldOnSelling / enteredSelling.length : 0;
  const remaining = Math.max(0, goal - sold);
  const neededPerDay = openDays ? remaining / openDays : null;
  const paceToDate = baseline * elapsedSelling;
  const projected = sold + average * openDays;
  const withSales = days.filter((day) => entered(day) && day.selling);
  const best = withSales.reduce(
    (top: DaySummary | null, day) =>
      !top || (day.sales as number) > (top.sales as number) ? day : top,
    null,
  );
  const worst = withSales.reduce(
    (low: DaySummary | null, day) =>
      !low || (day.sales as number) < (low.sales as number) ? day : low,
    null,
  );
  const daysAtBaseline = withSales.filter((day) => (day.sales as number) >= baseline - 1e-9).length;

  // Weeks run Monday to Sunday; a week is cut at the month's edges.
  const weeks: WeekSummary[] = [];
  days.forEach((day) => {
    if (!weeks.length || day.weekday === 1) weeks.push({ days: [] } as unknown as WeekSummary);
    weeks[weeks.length - 1].days.push(day);
  });
  weeks.forEach((week) => {
    week.start = week.days[0].date;
    week.end = week.days[week.days.length - 1].date;
    week.sellingDays = week.days.filter((day) => day.selling).length;
    week.target = baseline * week.sellingDays;
    week.sold = week.days.reduce((sum, day) => sum + (day.sales || 0), 0);
    week.difference = week.sold - week.target;
    week.hasSales = week.days.some(entered);
  });

  // Running totals for the chart: actual through the last day with sales (or today), and goal pace.
  let runningSold = 0;
  let runningPace = 0;
  const lastActual = days.reduce((last, day) => (entered(day) ? day.date : last), '');
  const actualThrough = lastActual > today ? lastActual : today;
  const series = days.map((day) => {
    runningSold += day.sales || 0;
    if (day.selling) runningPace += baseline;
    return {
      date: day.date,
      day: day.day,
      sales: day.sales,
      sold: runningSold,
      pace: runningPace,
      showActual: day.date <= actualThrough,
    };
  });

  return {
    days,
    sellingDays: selling.length,
    baseline,
    sold,
    remaining,
    percent: hasGoal ? (sold / goal) * 100 : 0,
    openDays,
    missingPast,
    neededPerDay,
    paceToDate,
    aheadBy: sold - paceToDate,
    average,
    enteredSellingDays: enteredSelling.length,
    projected,
    best,
    worst,
    daysAtBaseline,
    weeks,
    series,
    goalMet: hasGoal && sold >= goal,
  };
}

// "$1,234.50", "1234.5", "1,234" -> 1234.5. Empty -> null. Anything else -> NaN.
export function parseMoney(text: string): number | null {
  const cleaned = String(text).replace(/[$,\s]/g, '');
  if (cleaned === '') return null;
  const value = Number(cleaned);
  return isFinite(value) && value >= 0 ? value : NaN;
}

export interface MonthRecord {
  goal: number | null;
  sales: Record<string, number>;
  overrides: Record<string, boolean>;
  /** Set once the goal-hit confetti has played for this month, so it only plays once. */
  celebrated?: boolean;
}

export interface SalesStore {
  months: Record<string, MonthRecord>;
}

// CSV: a "Month,Goal" block, a blank line, then "Date,Weekday,Selling day,Sales" rows (Excel-friendly).
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function toCsv(store: SalesStore): string {
  const months = Object.keys(store.months || {}).sort();
  const rows = ['Month,Goal'];
  months.forEach((month) => rows.push(`${month},${store.months[month].goal ?? ''}`));
  rows.push('', 'Date,Weekday,Selling day,Sales');
  months.forEach((month) => {
    const saved = store.months[month];
    monthDays(month).forEach((day) => {
      const hasSales = day.date in (saved.sales || {});
      const overridden = day.date in (saved.overrides || {});
      if (!hasSales && !overridden) return;
      const selling = isSellingDay(day, saved.overrides);
      rows.push(
        `${day.date},${WEEKDAYS[day.weekday]},${selling ? 'yes' : 'no'},${hasSales ? saved.sales[day.date] : ''}`,
      );
    });
  });
  return rows.join('\n') + '\n';
}

// Today's date in the browser's own local time zone, not UTC (a plain `new Date().toISOString()`
// would drift a day around midnight for anyone west of UTC).
export function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// "2026-09-04" -> "Fri, Sep 4". Noon avoids any UTC/local rounding landing on the wrong day.
export function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function formatMoney(value: number): string {
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export function formatCents(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

// Uses the minus sign (−), not a hyphen, matching sales.html's own signed() helper.
export function formatSigned(value: number): string {
  return (value >= 0 ? '+' : '−') + formatMoney(Math.abs(value));
}

export function fromCsv(text: string): SalesStore {
  const store: SalesStore = { months: {} };
  const monthOf = (key: string) =>
    (store.months[key] = store.months[key] || { goal: null, sales: {}, overrides: {} });
  text.split(/\r?\n/).forEach((line) => {
    const cells = line.split(',').map((cell) => cell.trim());
    if (/^\d{4}-\d{2}$/.test(cells[0])) {
      const goal = parseMoney(cells[1] || '');
      monthOf(cells[0]).goal = goal !== null && isFinite(goal) ? goal : null;
    } else if (/^\d{4}-\d{2}-\d{2}$/.test(cells[0])) {
      const saved = monthOf(cells[0].slice(0, 7));
      const [year, month, day] = cells[0].split('-').map(Number);
      const weekday = new Date(year, month - 1, day).getDay();
      const sellingByDefault = weekday >= 1 && weekday <= 5;
      const selling = /^y/i.test(cells[2] || '');
      if (cells[2] && selling !== sellingByDefault) saved.overrides[cells[0]] = selling;
      const sales = parseMoney(cells[3] || '');
      if (sales !== null && isFinite(sales)) saved.sales[cells[0]] = sales;
    }
  });
  return store;
}

// Folds an imported CSV into what's already saved, month by month (sales.html's import handler): an
// imported goal replaces the saved one, but a month with no goal in the file keeps its own; days and
// selling-day overrides are added, with the file winning where both have the same day.
export function mergeImportedMonths(saved: SalesStore, imported: SalesStore): SalesStore {
  const months = { ...saved.months };
  for (const [key, incoming] of Object.entries(imported.months)) {
    const existing = months[key] ?? { goal: null, sales: {}, overrides: {} };
    months[key] = {
      ...existing,
      goal: incoming.goal !== null ? incoming.goal : existing.goal,
      sales: { ...existing.sales, ...incoming.sales },
      overrides: { ...existing.overrides, ...incoming.overrides },
    };
  }
  return { months };
}
