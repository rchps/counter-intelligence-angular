import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ThemeService } from '../core/theme.service';

// Ported from template.html's <header class="topbar">. The old role="tablist" (page.js section 8) is
// gone: these are real routes now, so real <a routerLink> navigation replaces the ARIA tabs pattern, and
// ariaCurrentWhenActive="page" replaces aria-selected. The "Feedback" button is left out for now — it
// only ever opens the feedback dialog, which doesn't exist until that's built.
@Component({
  selector: 'app-top-bar',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './top-bar.component.html',
  styleUrl: './top-bar.component.scss',
})
export class TopBarComponent {
  protected readonly theme = inject(ThemeService);
}
