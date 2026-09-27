// Dollar amounts, formatted the way the counter reads them. The margin calculator quotes to the cent;
// the Sales Tracker talks in whole dollars. Each name says which, so the two can't be mixed up.

/** "$1,235" (rounded to the dollar) */
export function formatWholeDollars(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

/** "$1,234.50" */
export function formatDollarsAndCents(amount: number): string {
  return amount.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** "+$500" or "−$500". The minus is a true minus sign (U+2212), not a hyphen. */
export function formatSignedWholeDollars(amount: number): string {
  return (amount >= 0 ? '+' : '−') + formatWholeDollars(Math.abs(amount));
}
