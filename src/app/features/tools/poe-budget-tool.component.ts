import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import {
  POE_CLASSES,
  poeBudget,
  poeRowMessage,
  readPoeRow,
  readPositiveNumber,
  type PoeDevice,
  type PoeRowProblem,
  type PoeRowReading,
} from '../../core/tools-math';
import { ToolResultCardComponent } from './tool-result-card.component';
import { inputValue } from '../../shared/input-value';

const KNOWN_WATTS = 'watts';

type PoeBasis = 'pse' | 'pd';

interface PoeDeviceRow {
  id: number;
  quantityText: string;
  /** A POE_CLASSES key. Kept even while a known wattage is chosen, so switching modes loses nothing. */
  classChoice: string;
  /** Size this row by the wattage typed in. Only honored when counting at the device's max draw. */
  useKnownWatts: boolean;
  wattsText: string;
}

interface ParsedDevices {
  list: PoeDevice[];
  /** The first row problem in list order, or null when every row is complete. */
  firstProblem: { problem: PoeRowProblem; deviceNumber: number } | null;
}

// PoE budget sizing: whether a switch can power every device.
@Component({
  selector: 'app-poe-budget-tool',
  imports: [ToolResultCardComponent],
  templateUrl: './poe-budget-tool.component.html',
})
export class PoeBudgetToolComponent {
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly addButton = viewChild.required<ElementRef<HTMLButtonElement>>('addButton');

  protected readonly inputValue = inputValue;
  protected readonly classOptions = Object.keys(POE_CLASSES);

  protected readonly budgetText = signal('');
  protected readonly basis = signal<PoeBasis>('pse');
  protected readonly devices = signal<PoeDeviceRow[]>([
    { id: 1, quantityText: '', classChoice: '3', useKnownWatts: false, wattsText: '' },
  ]);
  private nextId = 2;

  protected readonly budget = computed(() => readPositiveNumber(this.budgetText()));

  // Known watts only exists when counting at the device's max draw; when the switch reserves, the class
  // alone sets the wattage.
  protected usesKnownWatts(row: PoeDeviceRow): boolean {
    return this.basis() === 'pd' && row.useKnownWatts;
  }

  private readonly readings = computed<PoeRowReading[]>(() =>
    this.devices().map((row) =>
      readPoeRow({
        quantityText: row.quantityText,
        poeClass: this.usesKnownWatts(row) ? null : Number(row.classChoice),
        wattsText: row.wattsText,
      }),
    ),
  );

  private readonly parsedDevices = computed<ParsedDevices>(() => {
    const readings = this.readings();
    const list = readings.flatMap(({ device }) => (device ? [device] : []));
    const index = readings.findIndex(({ problem }) => problem !== null);
    const firstProblem =
      index < 0 ? null : { problem: readings[index].problem!, deviceNumber: index + 1 };
    return { list, firstProblem };
  });

  protected readonly message = computed(() => {
    if (this.budget().bad) return 'Use a positive number for the switch budget.';
    const { firstProblem } = this.parsedDevices();
    return firstProblem ? poeRowMessage(firstProblem.problem, firstProblem.deviceNumber) : '';
  });

  // Which inputs the message is about, so they can be marked invalid and tied to it.
  protected quantityInvalid(index: number): boolean {
    const problem = this.readings()[index]?.problem;
    return problem === 'quantity-invalid' || problem === 'quantity-missing';
  }

  protected wattsInvalid(index: number): boolean {
    const problem = this.readings()[index]?.problem;
    return problem === 'watts-invalid' || problem === 'watts-missing';
  }

  protected readonly hasBudget = computed(() => isFinite(this.budget().value));

  protected readonly result = computed(() => {
    const { list } = this.parsedDevices();
    if (this.message() || !list.length) return null;
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

  // A new row's quantity is the next thing to fill in, so focus goes there once the row is on the page.
  protected addDevice(): void {
    const id = this.nextId++;
    this.devices.update((rows) => [
      ...rows,
      { id, quantityText: '', classChoice: '3', useKnownWatts: false, wattsText: '' },
    ]);
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLInputElement>(`#poe-qty-${id}`)?.focus(),
      { injector: this.injector },
    );
  }

  // The Remove button goes with its row, so focus moves to "Add device" rather than being lost.
  protected removeDevice(id: number): void {
    this.devices.update((rows) => rows.filter((row) => row.id !== id));
    this.addButton().nativeElement.focus();
  }

  protected setQuantityText(id: number, text: string): void {
    this.devices.update((rows) =>
      rows.map((row) => (row.id === id ? { ...row, quantityText: text } : row)),
    );
  }

  // The dropdown's "Known watts" entry is not a class: it turns the row's own wattage on, and leaves the
  // class it had alone.
  protected setClassChoice(id: number, choice: string): void {
    this.devices.update((rows) =>
      rows.map((row) =>
        row.id !== id
          ? row
          : choice === KNOWN_WATTS
            ? { ...row, useKnownWatts: true }
            : { ...row, classChoice: choice, useKnownWatts: false },
      ),
    );
  }

  protected selectedChoice(row: PoeDeviceRow): string {
    return this.usesKnownWatts(row) ? KNOWN_WATTS : row.classChoice;
  }

  protected setWattsText(id: number, text: string): void {
    this.devices.update((rows) =>
      rows.map((row) => (row.id === id ? { ...row, wattsText: text } : row)),
    );
  }

  // With a class picked, the watts box just shows that class's number (read-only).
  protected wattsDisplay(row: PoeDeviceRow): string {
    return this.usesKnownWatts(row)
      ? row.wattsText
      : String(POE_CLASSES[Number(row.classChoice)][this.basis()]);
  }
}
