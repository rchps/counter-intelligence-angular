import {
  fromCsv,
  mergeImportedMonths,
  parseMoney,
  removeMonth,
  shortDate,
  summarize,
  toCsv,
  updateMonthRecord,
  type MonthRecord,
  type SalesStore,
} from './sales-math';

// A hand-worked month. September 2026 starts on a Tuesday and has 22
// weekdays. Goal $44,000 -> baseline $2,000 a selling day. Sales entered through Wed Sep 9 total
// $14,000 over 7 selling days; "today" is Thu Sep 10 (not entered).
const SALES: Record<string, number> = {
  '2026-09-01': 1500,
  '2026-09-02': 2500,
  '2026-09-03': 2000,
  '2026-09-04': 3000,
  '2026-09-07': 1000,
  '2026-09-08': 2200,
  '2026-09-09': 1800,
};

const EXPECTED: Record<string, number> = {
  sellingDays: 22,
  baseline: 2000,
  sold: 14000,
  remaining: 30000,
  openDays: 15, // Sep 10-11, 14-18, 21-25, 28-30
  neededPerDay: 2000,
  paceToDate: 14000,
  aheadBy: 0,
  average: 2000,
  projected: 44000,
  daysAtBaseline: 4, // Sep 2, 3, 4, 8
  missingPast: 0,
};

describe('sales-math (September 2026 hand-worked example)', () => {
  const summary = summarize({
    month: '2026-09',
    goal: 44000,
    sales: SALES,
    overrides: {},
    today: '2026-09-10',
  });

  for (const [key, value] of Object.entries(EXPECTED)) {
    it(`summary.${key} === ${value}`, () => {
      expect(summary[key as keyof typeof summary]).toBeCloseTo(value, 6);
    });
  }

  it('Best day is Sep 4 ($3,000)', () => {
    expect(summary.best).toMatchObject({ date: '2026-09-04', sales: 3000 });
  });

  it('Slowest day is Sep 7 ($1,000)', () => {
    expect(summary.worst).toMatchObject({ date: '2026-09-07', sales: 1000 });
  });

  it('Week 1 is Tue Sep 1 to Sun Sep 6', () => {
    const [week1] = summary.weeks;
    expect(week1.start).toBe('2026-09-01');
    expect(week1.end).toBe('2026-09-06');
  });

  it('Week 1: 4 days, $8,000 target, $9,000 sold', () => {
    const [week1] = summary.weeks;
    expect(week1.sellingDays).toBe(4);
    expect(week1.target).toBeCloseTo(8000, 6);
    expect(week1.sold).toBeCloseTo(9000, 6);
  });

  it('Week 2 so far: $5,000, -$5,000', () => {
    const [, week2] = summary.weeks;
    expect(week2.sellingDays).toBe(5);
    expect(week2.sold).toBeCloseTo(5000, 6);
    expect(week2.difference).toBeCloseTo(-5000, 6);
  });

  it('Labor Day off: 21 selling days, $42,000 -> $2,000', () => {
    const laborDay = summarize({
      month: '2026-09',
      goal: 42000,
      overrides: { '2026-09-07': false },
      today: '2026-09-01',
    });
    expect(laborDay.sellingDays).toBe(21);
    expect(laborDay.baseline).toBeCloseTo(2000, 6);
  });
});

describe('parseMoney', () => {
  it('parses "$1,234.50" as 1234.5', () => {
    expect(parseMoney('$1,234.50')).toBe(1234.5);
  });
  it('parses empty string as null', () => {
    expect(parseMoney('')).toBeNull();
  });
  it('parses "abc" as NaN', () => {
    expect(Number.isNaN(parseMoney('abc'))).toBe(true);
  });
  it('parses "-5" as NaN (negative sales are not valid)', () => {
    expect(Number.isNaN(parseMoney('-5'))).toBe(true);
  });
  it('parses " 99 " as 99', () => {
    expect(parseMoney(' 99 ')).toBe(99);
  });
});

describe('shortDate', () => {
  it('formats "2026-09-04" as "Fri, Sep 4"', () => {
    expect(shortDate('2026-09-04')).toBe('Fri, Sep 4');
  });
});

