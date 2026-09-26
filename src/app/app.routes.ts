import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { StorageService } from './core/storage.service';
import { isToolId, TOOL_STORAGE_KEY } from './features/tools/tool-nav';

// Ported from the architecture map in ANGULAR_CONVERSION.md: tabs #tab=lines/branches/tools become real
// routes /lines, /branches, /tools/:tool. No legacy-hash redirect (#tab=...) — nobody has bookmarked the
// vanilla page yet, so there's nothing to migrate.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'lines' },
  {
    path: 'lines',
    loadComponent: () => import('./features/line-card/line-card.page').then((m) => m.LineCardPage),
  },
  {
    path: 'branches',
    loadComponent: () => import('./features/branches/branches.page').then((m) => m.BranchesPage),
  },
  {
    path: 'tools',
    pathMatch: 'full',
    // Remembers the last tool used (page.js section 8b's TOOL_KEY), defaulting to the margin calculator.
    redirectTo: () => {
      const saved = inject(StorageService).get(TOOL_STORAGE_KEY);
      return `tools/${isToolId(saved) ? saved : 'margin'}`;
    },
  },
  {
    path: 'tools/:tool',
    loadComponent: () => import('./features/tools/tools.page').then((m) => m.ToolsPage),
  },
  { path: '**', redirectTo: 'lines' },
];
