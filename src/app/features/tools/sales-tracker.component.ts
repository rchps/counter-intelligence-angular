import { Component, computed, effect, ElementRef, inject, signal, untracked } from '@angular/core';
import { launchConfetti } from '../../core/confetti';
import {
  formatDollarsAndCents,
  formatSignedWholeDollars,
  formatWholeDollars,
} from '../../core/money';
import { salesHero, salesKpis, salesMeter } from '../../core/sales-display';
import {
  EMPTY_MONTH,
  fromCsv,
  localToday,
  mergeImportedMonths,
  parseMoney,
  removeMonth,
  shortDate,
  summarize,
  toCsv,
  updateMonthRecord,
  type DaySummary,
  type MonthRecord,
  type SalesStore,
  type SalesSummary,
} from '../../core/sales-math';
import { SalesStoreService } from '../../core/sales-store.service';
import { SalesChartComponent } from './sales-chart.component';
import { inputValue } from '../../shared/input-value';

const pad = (n: number): string => String(n).padStart(2, '0');

// The Sales Tracker. The math, wording and chart geometry are pure functions in core/ (sales-math,
// sales-display, sales-chart); the chart draws itself (SalesChartComponent). This component owns the
// page's own state: which month is showing, the text in each box, saving, and the tools row.
@Component({
  selector: 'app-sales-tracker',
  imports: [SalesChartComponent],
  templateUrl: './sales-tracker.component.html',
  styleUrl: './sales-tracker.component.scss',
  host: { '(window:storage)': 'onStorageChange($event)' },
})
export class SalesTrackerComponent {
  protected readonly inputValue = inputValue;
  private readonly salesStore = inject(SalesStoreService);
  private readonly elementRef: ElementRef<HTMLElement> = inject(ElementRef);

  protected readonly today = localToday();
  protected readonly weekdayHeads = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  protected readonly formatWholeDollars = formatWholeDollars;
  protected readonly formatDollarsAndCents = formatDollarsAndCents;
  protected readonly formatSignedWholeDollars = formatSignedWholeDollars;

  protected readonly month = signal(this.today.slice(0, 7));
  private readonly store = signal<SalesStore>(this.salesStore.load());

  // What's typed in each box. Kept apart from the saved numbers so typing is never reformatted mid-word;
  // reset from the saved numbers only when the month changes.
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

