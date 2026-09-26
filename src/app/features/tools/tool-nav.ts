// Ported from page.js section 8b: TOOL_VIEWS (which tools exist, and their grouping) and TOOL_KEY (the
// localStorage key remembering the last tool used). Shared by app.routes.ts (the /tools redirect) and
// ToolsPage (the nav list + remembering what's chosen).

export type SizingToolId = 'battery' | 'vdrop' | 'poe' | 'nvr';
export type ToolId = 'margin' | SizingToolId | 'sales';

export const TOOL_STORAGE_KEY = 'sds-counter-reference:tool';

export interface ToolNavItem {
  id: ToolId;
  label: string;
  group: 'Quoting' | 'Sizing' | 'Tracking';
}

export const TOOL_NAV: ToolNavItem[] = [
  { id: 'margin', label: 'Margin calculator', group: 'Quoting' },
  { id: 'battery', label: 'Battery standby', group: 'Sizing' },
  { id: 'vdrop', label: 'Voltage drop', group: 'Sizing' },
  { id: 'poe', label: 'PoE budget', group: 'Sizing' },
  { id: 'nvr', label: 'NVR storage', group: 'Sizing' },
  { id: 'sales', label: 'Sales tracker', group: 'Tracking' },
];

export function isToolId(value: string | null | undefined): value is ToolId {
  return !!value && TOOL_NAV.some((tool) => tool.id === value);
}

export interface SizingToolHeading {
  title: string;
  tagline: string;
}

// tools.html's TOOL_TITLES: the "Counter tools" heading swaps to one of these the moment a sizing
// tool is picked (its own showTool() runs on load, so the plain "Counter tools." heading in the
// static markup never actually shows).
export const SIZING_TOOL_HEADINGS: Record<SizingToolId, SizingToolHeading> = {
  battery: { title: 'Battery standby.', tagline: 'Amp-hours for fire and security panels.' },
  vdrop: { title: 'Voltage drop.', tagline: 'Will the wire run make it?' },
  poe: { title: 'PoE budget.', tagline: 'Can the switch power it all?' },
  nvr: { title: 'NVR storage.', tagline: 'How much drive for the retention?' },
};

export function isSizingTool(id: ToolId): id is SizingToolId {
  return Object.hasOwn(SIZING_TOOL_HEADINGS, id);
}
