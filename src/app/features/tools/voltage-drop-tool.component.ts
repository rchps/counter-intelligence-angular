import { Component, computed, signal } from '@angular/core';
import {
  GAUGES,
  readPositiveNumber,
  voltageDrop,
  type Conductor,
  type WireGauge,
} from '../../core/tools-math';
import { ToolResultCardComponent } from './tool-result-card.component';
import { inputValue } from '../../shared/input-value';

interface GaugeRow {
  gauge: WireGauge;
  current: boolean;
  endVolts: number;
  dropPercent: number;
  passes: boolean | null;
}

// Ported from tools.html's Voltage drop tool.
@Component({
  selector: 'app-voltage-drop-tool',
  imports: [ToolResultCardComponent],
  templateUrl: './voltage-drop-tool.component.html',
})
export class VoltageDropToolComponent {
  protected readonly inputValue = inputValue;
  protected readonly gauges = GAUGES;

  protected readonly supplyVoltsText = signal('24');
  protected readonly ampsText = signal('');
  protected readonly oneWayFeetText = signal('');
  protected readonly minVoltsText = signal('');
  protected readonly gauge = signal<WireGauge>(12);
  protected readonly conductor = signal<Conductor>('solid');

  private readonly supplyVolts = computed(() => readPositiveNumber(this.supplyVoltsText()));
  private readonly amps = computed(() => readPositiveNumber(this.ampsText()));
  private readonly oneWayFeet = computed(() => readPositiveNumber(this.oneWayFeetText()));
  private readonly minVolts = computed(() => readPositiveNumber(this.minVoltsText()));

  protected readonly message = computed(() => {
    const fields = [this.supplyVolts(), this.amps(), this.oneWayFeet(), this.minVolts()];
    return fields.some((field) => field.bad) ? 'Use positive numbers only, like 1.5.' : '';
  });

  protected readonly result = computed(() => {
    const required = [this.supplyVolts(), this.amps(), this.oneWayFeet()];
    if (required.some((field) => field.bad || !isFinite(field.value)) || this.minVolts().bad)
      return null;
    return voltageDrop({
      supplyVolts: this.supplyVolts().value,
      amps: this.amps().value,
      oneWayFeet: this.oneWayFeet().value,
      gauge: this.gauge(),
      conductor: this.conductor(),
      minVolts: this.minVolts().value,
    });
  });

  protected readonly fails = computed(() => this.result()?.passes === false);

  // Personality only for the clearly absurd (the device gets nothing at all); a normal fail stays plain.
  protected readonly quip = computed(() => {
    const result = this.result();
    return result && result.endVolts <= 0 ? "That's not a voltage drop, that's a cliff." : '';
  });

  protected readonly endVoltsDisplay = computed(() => {
    const result = this.result();
    return result ? result.endVolts.toFixed(2) + ' V' : '—';
  });
  protected readonly dropVoltsDisplay = computed(() => {
    const result = this.result();
    return result ? result.dropVolts.toFixed(2) + ' V' : '—';
  });
  protected readonly dropPercentDisplay = computed(() => {
    const result = this.result();
    return result ? result.dropPercent.toFixed(1) + '%' : '—';
  });
  protected readonly maxFeetDisplay = computed(() => {
    const result = this.result();
    if (!result) return '—';
    return result.maxFeet === null
      ? 'Enter device minimum'
      : Math.floor(result.maxFeet).toLocaleString() + ' ft';
  });

  // The same run in every gauge, so the counter can say "go up to 14".
  protected readonly table = computed<GaugeRow[]>(() => {
    if (!this.result()) return [];
    return GAUGES.map((otherGauge) => {
      const other = voltageDrop({
        supplyVolts: this.supplyVolts().value,
        amps: this.amps().value,
        oneWayFeet: this.oneWayFeet().value,
        gauge: otherGauge,
        conductor: this.conductor(),
        minVolts: this.minVolts().value,
      });
      return { gauge: otherGauge, current: otherGauge === this.gauge(), ...other };
    });
  });

  protected onGaugeChange(value: string): void {
    this.gauge.set(Number(value) as WireGauge);
  }
}
