import { computed, inject, Service, signal } from '@angular/core';
import { StorageService } from './storage.service';

export type Theme = 'light' | 'dark';

const THEME_KEY = 'sds-theme';

// Follows the computer's setting until someone flips the switch, then
// remembers the choice. The colors themselves already follow the system live through the plain CSS media
// query in styles.scss; explicitTheme only overrides that, and isDark only tracks it for the switch's UI.
@Service()
export class ThemeService {
  private readonly storage = inject(StorageService);

  private readonly explicitTheme = signal<Theme | null>(null);

  readonly isDark = computed(
    () =>
      this.explicitTheme() === 'dark' ||
      (this.explicitTheme() === null && matchMedia('(prefers-color-scheme: dark)').matches),
  );

  constructor() {
    const saved = this.readSavedTheme();
    if (saved) this.applyTheme(saved);
  }

  toggle(): void {
    const next: Theme = this.isDark() ? 'light' : 'dark';
    this.applyTheme(next);
    this.storage.set(THEME_KEY, next);
  }

  private applyTheme(theme: Theme): void {
    this.explicitTheme.set(theme);
    document.documentElement.dataset['theme'] = theme;
  }

  private readSavedTheme(): Theme | null {
    const saved = this.storage.get(THEME_KEY);
    return saved === 'light' || saved === 'dark' ? saved : null;
  }
}
