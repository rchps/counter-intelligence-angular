import {
  DestroyRef,
  ElementRef,
  inject,
  Component,
  computed,
  model,
  signal,
  viewChild,
  input,
} from '@angular/core';

let nextId = 0;

// Ported from page.js's createSearchPage() search-box half (page.js section 2): placeholder swaps by
// width, Ctrl/Cmd+K (or "/" outside a field) focuses and selects, Esc clears (or blurs if already empty).
// Only one instance is ever mounted at a time now (routing replaced the old always-in-the-DOM tabs), so
// the global shortcut listens for itself directly instead of going through a page-picking coordinator.
@Component({
  selector: 'app-search-toolbar',
  styleUrl: './search-toolbar.component.scss',
  template: `
    <div class="search" [class.has-value]="!!search()">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <label class="sr-only" [for]="inputId">{{ inputLabel() }}</label>
      <input
        #searchInput
        [id]="inputId"
        type="search"
        autocomplete="off"
        spellcheck="false"
        [placeholder]="placeholder()"
        [value]="search()"
        (input)="search.set($any($event.target).value)"
        (keydown)="onInputKeydown($event)"
      />
      <span class="kbd" aria-hidden="true">
        <kbd class="kbd-mod">{{ isMac ? '⌘' : 'Ctrl' }}</kbd
        ><kbd>K</kbd>
      </span>
      <button type="button" class="clear" (click)="clear()">Clear</button>
    </div>
    <ng-content select="[toolbarExtras]" />
  `,
})
export class SearchToolbarComponent {
  readonly inputLabel = input.required<string>();
  readonly placeholderWide = input.required<string>();
  readonly placeholderNarrow = input.required<string>();
  readonly search = model('');

  protected readonly inputId = `search-${++nextId}`;
  protected readonly isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  private readonly inputRef = viewChild.required<ElementRef<HTMLInputElement>>('searchInput');
  private readonly narrowScreen = matchMedia('(max-width: 640px)');
  private readonly isNarrow = signal(this.narrowScreen.matches);
  protected readonly placeholder = computed(() =>
    this.isNarrow() ? this.placeholderNarrow() : this.placeholderWide(),
  );

  constructor() {
    const onNarrowChange = (event: MediaQueryListEvent) => this.isNarrow.set(event.matches);
    this.narrowScreen.addEventListener('change', onNarrowChange);

    const onGlobalKeydown = (event: KeyboardEvent) => {
      const typingInAField = /^(INPUT|TEXTAREA|SELECT)$/.test(
        document.activeElement?.tagName ?? '',
      );
      const isCtrlK = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
      if (!isCtrlK && !(event.key === '/' && !typingInAField)) return;
      event.preventDefault();
      this.focusAndSelect();
    };
    document.addEventListener('keydown', onGlobalKeydown);

    inject(DestroyRef).onDestroy(() => {
      this.narrowScreen.removeEventListener('change', onNarrowChange);
      document.removeEventListener('keydown', onGlobalKeydown);
    });
  }

  protected onInputKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    if (this.search()) this.search.set('');
    else (event.target as HTMLInputElement).blur();
  }

  protected clear(): void {
    this.search.set('');
    this.focusAndSelect();
  }

  private focusAndSelect(): void {
    const element = this.inputRef().nativeElement;
    element.focus();
    element.select();
  }
}
