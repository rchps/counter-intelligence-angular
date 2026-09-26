import { DecimalPipe } from '@angular/common';
import { Component, computed, signal } from '@angular/core';
import { BATTERY_PRESETS, batteryAmpHours, readPositiveNumber } from '../../core/tools-math';
import { ToolResultCardComponent } from './tool-result-card.component';

type BatteryPreset = 'fire' | 'voice' | 'custom';

// Ported from tools.html's Battery standby tool.
@Component({
  selector: 'app-battery-tool',
  imports: [DecimalPipe, ToolResultCardComponent],
  templateUrl: './battery-tool.component.html',
})
export class BatteryToolComponent {
  protected readonly preset = signal<BatteryPreset>('fire');
  protected readonly standbyAmpsText = signal('');
  protected readonly alarmAmpsText = signal('');
  protected readonly standbyHoursText = signal(String(BATTERY_PRESETS.fire.standbyHours));
  protected readonly alarmMinutesText = signal(String(BATTERY_PRESETS.fire.alarmMinutes));
  protected readonly factor = signal<'1.25' | '1.2'>('1.25');

  private readonly standbyAmps = computed(() => readPositiveNumber(this.standbyAmpsText()));
  private readonly alarmAmps = computed(() => readPositiveNumber(this.alarmAmpsText()));
  private readonly standbyHours = computed(() => readPositiveNumber(this.standbyHoursText()));
  private readonly alarmMinutes = computed(() => readPositiveNumber(this.alarmMinutesText()));

  protected readonly message = computed(() => {
    const fields = [this.standbyAmps(), this.alarmAmps(), this.standbyHours(), this.alarmMinutes()];
    return fields.some((field) => field.bad) ? 'Use positive numbers only, like 1.5.' : '';
  });

  protected readonly result = computed(() => {
    const fields = [this.standbyAmps(), this.alarmAmps(), this.standbyHours(), this.alarmMinutes()];
    if (fields.some((field) => field.bad || !isFinite(field.value))) return null;
    return batteryAmpHours({
      standbyAmps: this.standbyAmps().value,
      alarmAmps: this.alarmAmps().value,
      standbyHours: this.standbyHours().value,
      alarmMinutes: this.alarmMinutes().value,
      factor: Number(this.factor()),
    });
  });

  protected readonly ahDisplay = computed(() => {
    const result = this.result();
    // Round up, never down — an amp-hour rating that's a hair short defeats the point of sizing the battery.
    return result ? (Math.ceil(result.requiredAh * 100 - 1e-9) / 100).toFixed(2) + ' Ah' : '—';
  });

  protected readonly sizeDisplay = computed(() => {
    const result = this.result();
    if (!result) return '';
    return result.nextSize
      ? `Next common size: ${result.nextSize} Ah`
      : 'Bigger than 100 Ah: needs an external charger/cabinet setup';
  });

  protected applyPreset(preset: BatteryPreset): void {
    this.preset.set(preset);
    if (preset === 'fire' || preset === 'voice') {
      this.standbyHoursText.set(String(BATTERY_PRESETS[preset].standbyHours));
      this.alarmMinutesText.set(String(BATTERY_PRESETS[preset].alarmMinutes));
    }
  }

  // Changing the times by hand switches the preset to "Custom".
  protected onTimingInput(): void {
    this.preset.set('custom');
  }
}
