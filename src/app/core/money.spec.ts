import { formatDollarsAndCents, formatSignedWholeDollars, formatWholeDollars } from './money';

describe('money formatting', () => {
  it('formatWholeDollars rounds to the dollar', () => {
    expect(formatWholeDollars(1234.5)).toBe('$1,235');
  });

  it('formatDollarsAndCents always shows two decimal places', () => {
    expect(formatDollarsAndCents(1234.5)).toBe('$1,234.50');
    expect(formatDollarsAndCents(60)).toBe('$60.00');
  });

  it('formatSignedWholeDollars prefixes + or a minus sign', () => {
    expect(formatSignedWholeDollars(500)).toBe('+$500');
    expect(formatSignedWholeDollars(-500)).toBe('−$500');
  });
});
