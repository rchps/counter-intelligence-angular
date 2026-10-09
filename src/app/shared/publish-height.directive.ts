import { afterNextRender, DestroyRef, Directive, ElementRef, inject, input } from '@angular/core';

// Publishes its element's height as a custom property on <html> (named by the input, like "--toolbar-h"),
// kept current as the element resizes, so whatever sticks below a sticky bar can sit right under it. The
// height is read from the ResizeObserver's border box, not offsetHeight: that's rounded to a whole pixel,
// which could leave a sliver of gap between the bar and what's stuck under it. A transform (the bars
// sliding away on a phone) doesn't change it. The property is removed with the element, so a page without
// it falls back to the stylesheet's default.
@Directive({ selector: '[appPublishHeight]' })
export class PublishHeightDirective {
  readonly appPublishHeight = input.required<string>();

  constructor() {
    const element = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const root = document.documentElement;
    const publishHeight = new ResizeObserver(([entry]) =>
      root.style.setProperty(this.appPublishHeight(), `${entry.borderBoxSize[0].blockSize}px`),
    );
    afterNextRender(() => publishHeight.observe(element));
    inject(DestroyRef).onDestroy(() => {
      publishHeight.disconnect();
      root.style.removeProperty(this.appPublishHeight());
    });
  }
}
