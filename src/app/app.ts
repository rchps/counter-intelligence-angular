import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Component, ElementRef, inject, viewChild } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, skip } from 'rxjs';
import { TopBarComponent } from './layout/top-bar.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, TopBarComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);
  private readonly mainContent = viewChild.required<ElementRef<HTMLElement>>('mainContent');

  // Angular's a11y guidance: move focus to the main content on navigation, so keyboard/screen-reader
  // users get feedback that the page changed instead of focus silently staying on a removed nav link.
  // Skip the very first NavigationEnd (initial load) — there's nothing to return focus to yet.
  constructor() {
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        skip(1),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.mainContent().nativeElement.focus());
  }
}
