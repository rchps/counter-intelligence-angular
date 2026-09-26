// Ported from page.js section 8b: TOOL_VIEWS (which tools exist, and their grouping) and TOOL_KEY (the
// localStorage key remembering the last tool used). Shared by app.routes.ts (the /tools redirect) and
// ToolsPage (the nav list + remembering what's chosen).

export type ToolId = 'margin' | 'battery' | 'vdrop' | 'poe' | 'nvr' | 'sales';

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
