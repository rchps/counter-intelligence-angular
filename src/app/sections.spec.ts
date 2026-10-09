import { describe, expect, it } from 'vitest';
import { routes } from './app.routes';
import { SECTIONS } from './sections';

describe('SECTIONS', () => {
  it('has a route for every section', () => {
    const paths = routes.map((route) => '/' + route.path);
    for (const section of SECTIONS) expect(paths).toContain(section.path);
  });

  it('gives every section its own key and path', () => {
    expect(new Set(SECTIONS.map((section) => section.key)).size).toBe(SECTIONS.length);
    expect(new Set(SECTIONS.map((section) => section.path)).size).toBe(SECTIONS.length);
  });
});
