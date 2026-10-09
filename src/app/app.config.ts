import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  isActive,
  provideRouter,
  Router,
  TitleStrategy,
  withComponentInputBinding,
  withViewTransitions,
  type ActivatedRouteSnapshot,
  type IsActiveMatchOptions,
  type ViewTransitionInfo,
} from '@angular/router';
import { routes } from './app.routes';
import { prefersReducedMotion } from './core/card-transition.service';
import { PageTitleStrategy } from './core/page-title.strategy';
import { sectionStep } from './core/section-swipe';

const SAME_PAGE: IsActiveMatchOptions = {
  paths: 'exact',
  matrixParams: 'exact',
  fragment: 'ignored',
  queryParams: 'ignored',
};

// On a phone, moving to another section turns the page forwards or backwards, by where that section sits
// in the top bar (styles.scss); wider screens, and moving between tools, cross-fade. A navigation that
// stays on the same page, like an A-Z jump link, doesn't animate, and neither does anything for someone
// who asked for reduced motion.
let latestTurn = 0;

function animateNewPage({ transition, from, to }: ViewTransitionInfo): void {
  const router = inject(Router);
  const target = router.currentNavigation()?.finalUrl;
  if (prefersReducedMotion() || !target || isActive(target, router, SAME_PAGE)()) {
    transition.skipTransition();
    return;
  }
  const step = sectionStep(urlOf(from), urlOf(to));
  if (!step) return;

  // The class is set before the browser captures the old page, and kept until the turn ends. A newer
  // navigation replaces this one's transition, so it's left for that one to remove.
  const id = ++latestTurn;
  const root = document.documentElement;
  root.classList.remove('vt-turn-next', 'vt-turn-previous');
  root.classList.add(`vt-turn-${step}`);
  void transition.finished.finally(() => {
    if (id === latestTurn) root.classList.remove(`vt-turn-${step}`);
  });
}

function urlOf(root: ActivatedRouteSnapshot): string {
  return '/' + (root.firstChild?.url.map((segment) => segment.path).join('/') ?? '');
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions({
        skipInitialTransition: true,
        onViewTransitionCreated: animateNewPage,
      }),
    ),
    { provide: TitleStrategy, useClass: PageTitleStrategy },
  ],
};
