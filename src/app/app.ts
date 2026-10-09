import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { distinctUntilChanged, filter, map, skip } from 'rxjs';
import { FeedbackService } from './core/feedback.service';
import { FeedbackDialogComponent } from './features/feedback/feedback-dialog.component';
import { FeedbackCardComponent } from './layout/feedback-card.component';
import { FooterComponent } from './layout/footer.component';
import { SectionSwipeDirective } from './layout/section-swipe.directive';
import { TopBarComponent } from './layout/top-bar.component';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    TopBarComponent,
    FeedbackCardComponent,
    FeedbackDialogComponent,
    FooterComponent,
    SectionSwipeDirective,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected readonly feedback = inject(FeedbackService);
  private readonly router = inject(Router);
  private readonly mainContent = viewChild.required<ElementRef<HTMLElement>>('mainContent');

  // Angular's a11y guidance: move focus to the main content on navigation, so keyboard/screen-reader
  // users get feedback that the page changed instead of focus silently staying on a removed nav link.
  // Only a new page counts: the Line Card also navigates to keep ?q= and its filters in the address
  // bar, and moving focus then would pull it out of the search box after every keystroke. The first
  // page (initial load) is skipped too — there's nothing to return focus to yet.
  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        map((event) => event.urlAfterRedirects.split(/[?#]/)[0]),
        distinctUntilChanged(),
        skip(1),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.mainContent().nativeElement.focus());
  }
}
