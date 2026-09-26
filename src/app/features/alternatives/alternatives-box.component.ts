import { Component, input, output } from '@angular/core';
import type { AlternativeBrand } from '../../core/alternatives';

// Ported from modules/alternatives.html's suggestionBoxHtml: one box per not-carried brand the search
// points to, each offering SDS lines as buttons. Picking one searches for that line.
@Component({
  selector: 'app-alternatives-box',
  styleUrl: './alternatives-box.component.scss',
  template: `
    @for (brand of brands(); track brand.brand) {
      <section class="alt-box" [attr.aria-label]="'Alternatives to ' + brand.brand">
        <h2>Not an SDS line: {{ brand.brand }}</h2>
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
