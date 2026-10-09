import { describe, expect, it } from 'vitest';
import { BARS_SCROLL_THRESHOLD, barsAfterScroll } from './bars-on-scroll';

describe('barsAfterScroll', () => {
  it('hides the bars on scrolling down once they are held at the top', () => {
    expect(barsAfterScroll({ hidden: false, anchorY: 1000, y: 1100, stuck: true })).toEqual({
      hidden: true,
      anchorY: 1100,
    });
  });

  it('keeps them while they are still part of the page above the results', () => {
    expect(barsAfterScroll({ hidden: false, anchorY: 0, y: 100, stuck: false })).toEqual({
      hidden: false,
      anchorY: 100,
    });
  });

  it('brings them back on scrolling up', () => {
    expect(barsAfterScroll({ hidden: true, anchorY: 1100, y: 1000, stuck: true })).toEqual({
      hidden: false,
      anchorY: 1000,
    });
  });

  it('ignores a move smaller than the threshold either way, so jitter cannot flicker them', () => {
    const small = BARS_SCROLL_THRESHOLD - 1;
    expect(barsAfterScroll({ hidden: true, anchorY: 1000, y: 1000 - small, stuck: true })).toEqual({
      hidden: true,
      anchorY: 1000,
    });
    expect(barsAfterScroll({ hidden: false, anchorY: 1000, y: 1000 + small, stuck: true })).toEqual(
      {
        hidden: false,
        anchorY: 1000,
      },
    );
  });

  it('adds up small moves from where the bars last reacted', () => {
    let state = { hidden: false, anchorY: 1000 };
    for (const y of [1004, 1008, 1012]) state = barsAfterScroll({ ...state, y, stuck: true });
    expect(state).toEqual({ hidden: true, anchorY: 1012 });
  });
});
