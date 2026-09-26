import { Component, computed, ElementRef, signal, viewChild } from '@angular/core';
import {
  calculateMargin,
  formatPercent,
  INPUTS_FOR_MODE,
  type MarginField,
  type MarginMode,
} from '../../core/margin-math';
import { formatDollarsAndCents } from '../../core/money';
import { inputValue } from '../../shared/input-value';

const MODES: { value: MarginMode; label: string }[] = [
  { value: 'cost-margin', label: 'Cost & margin' },
  { value: 'cost-price', label: 'Cost & price' },
  { value: 'price-margin', label: 'Price & margin' },
];

// Ported from counter-intelligence/calculator.html. The math and every validation message live in
// core/margin-math.ts (Phase 4 (1/N)) — this component only renders calculateMargin()'s outcome and
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

  protected readonly display = computed(() => {
    const outcome = this.outcome();
    if (outcome.status !== 'ok') {
      return {
        price: '—',
        cost: '—',
        profit: '—',
        margin: '—',
        markup: '—',
        belowCost: false,
        canCopy: false,
      };
    }
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

  protected fieldNeeded(field: MarginField): boolean {
    return INPUTS_FOR_MODE[this.mode()].includes(field);
  }

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
    const display = this.display();
    if (!display.canCopy || display.rawPrice === undefined) return;
    const plainNumber = display.rawPrice.toFixed(2);

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
