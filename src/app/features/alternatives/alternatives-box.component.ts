import { Component, input, output } from '@angular/core';
import type { AlternativeBrand } from '../../core/alternatives';

// One box per not-carried brand the search
// points to, each offering lines we carry as buttons. Picking one searches for that line.
@Component({
  selector: 'app-alternatives-box',
  styleUrl: './alternatives-box.component.scss',
  template: `
    @for (brand of brands(); track brand.brand) {
      <section
        class="alt-box"
        data-tour="alternatives"
        [attr.aria-label]="'Alternatives to ' + brand.brand"
      >
        <h2 data-cy="alternative-heading">Not a line we carry: {{ brand.brand }}</h2>
        <p>
          @if (brand.note) {
            <span class="alt-note">{{ brand.note }}</span>
          }
          Lines we carry that cover the same ground:
        </p>
        <ul class="alt-list">
          @for (lineName of brand.offer; track lineName) {
            <li>
              <button type="button" (click)="pick.emit(lineName)">{{ lineName }}</button>
            </li>
          }
        </ul>
      </section>
    }
  `,
})
export class AlternativesBoxComponent {
  readonly brands = input.required<AlternativeBrand[]>();
  readonly pick = output<string>();
}
