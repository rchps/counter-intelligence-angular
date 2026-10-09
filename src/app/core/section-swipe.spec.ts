import { describe, expect, it } from 'vitest';
import { adjacentSection, swipeDirection } from './section-swipe';

describe('swipeDirection', () => {
  it('reads a quick leftward swipe as next and a rightward one as previous', () => {
    expect(swipeDirection(-120, 10, 250)).toBe('next');
    expect(swipeDirection(120, -10, 250)).toBe('previous');
  });

  it('ignores a tap or a short nudge', () => {
    expect(swipeDirection(0, 0, 80)).toBeNull();
    expect(swipeDirection(-40, 0, 150)).toBeNull();
  });

  it('ignores a mostly vertical scroll that drifts sideways', () => {
    expect(swipeDirection(-80, 60, 250)).toBeNull();
  });

  it('ignores a slow drag', () => {
    expect(swipeDirection(-200, 0, 1200)).toBeNull();
  });
});

describe('adjacentSection', () => {
  it('steps through the sections in the top bar order', () => {
    expect(adjacentSection('/lines', 'next')).toBe('/branches');
    expect(adjacentSection('/branches', 'next')).toBe('/tools');
    expect(adjacentSection('/branches', 'previous')).toBe('/lines');
  });

  it('treats a tool page, a search and a fragment as their section', () => {
    expect(adjacentSection('/tools/vdrop', 'previous')).toBe('/branches');
    expect(adjacentSection('/lines?q=bosch', 'next')).toBe('/branches');
    expect(adjacentSection('/lines#c', 'next')).toBe('/branches');
  });

  it("doesn't wrap around at either end", () => {
    expect(adjacentSection('/lines', 'previous')).toBeNull();
    expect(adjacentSection('/tools/margin', 'next')).toBeNull();
  });

  it('does nothing on a page that is not a section', () => {
    expect(adjacentSection('/', 'next')).toBeNull();
    expect(adjacentSection('/elsewhere', 'next')).toBeNull();
  });
});
