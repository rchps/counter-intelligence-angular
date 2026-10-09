import { afterNextRender, Component, DestroyRef, ElementRef, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FeedbackService } from '../core/feedback.service';
import { ThemeService } from '../core/theme.service';
import { SECTIONS } from '../sections';

// The sections are real routes, so they're plain <a routerLink> navigation (not the ARIA tabs pattern),
// with ariaCurrentWhenActive="page" marking the current one. role="banner" makes this the landmark that
// holds the brand, nav and page-wide controls, as a top-level <header> would.
//
// Its height is published as --bar-h, the offset for whatever sticks below it (a search page's toolbar,
// the tools sidebar). That height changes: below 900px the nav wraps onto a second row, and at
// the narrowest widths the theme switch wraps too.
@Component({
  selector: 'app-top-bar',
  imports: [RouterLink, RouterLinkActive],
  host: { role: 'banner', 'data-cy': 'top-bar' },
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly feedback = inject(FeedbackService);
  protected readonly sections = SECTIONS;

  constructor() {
    const bar = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const publishHeight = new ResizeObserver(() =>
      document.documentElement.style.setProperty('--bar-h', `${bar.offsetHeight}px`),
    );
    afterNextRender(() => publishHeight.observe(bar));
    inject(DestroyRef).onDestroy(() => publishHeight.disconnect());
  }
}
