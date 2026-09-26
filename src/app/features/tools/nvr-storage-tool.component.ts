import { Component, computed, signal } from '@angular/core';
import {
  BITRATE_GUIDE_H264,
  drivesNeeded,
  estimatedBitrate,
  isFpsBand,
  isRaidType,
  isResolution,
  nvrStorage,
  RAID_LAYOUTS,
  readPositiveNumber,
  shownByNvrTB,
  type Codec,
  type FpsBand,
  type NvrStorageResult,
  type RaidType,
  type Resolution,
} from '../../core/tools-math';
import { ToolResultCardComponent } from './tool-result-card.component';
import { inputValue } from '../../shared/input-value';

type NvrMode = 'known' | 'estimate';

const tbText = (tb: number): string =>
  tb < 1 ? (tb * 1000).toFixed(1) + ' GB' : tb.toFixed(2) + ' TB';

// Ported from tools.html's NVR storage tool.
@Component({
  selector: 'app-nvr-storage-tool',
  imports: [ToolResultCardComponent],
  templateUrl: './nvr-storage-tool.component.html',
})
export class NvrStorageToolComponent {
  protected readonly inputValue = inputValue;
  protected readonly resolutions = Object.entries(BITRATE_GUIDE_H264).map(([key, info]) => ({
    key: key as Resolution,
    label: info.label,
  }));

  protected readonly mode = signal<NvrMode>('known');
  protected readonly kbpsText = signal('');
  protected readonly resolution = signal<Resolution>('4MP');
  protected readonly fps = signal<FpsBand>('normal');
  protected readonly codec = signal<Codec>('h265');
  protected readonly camerasText = signal('');
  protected readonly daysText = signal('30');
  protected readonly recordingPercentText = signal('100');
  protected readonly driveTBText = signal('');
  protected readonly raid = signal<RaidType>('none');

  // The dropdowns hand back plain strings; only set a value the tool knows.
  protected onResolutionChange(value: string): void {
    if (isResolution(value)) this.resolution.set(value);
  }

  protected onFpsChange(value: string): void {
    if (isFpsBand(value)) this.fps.set(value);
  }

  protected onRaidChange(value: string): void {
    if (isRaidType(value)) this.raid.set(value);
  }

  private readonly cameras = computed(() => readPositiveNumber(this.camerasText()));
  private readonly days = computed(() => readPositiveNumber(this.daysText()));
  private readonly recordingPercent = computed(() =>
    readPositiveNumber(this.recordingPercentText()),
  );
  private readonly driveTB = computed(() => readPositiveNumber(this.driveTBText()));
  private readonly kbps = computed(() => readPositiveNumber(this.kbpsText()));

  protected readonly message = computed(() => {
    const fields = [this.cameras(), this.days(), this.recordingPercent(), this.driveTB()];
    if (this.mode() === 'known') fields.push(this.kbps());
    if (fields.some((field) => field.bad)) return 'Use positive numbers only, like 1.5.';
    if (this.recordingPercent().value > 100) return "Share of the day can't be more than 100%.";
    if (isFinite(this.cameras().value) && !Number.isInteger(this.cameras().value))
      return 'Cameras must be a whole number.';
    return '';
  });

  // One rate, or a low-high pair when estimating and the range doesn't collapse to a single number.
  private readonly rates = computed<number[]>(() => {
    if (this.mode() === 'estimate') {
      const { lowKbps, highKbps } = estimatedBitrate({
        resolution: this.resolution(),
        fps: this.fps(),
        codec: this.codec(),
      });
      return lowKbps === highKbps ? [highKbps] : [lowKbps, highKbps];
    }
    return [this.kbps().value];
  });

  private readonly results = computed<NvrStorageResult[] | null>(() => {
    if (this.message()) return null;
    const cameras = this.cameras().value;
    const days = this.days().value;
    const recordingPercent = this.recordingPercent().value;
    const rates = this.rates();
    if ([cameras, days, recordingPercent, ...rates].some((value) => !isFinite(value))) return null;
    return rates.map((kbps) => nvrStorage({ kbps, cameras, days, recordingPercent }));
  });

  // The high end is the one to size for.
  private readonly worst = computed(() => {
    const results = this.results();
    return results ? results[results.length - 1] : null;
  });

  protected readonly isRange = computed(() => (this.results()?.length ?? 0) > 1);
  protected readonly heroLabel = computed(() =>
    this.isRange() ? 'Estimated storage · size for the high end' : 'Estimated storage needed',
  );
  protected readonly tbDisplay = computed(() => {
    const worst = this.worst();
    return worst ? tbText(worst.totalTB) : '—';
  });
  protected readonly lowEndDisplay = computed(() => {
    const results = this.results();
    return results && results.length > 1
      ? `Low end of the range: ${tbText(results[0].totalTB)}`
      : '';
  });
  // Ten years or more of retention gets one dry line; the numbers are still all there.
  protected readonly quip = computed(() =>
    isFinite(this.days().value) && this.days().value >= 3650
      ? "Ten years of footage. Hope it's a good show."
      : '',
  );

  private rangeText(
    pick: (result: NvrStorageResult) => number,
    format: (value: number) => string,
  ): string {
    const results = this.results();
    if (!results) return '—';
    const worst = results[results.length - 1];
    return results.length > 1
      ? `${format(pick(results[0]))} to ${format(pick(worst))}`
      : format(pick(worst));
  }

  protected readonly dayDisplay = computed(() =>
    this.rangeText(
      (r) => r.gbPerDay,
      (gb) => gb.toFixed(1) + ' GB',
    ),
  );
  protected readonly camDisplay = computed(() => this.rangeText((r) => r.perCameraTB, tbText));
  protected readonly bandwidthDisplay = computed(() =>
    this.rangeText(
      (r) => r.bandwidthMbps,
      (mbps) => mbps.toFixed(1) + ' Mbps',
    ),
  );
  protected readonly rateDisplay = computed(() => {
    if (!this.results()) return '—';
    const [low, high] = this.rates();
    return high !== undefined
      ? `${low.toLocaleString()} to ${high.toLocaleString()} Kbps`
      : `${low.toLocaleString()} Kbps`;
  });

  private readonly hasDriveSize = computed(
    () => isFinite(this.driveTB().value) && this.driveTB().value > 0,
  );

  protected readonly drivesDisplay = computed(() => {
    const worst = this.worst();
    if (!worst) return '';
    if (!this.hasDriveSize()) return 'Enter a drive size to see how many drives.';
    const plan = drivesNeeded({
      neededTB: worst.totalTB,
      driveTB: this.driveTB().value,
      raid: this.raid(),
    });
    return `${plan.drives} × ${this.driveTB().value} TB drives, ${RAID_LAYOUTS[this.raid()].label}: ${plan.usableTB.toFixed(1)} TB usable`;
  });

  protected readonly note = computed(() => {
    if (!this.hasDriveSize()) {
      return 'Drive sizes are decimal (1 TB = 1,000,000,000,000 bytes), so NVRs and Windows show about 9% less: an 8 TB drive shows about 7.28 TB.';
    }
    const driveTB = this.driveTB().value;
    return `Drive sizes are decimal (1 TB = 1,000,000,000,000 bytes), so NVRs and Windows show about 9% less: each ${driveTB} TB drive shows about ${shownByNvrTB(driveTB).toFixed(2)} TB.`;
  });
}
