import { Component, computed, effect, ElementRef, inject, signal, untracked } from '@angular/core';
import {
  formatMoney,
  formatSigned,
  localToday,
  parseMoney,
  shortDate,
  summarize,
  type MonthRecord,
  type SalesStore,
  type SalesSummary,
} from '../../core/sales-math';
import { SalesStoreService } from '../../core/sales-store.service';

interface StatusInfo {
  kind: 'ahead' | 'behind' | 'done';
  text: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');
const EMPTY_MONTH: MonthRecord = { goal: null, sales: {}, overrides: {} };

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
  private readonly goal = computed(() => this.monthData().goal || 0);

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

  constructor() {
    // Calendar/goal/today display text resets to match the newly-viewed month's stored data — but only
    // on a month change, not on every keystroke (sales.html's buildCalendar() has the same boundary).
    effect(() => {
      const month = this.month();
      untracked(() => this.resetTextsForMonth(month));
    });
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
    const next: SalesStore = { months: { ...this.store().months, [month]: fn(current) } };
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
