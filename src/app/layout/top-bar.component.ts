import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FeedbackService } from '../core/feedback.service';
import { ThemeService } from '../core/theme.service';
import { SECTIONS } from '../sections';

// The sections are real routes, so they're plain <a routerLink> navigation (not the ARIA tabs pattern),
// with ariaCurrentWhenActive="page" marking the current one. role="banner" makes this the landmark that
// holds the brand, nav and page-wide controls, as a top-level <header> would.
@Component({
  selector: 'app-top-bar',
  imports: [RouterLink, RouterLinkActive],
  host: { role: 'banner' },
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent {
  protected readonly theme = inject(ThemeService);
  protected readonly feedback = inject(FeedbackService);
  protected readonly sections = SECTIONS;
}
