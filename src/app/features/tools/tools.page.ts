import { Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { StorageService } from '../../core/storage.service';
import { MarginCalculatorComponent } from './margin-calculator.component';
import { isToolId, TOOL_NAV, TOOL_STORAGE_KEY, type ToolId } from './tool-nav';

interface ToolNavGroup {
  group: string;
  items: typeof TOOL_NAV;
}

// Ported from page.js section 8b and template.html's #panel-tools: a grouped list of tools (Quoting /
// Sizing / Tracking) on the left, the chosen tool on the right — real routerLinks now instead of the
// vanilla's own picker buttons + hidden/shown views, since each tool is its own route.
@Component({
  selector: 'app-tools-page',
  imports: [RouterLink, RouterLinkActive, MarginCalculatorComponent],
  templateUrl: './tools.page.html',
  styleUrl: './tools.page.scss',
})
export class ToolsPage {
  private readonly storage = inject(StorageService);

  readonly tool = input('margin');
  protected readonly currentTool = computed<ToolId>(() => {
    const requested = this.tool();
    return isToolId(requested) ? requested : 'margin';
  });

  protected readonly navGroups: ToolNavGroup[] = ['Quoting', 'Sizing', 'Tracking'].map((group) => ({
    group,
    items: TOOL_NAV.filter((item) => item.group === group),
  }));

  constructor() {
    effect(() => this.storage.set(TOOL_STORAGE_KEY, this.currentTool()));
  }
}
