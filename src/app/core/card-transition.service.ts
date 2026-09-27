import { ApplicationRef, inject, Service } from '@angular/core';

// Animates a change to the card grid with the browser's View Transitions API: cards that stay slide to
// their new places, and the rest fade. The vt-cards class gives each card its own transition name only
// for the length of one change (see styles.scss), so moving between pages stays a plain cross-fade.
// Without the API, or when someone has asked for reduced motion, the change is just made.
@Service()
export class CardTransitionService {
  private readonly appRef = inject(ApplicationRef);
  private latest = 0;

  run(update: () => void): void {
    if (!('startViewTransition' in document) || prefersReducedMotion()) {
      update();
      return;
    }
    const id = ++this.latest;
    const root = document.documentElement;
    root.classList.add('vt-cards');
    const transition = document.startViewTransition(() => {
      update();
      // Renders the change now: the browser captures the new state as soon as this callback returns.
      this.appRef.tick();
    });
    // A newer change cancels this one; leave the class for that one to remove.
    void transition.finished.finally(() => {
      if (id === this.latest) root.classList.remove('vt-cards');
    });
  }
}

export function prefersReducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}
