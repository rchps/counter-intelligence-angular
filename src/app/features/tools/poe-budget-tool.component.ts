import { Component, computed, signal } from '@angular/core';
import { POE_CLASSES, poeBudget, readPositiveNumber, type PoeDevice } from '../../core/tools-math';
import { ToolResultCardComponent } from './tool-result-card.component';
import { inputValue } from '../../shared/input-value';

type PoeBasis = 'pse' | 'pd';

interface PoeDeviceRow {
  id: number;
  quantityText: string;
  /** A POE_CLASSES key as a string, or 'watts' for a manually-entered wattage. */
  classChoice: string;
  wattsText: string;
}

interface ParsedDevices {
  list: PoeDevice[];
  bad: boolean;
}

// Ported from tools.html's PoE budget tool.
@Component({
  selector: 'app-poe-budget-tool',
  imports: [ToolResultCardComponent],
  templateUrl: './poe-budget-tool.component.html',
})
export class PoeBudgetToolComponent {
  protected readonly inputValue = inputValue;
  protected readonly classOptions = Object.keys(POE_CLASSES);

  protected readonly budgetText = signal('');
  protected readonly basis = signal<PoeBasis>('pse');
  protected readonly devices = signal<PoeDeviceRow[]>([
    { id: 1, quantityText: '', classChoice: '3', wattsText: '' },
  ]);
  private nextId = 2;

  private readonly budget = computed(() => readPositiveNumber(this.budgetText()));

  private readonly parsedDevices = computed<ParsedDevices>(() => {
    let bad = this.budget().bad;
    const list: PoeDevice[] = [];
    for (const row of this.devices()) {
      const quantity = readPositiveNumber(row.quantityText);
      const wholeNumber = isFinite(quantity.value) && Number.isInteger(quantity.value);
      const watts = readPositiveNumber(row.wattsText);
      if (
        quantity.bad ||
        (isFinite(quantity.value) && !wholeNumber) ||
        (row.classChoice === 'watts' && watts.bad)
      ) {
        bad = true;
      }
      if (!isFinite(quantity.value) || quantity.value === 0) continue;
      if (row.classChoice === 'watts') {
        if (isFinite(watts.value)) list.push({ quantity: quantity.value, watts: watts.value });
      } else {
        list.push({ quantity: quantity.value, poeClass: Number(row.classChoice) });
      }
    }
    return { list, bad };
  });

  protected readonly message = computed(() =>
    this.parsedDevices().bad ? 'Use positive numbers only (whole numbers for quantity).' : '',
  );

  protected readonly hasBudget = computed(() => isFinite(this.budget().value));

  protected readonly result = computed(() => {
    const { list, bad } = this.parsedDevices();
    if (bad || !list.length) return null;
    return poeBudget({
      budgetWatts: this.hasBudget() ? this.budget().value : 0,
      basis: this.basis(),
      devices: list,
    });
  });

  protected readonly fails = computed(() => this.hasBudget() && this.result()?.fits === false);

  protected readonly totalWattsDisplay = computed(() => {
    const result = this.result();
    return result ? result.totalWatts.toFixed(1) + ' W' : '—';
  });
  protected readonly budgetDisplay = computed(() =>
    this.hasBudget() ? this.budget().value.toFixed(1) + ' W' : '—',
  );
  protected readonly leftDisplay = computed(() => {
    const result = this.result();
    return this.hasBudget() && result ? result.leftWatts.toFixed(1) + ' W' : '—';
  });
  protected readonly percentDisplay = computed(() => {
    const result = this.result();
    return this.hasBudget() && result?.percentUsed !== null && result?.percentUsed !== undefined
      ? result.percentUsed.toFixed(0) + '%'
      : '—';
  });
  protected readonly portsDisplay = computed(() => this.result()?.ports ?? '—');
  protected readonly highestTypeDisplay = computed(() => this.result()?.highestPortType ?? '—');

  protected addDevice(): void {
    this.devices.update((rows) => [
      ...rows,
      { id: this.nextId++, quantityText: '', classChoice: '3', wattsText: '' },
    ]);
  }

  protected removeDevice(id: number): void {
    this.devices.update((rows) => rows.filter((row) => row.id !== id));
  }

  protected setQuantityText(id: number, text: string): void {
    this.devices.update((rows) =>
      rows.map((row) => (row.id === id ? { ...row, quantityText: text } : row)),
    );
  }

  protected setClassChoice(id: number, choice: string): void {
    this.devices.update((rows) =>
      rows.map((row) => (row.id === id ? { ...row, classChoice: choice } : row)),
    );
  }

  protected setWattsText(id: number, text: string): void {
    this.devices.update((rows) =>
      rows.map((row) => (row.id === id ? { ...row, wattsText: text } : row)),
    );
  }

  // With a class picked, the watts box just shows that class's number (read-only).
  protected wattsDisplay(row: PoeDeviceRow): string {
    const known = row.classChoice === 'watts' ? undefined : POE_CLASSES[Number(row.classChoice)];
    return known ? String(known[this.basis()]) : row.wattsText;
  }

  protected isWattsReadonly(row: PoeDeviceRow): boolean {
    return row.classChoice !== 'watts';
  }
}
