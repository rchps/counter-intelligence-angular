import { Component, computed, effect, inject, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FeedbackService } from '../../core/feedback.service';
import { StorageService } from '../../core/storage.service';
import { BatteryToolComponent } from './battery-tool.component';
import { MarginCalculatorComponent } from './margin-calculator.component';
import { NvrStorageToolComponent } from './nvr-storage-tool.component';
import { PoeBudgetToolComponent } from './poe-budget-tool.component';
import { SalesTrackerComponent } from './sales-tracker.component';
import {
  isSizingTool,
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

// A grouped list of tools (Quoting / Sizing / Tracking) on the left, the chosen tool on the right.
// Each tool is its own route, so the list is plain routerLinks.
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

  // Battery/voltage-drop/PoE/NVR share an eyebrow and lede, each with its own title + tagline
  // (SIZING_TOOL_HEADINGS). Margin and sales bring their own heading entirely.
  protected readonly sizingHeading = computed(() => {
    const tool = this.currentTool();
    return isSizingTool(tool) ? SIZING_TOOL_HEADINGS[tool] : null;
  });

  constructor() {
    effect(() => this.storage.set(TOOL_STORAGE_KEY, this.currentTool()));

    // The Tools tab is "Tools · <tool>", and a problem report from it starts on "A calculator
    // looks off" — except from the sales tracker, which isn't a calculator (and whose numbers are never
    // put in an email: there's deliberately no search/page state here to include).
    inject(FeedbackService).registerPage(
      computed(() => {
        const tool = this.currentTool();
        const label = TOOL_NAV.find((item) => item.id === tool)?.label ?? '';
        return {
          tabName: `Tools · ${label}`,
          defaultKind: tool === 'sales' ? null : 'tool',
          search: null,
        };
      }),
    );
  }
}
