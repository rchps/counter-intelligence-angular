import { Location } from '@angular/common';
import { Component, DestroyRef, inject, input, signal } from '@angular/core';

// "#" (for names that don't start with a letter) sorts first. Exported so LineCardPage can build
// matching ids for each letter's <section>.
export function azAnchorId(letter: string): string {
  return 'L-' + (letter === '#' ? 'num' : letter);
}

@Component({
  selector: 'app-az-jump-bar',
  styleUrl: './az-jump-bar.component.scss',
  template: `
    @if (letters().length > 3) {
      <nav class="letters" aria-label="Jump to letter">
        @for (letter of letters(); track letter) {
          <a data-cy="az-letter" [href]="href(letter)" (click)="jump($event, letter)">{{
            letter
          }}</a>
        }
      </nav>
    }
  `,
})
export class AzJumpBarComponent {
  readonly letters = input.required<string[]>();

  private readonly location = inject(Location);
  // The page's own address, kept current as the Line Card rewrites its query (?q=&view=az), so a letter
  // opened in a new tab lands on this view. A bare "#L-M" would resolve against <base href="/"> instead:
  // the site root, which loads /lines at the top in the default view.
  private readonly path = signal(this.location.path());

  constructor() {
    const stop = this.location.onUrlChange(() => this.path.set(this.location.path()));
    inject(DestroyRef).onDestroy(stop);
  }

  protected href(letter: string): string {
    return this.location.prepareExternalUrl(`${this.path()}#${azAnchorId(letter)}`);
  }

  // Scrolled here rather than left to the browser, which would put the heading behind the sticky bars,
  // and add a history entry for every letter tapped. Focus moves to the heading, so keyboard and screen
  // reader users carry on from the letter they picked. A modified click (new tab, new window) follows
  // the href.
  protected jump(event: MouseEvent, letter: string): void {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)
      return;
    const group = document.getElementById(azAnchorId(letter));
    const heading = group?.querySelector('h2');
    if (!group || !heading) return;
    event.preventDefault();

    alignBelowBars(group);
    heading.focus({ preventScroll: true });
    // On a phone, focus below the bars slides them away (HideBarsOnScrollDirective), freeing the room
    // they held, so the group moves up into it.
    alignBelowBars(group);
  }
}

// Puts the top of the letter's group right where its heading sticks, below the bars. The group, not the
// heading: a sticky heading already held at the top (the letter being scrolled through) is on screen
// where it's stuck, not where its group starts. The heading's own padding leaves room above its text.
function alignBelowBars(group: HTMLElement): void {
  const top = group.getBoundingClientRect().top + scrollY - stuckBarsBottom();
  scrollTo({ top, behavior: 'instant' });
}

// How far down the screen the sticky bars reach once they're held at the top: nowhere while they're slid
// away, otherwise the bottom of the search toolbar. Read from its sticky offset and height, not from where
// it is on screen, which is mid-slide just after the bars hide or come back.
function stuckBarsBottom(): number {
  const toolbar = document.querySelector<HTMLElement>('.toolbar');
  if (!toolbar || document.documentElement.classList.contains('bars-hidden')) return 0;
  return parseFloat(getComputedStyle(toolbar).top) + toolbar.offsetHeight;
}
