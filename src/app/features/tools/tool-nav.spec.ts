import { describe, expect, it } from 'vitest';
import { TOOL_NAV, toolPageTitle } from './tool-nav';

describe('toolPageTitle', () => {
  it('names each tool by its label in the tool list', () => {
    for (const tool of TOOL_NAV) expect(toolPageTitle(tool.id)).toBe(`${tool.label} · Tools`);
  });

  it('titles an unknown tool as the margin calculator, the tool that page shows', () => {
    expect(toolPageTitle('nope')).toBe('Margin calculator · Tools');
    expect(toolPageTitle(null)).toBe('Margin calculator · Tools');
  });
});
