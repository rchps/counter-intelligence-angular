import { Component, computed, ElementRef, signal, viewChild } from '@angular/core';
import {
  calculateMargin,
  formatPercent,
  type MarginField,
  type MarginMode,
} from '../../core/margin-math';
import { formatDollarsAndCents } from '../../core/money';
import { inputValue } from '../../shared/input-value';

/** What the results panel shows. rawPrice is the unformatted price for the Copy button; null when there's
 *  no price to copy yet. */
interface MarginDisplay {
  price: string;
  cost: string;
  profit: string;
  margin: string;
  markup: string;
  belowCost: boolean;
  canCopy: boolean;
  rawPrice: number | null;
}

const EMPTY_DISPLAY: MarginDisplay = {
  price: '—',
  cost: '—',
  profit: '—',
  margin: '—',
  markup: '—',
  belowCost: false,
  canCopy: false,
  rawPrice: null,
};

const MODES: { value: MarginMode; label: string }[] = [
  { value: 'cost-margin', label: 'Cost & margin' },
  { value: 'cost-price', label: 'Cost & price' },
  { value: 'price-margin', label: 'Price & margin' },
];

// Ported from counter-intelligence/calculator.html. The math and every validation message live in
// core/margin-math.ts — this component only renders calculateMargin()'s outcome and
// manages the small bits of local UI state (which mode, the copy button's temporary label).
@Component({
  selector: 'app-margin-calculator',
  templateUrl: './margin-calculator.component.html',
  styleUrl: './margin-calculator.component.scss',
})
export class MarginCalculatorComponent {
  protected readonly inputValue = inputValue;
  protected readonly modes = MODES;

  protected readonly mode = signal<MarginMode>('cost-margin');
  protected readonly costText = signal('');
  protected readonly priceText = signal('');
  protected readonly marginText = signal('');
  protected readonly copyLabel = signal('Copy price');
  private copyResetTimer?: ReturnType<typeof setTimeout>;

  private readonly costInput = viewChild<ElementRef<HTMLInputElement>>('costInput');
  private readonly priceInput = viewChild<ElementRef<HTMLInputElement>>('priceInput');

  protected readonly showCostField = computed(() => this.mode() !== 'price-margin');
  protected readonly showPriceField = computed(() => this.mode() !== 'cost-margin');
  protected readonly showMarginField = computed(() => this.mode() !== 'cost-price');
  protected readonly costIsCalculated = computed(() => this.mode() === 'price-margin');

  protected readonly outcome = computed(() =>
    calculateMargin(this.mode(), {
      cost: this.costText(),
      price: this.priceText(),
      margin: this.marginText(),
    }),
  );

  protected readonly invalidFields = computed<Set<MarginField>>(() => {
    const outcome = this.outcome();
    return outcome.status === 'invalid' ? new Set(outcome.invalidFields) : new Set();
  });

  protected readonly messageText = computed(() => {
    const outcome = this.outcome();
    return outcome.status === 'incomplete' ? '' : outcome.message;
  });
  protected readonly messageIsError = computed(() => this.outcome().status === 'invalid');

  protected readonly display = computed<MarginDisplay>(() => {
    const outcome = this.outcome();
    if (outcome.status !== 'ok') return EMPTY_DISPLAY;
    return {
      price: formatDollarsAndCents(outcome.price),
      cost: formatDollarsAndCents(outcome.cost),
      profit: formatDollarsAndCents(outcome.profit),
      margin: formatPercent(outcome.margin),
      markup: outcome.markup !== null ? formatPercent(outcome.markup) : 'n/a',
      belowCost: outcome.belowCost,
      canCopy: true,
      rawPrice: outcome.price,
    };
  });

  protected onModeChange(mode: MarginMode): void {
    this.mode.set(mode);
  }

  protected clearAll(): void {
    this.costText.set('');
    this.priceText.set('');
    this.marginText.set('');
    const target = this.mode() === 'price-margin' ? this.priceInput() : this.costInput();
    target?.nativeElement.focus();
  }

  protected async copyPrice(): Promise<void> {
    const price = this.display().rawPrice;
    if (price === null) return;
    const plainNumber = price.toFixed(2);

    let copied = false;
    try {
      await navigator.clipboard.writeText(plainNumber);
      copied = true;
    } catch {
      // copied stays false
    }

    this.copyLabel.set(copied ? `Copied ${plainNumber}` : 'Copy failed');
    clearTimeout(this.copyResetTimer);
    this.copyResetTimer = setTimeout(() => this.copyLabel.set('Copy price'), 2500);
  }
}
