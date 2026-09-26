import { Routes } from '@angular/router';

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
  { path: 'tools', pathMatch: 'full', redirectTo: 'tools/margin' },
  {
    path: 'tools/:tool',
    loadComponent: () => import('./features/tools/tools.page').then((m) => m.ToolsPage),
  },
  { path: '**', redirectTo: 'lines' },
];
