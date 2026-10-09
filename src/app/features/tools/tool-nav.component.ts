import { Component, computed, ElementRef, inject, input, signal, viewChild } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { TOOL_NAV, type ToolId, type ToolNavItem } from './tool-nav';

interface ToolNavGroup {
  group: string;
  items: ToolNavItem[];
}

// The list of tools, grouped (Quoting / Sizing / Tracking). On a wide screen it's a sidebar. Where
// there's no room for one, it folds behind a "Tools" button naming the current tool, so the calculator
// starts near the top of the screen instead of under six buttons. The button and list follow the
// WAI-ARIA disclosure pattern (a button with aria-expanded showing a list of ordinary links), not the
// menu pattern: these are links to pages, not commands.
@Component({
  selector: 'app-tool-nav',
  imports: [RouterLink, RouterLinkActive],
  host: {
    '(document:click)': 'closeIfOutside($event.target)',
    '(focusout)': 'closeIfOutside($event.relatedTarget)',
    '(keydown.escape)': 'closeAndFocusToggle()',
  },
  templateUrl: './tool-nav.component.html',
  styleUrl: './tool-nav.component.scss',
})
export class ToolNavComponent {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly toggle = viewChild.required<ElementRef<HTMLButtonElement>>('toggle');

  readonly current = input.required<ToolId>();

  protected readonly open = signal(false);
  protected readonly currentLabel = computed(
    () => TOOL_NAV.find((item) => item.id === this.current())?.label ?? '',
  );

  protected readonly groups: ToolNavGroup[] = ['Quoting', 'Sizing', 'Tracking'].map((group) => ({
    group,
    items: TOOL_NAV.filter((item) => item.group === group),
  }));

  protected close(): void {
    this.open.set(false);
  }

  // A click or focus landing anywhere outside the list closes it, as a dropdown is expected to.
  protected closeIfOutside(target: EventTarget | null): void {
    if (!(target instanceof Node) || !this.host.nativeElement.contains(target)) this.close();
  }

  // Esc closes the list and puts focus back on the button that opened it.
  protected closeAndFocusToggle(): void {
    if (!this.open()) return;
    this.close();
    this.toggle().nativeElement.focus();
  }
}
