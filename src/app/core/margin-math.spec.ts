import { describe, expect, it } from 'vitest';
import { formatDollarsAndCents } from './money';
import { calculateMargin, formatPercent, parseMarginNumber } from './margin-math';

describe('parseMarginNumber', () => {
  it('strips $, commas, %, and whitespace', () => {
    expect(parseMarginNumber('$1,234.50')).toBe(1234.5);
    expect(parseMarginNumber('18%')).toBe(18);
    expect(parseMarginNumber(' 99 ')).toBe(99);
  });

  it('is NaN for blank text', () => {
    expect(parseMarginNumber('')).toBeNaN();
  });

  it('is NaN for genuine garbage', () => {
    expect(parseMarginNumber('abc')).toBeNaN();
  });
});

describe('calculateMargin: cost & margin', () => {
  it('cost $50, margin 18% -> the calculator.html worked example', () => {
    const result = calculateMargin('cost-margin', { cost: '50', price: '', margin: '18' });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') throw new Error('unreachable');
    expect(formatDollarsAndCents(result.price)).toBe('$60.98');
    expect(formatDollarsAndCents(result.profit)).toBe('$10.98');
    expect(formatPercent(result.margin)).toBe('18.00%');
    expect(formatPercent(result.markup!)).toBe('21.95%');
    expect(result.belowCost).toBe(false);
    expect(result.message).toBe('');
  });

  it('is incomplete until both fields are filled, with no message', () => {
    expect(calculateMargin('cost-margin', { cost: '50', price: '', margin: '' })).toEqual({
      status: 'incomplete',
    });
    expect(calculateMargin('cost-margin', { cost: '', price: '', margin: '18' })).toEqual({
      status: 'incomplete',
    });
  });

  // tests/voice.js: "100% margin: rule first, then the line"
  it('rejects a margin of 100% or more', () => {
    const result = calculateMargin('cost-margin', { cost: '50', price: '', margin: '100' });
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') throw new Error('unreachable');
    expect(result.message).toMatch(/^Margin has to be under 100%\./);
  });

  // tests/voice.js: "Negative cost: rule first"
  it('rejects a negative cost with its own dry line', () => {
    const result = calculateMargin('cost-margin', { cost: '-5', price: '', margin: '18' });
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') throw new Error('unreachable');
    expect(result.message).toMatch(/^Cost can't be negative\./);
  });

  it('rejects text that is not a number, naming the field', () => {
    const result = calculateMargin('cost-margin', { cost: 'abc', price: '', margin: '18' });
    expect(result.status).toBe('invalid');
    if (result.status !== 'invalid') throw new Error('unreachable');
    expect(result.invalidFields).toEqual(['cost']);
  });
});

describe('calculateMargin: cost & price', () => {
  // tests/voice.js: "Below cost stays plain" (no dry line, just the fact)
  it('selling below cost is flagged but not editorialized', () => {
    const result = calculateMargin('cost-price', { cost: '50', price: '40', margin: '' });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') throw new Error('unreachable');
    expect(result.belowCost).toBe(true);
    expect(result.message).toBe('Selling below cost.');
  });

  it('rejects a zero selling price', () => {
    const result = calculateMargin('cost-price', { cost: '50', price: '0', margin: '' });
    expect(result).toEqual({
      status: 'invalid',
      invalidFields: ['price'],
      message: "Selling price can't be zero.",
    });
  });
});

describe('calculateMargin: price & margin', () => {
  it('backs into cost, and shows "n/a" markup when cost works out to 0', () => {
    const result = calculateMargin('price-margin', { cost: '', price: '0', margin: '50' });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') throw new Error('unreachable');
    expect(result.cost).toBe(0);
    expect(result.markup).toBeNull();
  });

  // Still rejected here too: margin is one of the two "needed" inputs for this mode.
  it('still rejects a margin of 100% or more', () => {
    const result = calculateMargin('price-margin', { cost: '', price: '100', margin: '100' });
    expect(result.status).toBe('invalid');
  });
});