describe('CSV round trip', () => {
  it('toCsv -> fromCsv reproduces the same month data', () => {
    const store = {
      months: {
        '2026-09': {
          goal: 44000,
          sales: SALES,
          overrides: { '2026-09-07': false, '2026-09-12': true },
        },
      },
    };
    const back = fromCsv(toCsv(store));
    expect(back.months['2026-09']).toEqual(store.months['2026-09']);
  });
});

describe('mergeImportedMonths', () => {
  const saved = {
    months: {
      '2026-08': { goal: 30000, sales: { '2026-08-03': 900 }, overrides: {}, celebrated: true },
      '2026-09': { goal: 44000, sales: { '2026-09-01': 1500, '2026-09-02': 2500 }, overrides: {} },
    },
  };

  it('adds imported days, with the file winning on the same day, and keeps untouched months', () => {
    const merged = mergeImportedMonths(saved, {
      months: {
        '2026-09': { goal: null, sales: { '2026-09-02': 2600, '2026-09-03': 2000 }, overrides: {} },
      },
    });
    expect(merged.months['2026-09']).toEqual({
      goal: 44000,
      sales: { '2026-09-01': 1500, '2026-09-02': 2600, '2026-09-03': 2000 },
      overrides: {},
    });
    expect(merged.months['2026-08']).toEqual(saved.months['2026-08']);
  });

  it("takes the file's goal when it has one, and adds new months", () => {
    const merged = mergeImportedMonths(saved, {
      months: {
        '2026-09': { goal: 50000, sales: {}, overrides: {} },
        '2026-10': { goal: 40000, sales: {}, overrides: { '2026-10-12': false } },
      },
    });
    expect(merged.months['2026-09'].goal).toBe(50000);
    expect(merged.months['2026-10']).toEqual({
      goal: 40000,
      sales: {},
      overrides: { '2026-10-12': false },
    });
  });
});

// Edits are applied to the store as saved right now. These stand in for "tab B already saved October
// and tab A, which still holds an older copy, now edits September".
describe('updateMonthRecord and removeMonth', () => {
  const saved: SalesStore = {
    months: {
      '2026-09': { goal: 44000, sales: { '2026-09-01': 1500 }, overrides: {} },
      '2026-10': { goal: 40000, sales: { '2026-10-01': 1000 }, overrides: {} },
    },
  };

  it('changes only the month it names', () => {
    const next = updateMonthRecord(saved, '2026-09', (data) => ({
      ...data,
      sales: { ...data.sales, '2026-09-28': 2500 },
    }));
    expect(next.months['2026-09'].sales).toEqual({ '2026-09-01': 1500, '2026-09-28': 2500 });
    expect(next.months['2026-10']).toBe(saved.months['2026-10']);
  });

  it('keeps the other days in the same month', () => {
    const next = updateMonthRecord(saved, '2026-09', (data) => ({
      ...data,
      sales: { ...data.sales, '2026-09-02': 900 },
    }));
    expect(next.months['2026-09'].sales).toEqual({ '2026-09-01': 1500, '2026-09-02': 900 });
  });

  it('lets the later write win for the same day', () => {
    const edit = (value: number) => (data: MonthRecord) => ({
      ...data,
      sales: { ...data.sales, '2026-09-01': value },
    });
    const first = updateMonthRecord(saved, '2026-09', edit(100));
    const next = updateMonthRecord(first, '2026-09', edit(200));
    expect(next.months['2026-09'].sales['2026-09-01']).toBe(200);
  });

  it('starts an empty record for a month that is not saved yet', () => {
    const next = updateMonthRecord({ months: {} }, '2026-11', (data) => ({ ...data, goal: 10 }));
    expect(next.months['2026-11']).toEqual({ goal: 10, sales: {}, overrides: {} });
  });

  it('removes one month and leaves the rest', () => {
    const next = removeMonth(saved, '2026-09');
    expect(Object.keys(next.months)).toEqual(['2026-10']);
    expect(saved.months['2026-09']).toBeDefined();
  });
});
