import { describe, expect, it } from 'vitest';
import { documentTitle } from './page-title';

describe('documentTitle', () => {
  it('puts the page first, then the app', () => {
    expect(documentTitle('Line Card')).toBe('Line Card · Counter Intelligence');
    expect(documentTitle('PoE budget · Tools')).toBe('PoE budget · Tools · Counter Intelligence');
  });

  it('is just the app name for a page without a title', () => {
    expect(documentTitle(undefined)).toBe('Counter Intelligence');
    expect(documentTitle('')).toBe('Counter Intelligence');
  });
});
