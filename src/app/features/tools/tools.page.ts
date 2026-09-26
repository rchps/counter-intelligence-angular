import { Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { StorageService } from '../../core/storage.service';
import { BatteryToolComponent } from './battery-tool.component';
import { MarginCalculatorComponent } from './margin-calculator.component';
import { NvrStorageToolComponent } from './nvr-storage-tool.component';
import { PoeBudgetToolComponent } from './poe-budget-tool.component';
import { SalesTrackerComponent } from './sales-tracker.component';
import {
  isToolId,
  SIZING_TOOL_HEADINGS,
  TOOL_NAV,
  TOOL_STORAGE_KEY,
  type ToolId,
} from './tool-nav';
import { VoltageDropToolComponent } from './voltage-drop-tool.component';

interface ToolNavGroup {
  group: string;
  items: typeof TOOL_NAV;
}

// Ported from page.js section 8b and template.html's #panel-tools: a grouped list of tools (Quoting /
// Sizing / Tracking) on the left, the chosen tool on the right — real routerLinks now instead of the
// vanilla's own picker buttons + hidden/shown views, since each tool is its own route.
@Component({
  selector: 'app-tools-page',
  imports: [
    RouterLink,
    RouterLinkActive,
    MarginCalculatorComponent,
    BatteryToolComponent,
    VoltageDropToolComponent,
    PoeBudgetToolComponent,
    NvrStorageToolComponent,
    SalesTrackerComponent,
  ],
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

  // Battery/voltage-drop/PoE/NVR share tools.html's eyebrow and lede, but each swaps in its own
  // title + tagline (tools.html's TOOL_TITLES, applied by showTool() the moment a tool is picked).
  // Margin and sales bring their own heading entirely (each was its own vanilla page).
  protected readonly sizingHeading = computed(() => {
    const tool = this.currentTool();
    return tool === 'battery' || tool === 'vdrop' || tool === 'poe' || tool === 'nvr'
      ? SIZING_TOOL_HEADINGS[tool]
      : null;
  });

  constructor() {
    effect(() => this.storage.set(TOOL_STORAGE_KEY, this.currentTool()));
  }
}