  protected readonly toolsMessage = signal('');
  // The month the clear was armed for. Armed for September, it can't clear October: clearArmed is
  // only true while the month on screen is the armed one, and any month change disarms it outright.
  private readonly clearArmedFor = signal<string | null>(null);
  protected readonly clearArmed = computed(() => this.clearArmedFor() === this.month());
  private clearTimer: ReturnType<typeof setTimeout> | undefined;
  protected readonly showDayTable = signal(false);

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
      goal: this.goal(),
      sales: data.sales,
      overrides: data.overrides,
      today: this.today,
    });
  });

  protected readonly hero = computed(() => salesHero(this.summary(), this.goal()));
  protected readonly meter = computed(() => salesMeter(this.summary(), this.goal()));
  protected readonly kpis = computed(() => salesKpis(this.summary(), this.goal()));

  /** Empty cells before the 1st, so the calendar grid starts on Monday. */
  protected readonly leadingBlanks = computed(() => {
    const days = this.summary().days;
    const mondayFirstWeekday = days.length ? (days[0].weekday + 6) % 7 : 0;
    return Array.from({ length: mondayFirstWeekday });
  });

  constructor() {
    effect(() => {
      const month = this.month();
      untracked(() => this.resetTextsForMonth(month));
    });

    // Confetti: once per month, the moment the goal is first hit (not on every visit).
    effect(() => {
      if (this.summary().goalMet && !this.monthData().celebrated) {
        untracked(() => this.celebrateOnce());
      }
    });
  }

  // ---- Month and setup ----

  protected onMonthInputChange(value: string): void {
    if (!/^\d{4}-\d{2}$/.test(value)) return;
    this.month.set(value);
    this.disarmClear();
  }

  protected shiftMonth(by: number): void {
    const [year, monthNumber] = this.month().split('-').map(Number);
    const moved = new Date(year, monthNumber - 1 + by, 1);
    this.month.set(`${moved.getFullYear()}-${pad(moved.getMonth() + 1)}`);
    this.disarmClear();
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

  // The big "today" box and today's calendar box mirror each other.
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

  // ---- Calendar ----

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

  protected toggleSellingDay(day: DaySummary): void {
    const nowSelling = !day.selling;
    const sellingByDefault = day.weekday >= 1 && day.weekday <= 5;
    this.updateMonth((data) => {
      const overrides = { ...data.overrides };
      // Only store a day that differs from the Monday-Friday default.
      if (nowSelling === sellingByDefault) delete overrides[day.date];
      else overrides[day.date] = nowSelling;
      return { ...data, overrides };
    });
  }

  /** "Sep 4" */
  protected dayLabel(date: string): string {
    return shortDate(date).replace(/^\w+, /, '');
  }

  /** "Fri, Sep 4" */
  protected dayFullLabel(date: string): string {
    return shortDate(date);
  }

  protected hitText(day: DaySummary): string {
    const baseline = this.summary().baseline;
    if (day.sales === null || !day.selling || !baseline) return '';
    return day.sales >= baseline
      ? '✓ at baseline'
      : `${formatWholeDollars(baseline - day.sales)} under`;
  }

  protected weekRange(start: string, end: string): string {
    return `${this.dayLabel(start)}–${this.dayLabel(end)}`;
  }

  // ---- Export / import / clear ----

  protected exportCsv(): void {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([toCsv(this.store())], { type: 'text/csv' }));
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
    const monthCount = Object.keys(imported.months).length;
    input.value = ''; // so choosing the same file again still fires a change
    this.saveStore((saved) => mergeImportedMonths(saved, imported));
    this.resetTextsForMonth(this.month());
    this.toolsMessage.set(
      monthCount
        ? `Imported ${monthCount} month${monthCount === 1 ? '' : 's'}.`
        : 'Nothing to import in that file.',
    );
  }

  // Two-step clear (no pop-up): the first press arms it for 4 seconds, a second press clears.
  protected onClearClick(): void {
    clearTimeout(this.clearTimer);
    if (!this.clearArmed()) {
      this.clearArmedFor.set(this.month());
      this.clearTimer = setTimeout(() => this.clearArmedFor.set(null), 4000);
      return;
    }
    this.clearArmedFor.set(null);
    const month = this.month();
    this.saveStore((saved) => removeMonth(saved, month));
    this.resetTextsForMonth(this.month());
    this.toolsMessage.set('This month is cleared.');
  }

  // Cancels an armed clear and its timer, so a stale timer can't fire later and disarm a new arming.
  private disarmClear(): void {
    clearTimeout(this.clearTimer);
    this.clearArmedFor.set(null);
  }

  // ---- Saving ----

  private resetTextsForMonth(month: string): void {
    const data = this.store().months[month] ?? EMPTY_MONTH;
    this.goalText.set(data.goal ? data.goal.toLocaleString('en-US') : '');
    const todayIsShowing = this.today.slice(0, 7) === month;
    this.todayText.set(
      todayIsShowing && this.today in data.sales ? String(data.sales[this.today]) : '',
    );
    const texts: Record<string, string> = {};
    for (const [date, value] of Object.entries(data.sales)) texts[date] = String(value);
    this.dayTexts.set(texts);
    this.goalInvalid.set(false);
    this.todayInvalid.set(false);
    this.dayInvalid.set({});
  }

  // Returns whether the text was invalid (bad input is rejected and never saved; a blank box is valid
  // and clears that day).
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

  private updateMonth(change: (data: MonthRecord) => MonthRecord): void {
    const month = this.month();
    this.saveStore((saved) => updateMonthRecord(saved, month, change));
  }

  // Another tab saved: show what it saved. (The browser fires this only in the other tabs.)
  protected onStorageChange(event: StorageEvent): void {
    if (!this.salesStore.isSalesChange(event)) return;
    this.store.set(this.salesStore.load());
    this.resetTextsForMonth(this.month());
  }

  // Applies the edit to what is saved right now, not to this tab's copy, so another tab's changes
  // aren't written over. If both tabs edit the same entry, the later save wins and the other tab
  // then updates through the storage event.
  private saveStore(change: (saved: SalesStore) => SalesStore): void {
    const { store, saved } = this.salesStore.update(this.store(), change);
    this.store.set(store);
    this.savedIsWarning.set(!saved);
    if (!saved) {
      this.savedMessage.set(
        "This browser won't save (private window?). Export a CSV before you close the page.",
      );
      return;
    }
    const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    this.savedMessage.set(`✓ Saved on this computer at ${time}. Only you can see it.`);
  }

  // Marked as done even when the animation is skipped, so it never replays for this month.
  private celebrateOnce(): void {
    this.updateMonth((data) => ({ ...data, celebrated: true }));
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    launchConfetti();
  }
}
