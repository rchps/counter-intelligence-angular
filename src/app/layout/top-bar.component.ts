import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FeedbackService } from '../core/feedback.service';
import { ThemeService } from '../core/theme.service';

// Ported from template.html's <header class="topbar">. The old role="tablist" (page.js section 8) is
// gone: these are real routes now, so real <a routerLink> navigation replaces the ARIA tabs pattern, and
// ariaCurrentWhenActive="page" replaces aria-selected. role="banner" is what the vanilla <header> gave
// assistive tech for free: the landmark that holds the brand, nav and page-wide controls.
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
}
