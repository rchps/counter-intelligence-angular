import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { barsAfterScroll, type BarsScrollState } from '../core/bars-on-scroll';

// On a phone, the top bar (this directive's element) and a search page's sticky toolbar slide out of
// the way while someone scrolls down, and come back when they scroll up (core/bars-on-scroll.ts). Focus
// overrides scrolling: the bars stay while focus is in either of them (typing a search, with the
// on-screen keyboard open), and go when focus moves into the page below them, so they never cover the
// focused element (WCAG 2.4.11). The sliding itself is CSS, keyed on .bars-hidden on <html> (see
// styles.scss's toolbar). Wider screens have the room to keep both in place.
@Directive({ selector: '[appHideBarsOnScroll]' })
export class HideBarsOnScrollDirective {
  private readonly bar = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly phone = matchMedia('(max-width: 640px)');
  private state: BarsScrollState = { hidden: false, anchorY: scrollY };
  private frame = 0;

  constructor() {
    // At most one check per frame, however many scroll events arrive.
    const onScroll = (): void => {
      this.frame ||= requestAnimationFrame(() => {
        this.frame = 0;
        this.onScroll();
      });
    };
    const onFocusIn = (event: FocusEvent): void => this.onFocusIn(event.target);
    const onWidthChange = (): void => this.show();

    addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('focusin', onFocusIn);
    this.phone.addEventListener('change', onWidthChange);
    inject(DestroyRef).onDestroy(() => {
      removeEventListener('scroll', onScroll);
      document.removeEventListener('focusin', onFocusIn);
      this.phone.removeEventListener('change', onWidthChange);
      cancelAnimationFrame(this.frame);
      this.show();
    });
  }

  private onScroll(): void {
    if (!this.phone.matches || this.isInBars(document.activeElement)) {
      this.show();
      return;
    }
    this.setState(barsAfterScroll({ ...this.state, y: scrollY, stuck: this.barsAreStuck() }));
  }

  private onFocusIn(target: EventTarget | null): void {
    if (!this.phone.matches) return;
    const hidden = !this.isInBars(target) && this.barsAreStuck();
    this.setState({ hidden, anchorY: scrollY });
  }

  private show(): void {
    this.setState({ hidden: false, anchorY: scrollY });
  }

  private setState(state: BarsScrollState): void {
    this.state = state;
    document.documentElement.classList.toggle('bars-hidden', state.hidden);
  }

  // The page's search toolbar, if it has one (Line Card and Branches do).
  private toolbar(): HTMLElement | null {
    return document.querySelector('.toolbar');
  }

  private isInBars(target: EventTarget | null): boolean {
    if (!(target instanceof Node)) return false;
    return this.bar.contains(target) || !!this.toolbar()?.contains(target);
  }

  // A toolbar is held at the top once it has reached the bottom of the top bar. Without one, it's the
  // top bar alone, which is held there as soon as the page scrolls past it.
  private barsAreStuck(): boolean {
    const toolbar = this.toolbar();
    if (!toolbar) return scrollY > this.bar.offsetHeight;
    return toolbar.getBoundingClientRect().top <= this.bar.getBoundingClientRect().bottom + 1;
  }
}
