import { inject } from '@angular/core';
import { Routes } from '@angular/router';
import { StorageService } from './core/storage.service';
import { isToolId, TOOL_STORAGE_KEY, toolPageTitle } from './features/tools/tool-nav';

// One route per section (/lines, /branches, /tools/:tool), each loaded only when it's first opened, so
// every section has its own address to bookmark or share. Each `title` names the page in the browser tab;
// PageTitleStrategy (core/page-title.strategy.ts) adds the app's name after it.
export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'lines' },
  {
    path: 'lines',
    // The search (?q=) stays out of the title: it changes with every keystroke, and the tab would be
    // renamed each time for a search that's usually gone a minute later.
    title: 'Line Card',
    loadComponent: () => import('./features/line-card/line-card.page').then((m) => m.LineCardPage),
  },
  {
    path: 'branches',
    title: 'Branches',
    loadComponent: () => import('./features/branches/branches.page').then((m) => m.BranchesPage),
  },
  {
    path: 'tools',
    pathMatch: 'full',
    // Reopens the last tool used (saved by ToolsPage), defaulting to the margin calculator.
    redirectTo: () => {
      const saved = inject(StorageService).get(TOOL_STORAGE_KEY);
      return `tools/${isToolId(saved) ? saved : 'margin'}`;
    },
  },
  {
    path: 'tools/:tool',
    // One route for every tool, so the title comes from the :tool in the address. Like any resolver it
    // runs again when :tool changes, so moving between tools retitles the page without a reload.
    title: (route) => toolPageTitle(route.paramMap.get('tool')),
    loadComponent: () => import('./features/tools/tools.page').then((m) => m.ToolsPage),
  },
  { path: '**', redirectTo: 'lines' },
];
