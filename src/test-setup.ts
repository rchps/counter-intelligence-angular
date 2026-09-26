import { vi } from 'vitest';

// jsdom doesn't implement matchMedia. ThemeService (and anything that renders it, like TopBarComponent)
// needs it, so give every spec a safe default; theme.service.spec.ts overrides it per test.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = ((query: string) =>
    ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }) as unknown as MediaQueryList) as typeof window.matchMedia;
}
