import { ApplicationConfig, inject, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  isActive,
  provideRouter,
  Router,
  withComponentInputBinding,
  withViewTransitions,
  type IsActiveMatchOptions,
  type ViewTransitionInfo,
} from '@angular/router';
import { routes } from './app.routes';
import { prefersReducedMotion } from './core/card-transition.service';

const SAME_PAGE: IsActiveMatchOptions = {
  paths: 'exact',
  matrixParams: 'exact',
  fragment: 'ignored',
  queryParams: 'ignored',
};

// Moving between sections cross-fades (styles.scss). A navigation that stays on the same page, like
// an A-Z jump link, doesn't animate, and neither does anything for someone who asked for reduced motion.
function skipUnlessNewPage({ transition }: ViewTransitionInfo): void {
  const router = inject(Router);
  const target = router.currentNavigation()?.finalUrl;
  if (prefersReducedMotion() || !target || isActive(target, router, SAME_PAGE)()) {
    transition.skipTransition();
  }
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
        onViewTransitionCreated: skipUnlessNewPage,
      }),
    ),
  ],
};
