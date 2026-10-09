import { DestroyRef, Directive, ElementRef, inject } from '@angular/core';
import { Router } from '@angular/router';
import { adjacentSection, swipeDirection } from '../core/section-swipe';

// Swiping sideways on a touch screen moves to the next or previous section (core/section-swipe.ts). It's
// a shortcut alongside the top bar's links, not a replacement for them (WCAG 2.5.1), so anything that
// already uses a sideways drag keeps it: a row that scrolls sideways, a form field, or a [data-no-swipe]
// element like the sales chart, which drags to read its values.
//
// The listeners are added by hand rather than through `host` so they can be passive: the browser then
// starts scrolling at once instead of waiting to see whether the handler cancels it.
@Directive({ selector: '[appSectionSwipe]' })
export class SectionSwipeDirective {
  private readonly router = inject(Router);
  private start: { x: number; y: number; time: number } | null = null;

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const onStart = (event: TouchEvent): void => this.onTouchStart(event);
    const onEnd = (event: TouchEvent): void => this.onTouchEnd(event);
    const onCancel = (): void => {
      this.start = null;
    };
    element.addEventListener('touchstart', onStart, { passive: true });
    element.addEventListener('touchend', onEnd, { passive: true });
    element.addEventListener('touchcancel', onCancel, { passive: true });
    inject(DestroyRef).onDestroy(() => {
      element.removeEventListener('touchstart', onStart);
      element.removeEventListener('touchend', onEnd);
      element.removeEventListener('touchcancel', onCancel);
    });
  }

  private onTouchStart(event: TouchEvent): void {
    // A second finger means a pinch, and a zoomed-in page pans sideways on its own.
    const zoomed = (visualViewport?.scale ?? 1) > 1.01;
    if (event.touches.length > 1 || zoomed || !swipeAllowedFrom(event.target)) {
      this.start = null;
      return;
    }
    const touch = event.touches[0];
    this.start = { x: touch.clientX, y: touch.clientY, time: event.timeStamp };
  }

  private onTouchEnd(event: TouchEvent): void {
    const start = this.start;
    this.start = null;
    const touch = event.changedTouches[0];
    if (!start || !touch || hasTextSelection()) return;

    const direction = swipeDirection(
      touch.clientX - start.x,
      touch.clientY - start.y,
      event.timeStamp - start.time,
    );
    const target = direction && adjacentSection(this.router.url, direction);
    if (target) void this.router.navigateByUrl(target);
  }
}

function swipeAllowedFrom(target: EventTarget | null): boolean {
  for (let el = target instanceof Element ? target : null; el; el = el.parentElement) {
    if (el.matches('input, textarea, select, [contenteditable], [data-no-swipe]')) return false;
    if (scrollsSideways(el)) return false;
  }
  return true;
}

function scrollsSideways(el: Element): boolean {
  if (el.scrollWidth <= el.clientWidth) return false;
  const { overflowX } = getComputedStyle(el);
  return overflowX === 'auto' || overflowX === 'scroll';
}

function hasTextSelection(): boolean {
  const selection = getSelection();
  return !!selection && !selection.isCollapsed;
}
