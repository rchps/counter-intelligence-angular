import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CardTransitionService } from './card-transition.service';

function stubReducedMotion(reduce: boolean): void {
  window.matchMedia = ((query: string) =>
    ({ matches: reduce, media: query }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

/** A stand-in for document.startViewTransition that runs the update at once and finishes when told. */
function stubViewTransitions(): { finish: () => void; started: () => number } {
  let started = 0;
  let finish = (): void => undefined;
  const fake = (update: () => void): ViewTransition => {
    started++;
    update();
    const finished = new Promise<undefined>((resolve) => (finish = () => resolve(undefined)));
    return { finished } as unknown as ViewTransition;
  };
  Object.defineProperty(document, 'startViewTransition', { value: fake, configurable: true });
  return { finish: () => finish(), started: () => started };
}

describe('CardTransitionService', () => {
  beforeEach(() => {
    Reflect.deleteProperty(document, 'startViewTransition');
    document.documentElement.classList.remove('vt-cards');
    stubReducedMotion(false);
  });

  it('just makes the change when the browser has no view transitions', () => {
    const update = vi.fn();
    TestBed.inject(CardTransitionService).run(update);
    expect(update).toHaveBeenCalledOnce();
  });

  it('just makes the change when reduced motion is asked for', () => {
    const transitions = stubViewTransitions();
    stubReducedMotion(true);
    const update = vi.fn();
    TestBed.inject(CardTransitionService).run(update);
    expect(update).toHaveBeenCalledOnce();
    expect(transitions.started()).toBe(0);
  });

  it('names the cards for the transition, then stops once it finishes', async () => {
    const transitions = stubViewTransitions();
    const update = vi.fn();
    TestBed.inject(CardTransitionService).run(update);
    expect(update).toHaveBeenCalledOnce();
    expect(document.documentElement.classList).toContain('vt-cards');

    transitions.finish();
    await vi.waitFor(() => expect(document.documentElement.classList).not.toContain('vt-cards'));
  });
});
