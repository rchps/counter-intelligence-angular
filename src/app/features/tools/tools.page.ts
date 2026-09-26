import { Component, input } from '@angular/core';

// Placeholder for Phase 4 (ANGULAR_CONVERSION.md): the route exists now, bound to the :tool param via
// component input binding, so the shell's navigation can be exercised end to end; this template is
// replaced wholesale when the real grouped tools list + calculators are built.
@Component({
  selector: 'app-tools-page',
  template: `
    <section class="wrap">
      <h1>Tools</h1>
      <p>{{ tool() }} — coming in Phase 4.</p>
    </section>
  `,
})
export class ToolsPage {
  readonly tool = input('margin');
}
