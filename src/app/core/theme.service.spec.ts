import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeService } from './theme.service';

function stubMatchMedia(matches: boolean): void {
  window.matchMedia = ((query: string) =>
    ({
      matches,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
  });

  it('follows the system preference when nothing is saved', () => {
    stubMatchMedia(true);
    const theme = TestBed.inject(ThemeService);
    expect(theme.isDark()).toBe(true);
  });

  it('restores a saved theme on construction, overriding the system preference', () => {
    stubMatchMedia(true); // system says dark
    localStorage.setItem('counter-intelligence:theme', 'light');
    const theme = TestBed.inject(ThemeService);
    expect(theme.isDark()).toBe(false);
    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('ignores a garbage saved value and falls back to the system preference', () => {
    stubMatchMedia(true);
    localStorage.setItem('counter-intelligence:theme', 'blue');
    const theme = TestBed.inject(ThemeService);
    expect(theme.isDark()).toBe(true);
    expect(document.documentElement.dataset['theme']).toBeUndefined();
  });

  it('toggle flips the theme, writes the DOM attribute, and persists the choice', () => {
    stubMatchMedia(false);
    const theme = TestBed.inject(ThemeService);
    expect(theme.isDark()).toBe(false);

    theme.toggle();
    expect(theme.isDark()).toBe(true);
    expect(document.documentElement.dataset['theme']).toBe('dark');
    expect(localStorage.getItem('counter-intelligence:theme')).toBe('dark');

    theme.toggle();
    expect(theme.isDark()).toBe(false);
    expect(document.documentElement.dataset['theme']).toBe('light');
    expect(localStorage.getItem('counter-intelligence:theme')).toBe('light');
  });
});
