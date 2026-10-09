import { describe, expect, it } from 'vitest';
import { showsBackToTop } from './back-to-top';

describe('showsBackToTop', () => {
  it('stays hidden at the top of the page', () => {
    expect(showsBackToTop(0, 844)).toBe(false);
  });

  it('stays hidden up to two screen heights down', () => {
    expect(showsBackToTop(844 * 2, 844)).toBe(false);
  });

  it('shows once the page is past two screen heights down', () => {
    expect(showsBackToTop(844 * 2 + 1, 844)).toBe(true);
  });

  it('measures in screens, so a short window shows it sooner', () => {
    expect(showsBackToTop(1000, 390)).toBe(true);
    expect(showsBackToTop(1000, 1100)).toBe(false);
  });
});
