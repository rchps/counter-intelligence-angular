import { salesHero, salesKpis, salesMeter } from './sales-display';
import { summarize } from './sales-math';

// sales-math.spec.ts's hand-worked September 2026 example: goal $44,000 ($2,000 a selling day), $14,000
// sold over the 7 selling days through Wed Sep 9, "today" Thu Sep 10 (not entered).
const SALES: Record<string, number> = {
  '2026-09-01': 1500,
  '2026-09-02': 2500,
  '2026-09-03': 2000,
  '2026-09-04': 3000,
  '2026-09-07': 1000,
  '2026-09-08': 2200,
  '2026-09-09': 1800,
};
const september = (goal: number, sales = SALES, today = '2026-09-10') =>
  summarize({ month: '2026-09', goal, sales, today });

describe('salesHero', () => {
  it('asks for a goal first', () => {
    expect(salesHero(september(0), 0)).toEqual({
      label: 'Needed per selling day',
      value: '—',
      sub: 'Set a goal to get started.',
      status: null,
    });
  });

  it('shows what is needed per remaining selling day, and pace', () => {
    const hero = salesHero(september(44000), 44000);
    expect(hero.value).toBe('$2,000');
    expect(hero.sub).toBe('$30,000 to go over 15 selling days');
    expect(hero.status).toEqual({ kind: 'ahead', text: '▲ Ahead of pace by $0' });
  });

  it('says so when behind, and counts past days left blank', () => {
    // Fri Sep 11: Thu Sep 10 is now in the past and still blank.
    const hero = salesHero(september(44000, SALES, '2026-09-11'), 44000);
    expect(hero.sub).toContain('· 1 past day not entered');
    expect(hero.status?.kind).toBe('behind');
    expect(hero.status?.text.startsWith('▼ Behind pace by $')).toBe(true);
  });

  it('celebrates a met goal', () => {
    const hero = salesHero(september(10000), 10000);
    expect(hero.value).toBe('$0');
    expect(hero.sub).toBe('Goal hit with $4,000 to spare.');
    expect(hero.status?.kind).toBe('done');
  });

  it('switches to "Short of goal" once no selling days are left', () => {
    const hero = salesHero(september(44000, SALES, '2026-10-01'), 44000);
    expect(hero.label).toBe('Short of goal');
    expect(hero.sub).toBe('No selling days left in this month.');
    expect(hero.status).toBeNull();
  });
});

describe('salesMeter', () => {
  it('has nothing to measure without a goal', () => {
    expect(salesMeter(september(0), 0)).toBeNull();
  });

  it('shows sold and pace as shares of the goal', () => {
    const meter = salesMeter(september(44000), 44000)!;
    expect(meter.soldText).toBe('32% of $44,000');
    expect(meter.paceText).toBe('Pace today: $14,000');
    expect(meter.pacePercent).toBeCloseTo((14000 / 44000) * 100, 6);
  });
});

describe('salesKpis', () => {
  it('summarizes the month in four tiles', () => {
    expect(salesKpis(september(44000), 44000)).toEqual([
      { label: 'Sold so far', value: '$14,000', detail: '$30,000 left' },
      { label: 'Daily baseline', value: '$2,000', detail: '22 selling days' },
      { label: 'Average per day', value: '$2,000', detail: 'over 7 days' },
      { label: 'Month-end at this pace', value: '$44,000', detail: '+$0 vs goal' },
    ]);
  });

  it('leaves goal-based numbers blank without a goal', () => {
    const [sold, baseline, , projected] = salesKpis(september(0), 0);
    expect(sold.detail).toBe('');
    expect(baseline.value).toBe('—');
    expect(projected.detail).toBe('');
  });
});
