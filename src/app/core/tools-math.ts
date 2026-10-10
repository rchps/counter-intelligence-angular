// The sizing tools' math: battery standby, voltage drop, PoE budget and NVR storage.
// See tools-math.spec.ts for the published worked examples this is checked against.

export interface ReadNumberResult {
  value: number;
  bad: boolean;
}

// Shared by all four sizing tools' input boxes. Blank -> NaN, not bad (nothing
// entered yet); anything else that isn't a finite number >= 0 -> bad, so the box can be flagged invalid.
export function readPositiveNumber(text: string): ReadNumberResult {
  const cleaned = text.replace(/[,\s]/g, '');
  if (cleaned === '') return { value: NaN, bad: false };
  const value = Number(cleaned);
  return { value, bad: !isFinite(value) || value < 0 };
}

// ---- Battery standby (NFPA 72 §10.6.7.2.1) ----
export const BATTERY_PRESETS = {
  fire: { standbyHours: 24, alarmMinutes: 5 },
  voice: { standbyHours: 24, alarmMinutes: 15 },
};
// Common sealed lead-acid sizes (Ah) to round up to. Check stock before quoting.
export const COMMON_BATTERY_SIZES = [7, 8, 12, 18, 26, 35, 40, 55, 75, 100];

export interface BatteryAmpHoursInput {
  standbyAmps: number;
  alarmAmps: number;
  standbyHours: number;
  alarmMinutes: number;
  factor: number;
}

export interface BatteryAmpHoursResult {
  standbyAh: number;
  alarmAh: number;
  subtotalAh: number;
  requiredAh: number;
  nextSize: number | null;
}

export function batteryAmpHours({
  standbyAmps,
  alarmAmps,
  standbyHours,
  alarmMinutes,
  factor,
}: BatteryAmpHoursInput): BatteryAmpHoursResult {
  const standbyAh = standbyAmps * standbyHours;
  const alarmAh = alarmAmps * (alarmMinutes / 60);
  const subtotalAh = standbyAh + alarmAh;
  const requiredAh = subtotalAh * factor;
  const nextSize = COMMON_BATTERY_SIZES.find((size) => size >= requiredAh - 1e-9) ?? null;
  return { standbyAh, alarmAh, subtotalAh, requiredAh, nextSize };
}

// ---- Voltage drop (NEC Chapter 9, Table 8: ohms per 1,000 ft, uncoated copper, 75 °C) ----
export type WireGauge = 18 | 16 | 14 | 12 | 10;
export type Conductor = 'solid' | 'stranded';

export const OHMS_PER_1000_FT: Record<Conductor, Record<WireGauge, number>> = {
  solid: { 18: 7.77, 16: 4.89, 14: 3.07, 12: 1.93, 10: 1.21 },
  stranded: { 18: 7.95, 16: 4.99, 14: 3.14, 12: 1.98, 10: 1.24 },
};
export const GAUGES: WireGauge[] = [18, 16, 14, 12, 10];

export interface VoltageDropInput {
  supplyVolts: number;
  amps: number;
  oneWayFeet: number;
  gauge: WireGauge;
  conductor: Conductor;
  minVolts: number;
}

export interface VoltageDropResult {
  ohmsPer1000: number;
  dropVolts: number;
  endVolts: number;
  dropPercent: number;
  passes: boolean | null;
  maxFeet: number | null;
}

export function voltageDrop({
  supplyVolts,
  amps,
  oneWayFeet,
  gauge,
  conductor,
  minVolts,
}: VoltageDropInput): VoltageDropResult {
  const ohmsPer1000 = OHMS_PER_1000_FT[conductor][gauge];
  const dropVolts = (amps * 2 * oneWayFeet * ohmsPer1000) / 1000; // out and back
  const endVolts = supplyVolts - dropVolts;
  const dropPercent = (dropVolts / supplyVolts) * 100;
  const hasMinimum = isFinite(minVolts);
  const passes = hasMinimum ? endVolts >= minVolts : null;
  // Longest one-way run where the device still gets its minimum voltage.
  const maxFeet =
    hasMinimum && amps > 0 && supplyVolts > minVolts
      ? ((supplyVolts - minVolts) * 1000) / (amps * 2 * ohmsPer1000)
      : null;
  return { ohmsPer1000, dropVolts, endVolts, dropPercent, passes, maxFeet };
}

// ---- PoE (IEEE 802.3af / 802.3at / 802.3bt) ----
// pse = minimum the switch must supply per port; pd = most the device may draw.
export interface PoeClassInfo {
  pse: number;
  pd: number;
  standard: string;
}

export const POE_CLASSES: Record<number, PoeClassInfo> = {
  0: { pse: 15.4, pd: 13, standard: '802.3af' },
  1: { pse: 4, pd: 3.84, standard: '802.3af' },
  2: { pse: 7, pd: 6.49, standard: '802.3af' },
  3: { pse: 15.4, pd: 13, standard: '802.3af' },
  4: { pse: 30, pd: 25.5, standard: '802.3at' },
  5: { pse: 45, pd: 40, standard: '802.3bt Type 3' },
  6: { pse: 60, pd: 51, standard: '802.3bt Type 3' },
  7: { pse: 75, pd: 62, standard: '802.3bt Type 4' },
  8: { pse: 90, pd: 71.3, standard: '802.3bt Type 4' },
};
const PORT_TYPE_ORDER = ['802.3af', '802.3at', '802.3bt Type 3', '802.3bt Type 4'];

export interface PoeDevice {
  quantity: number;
  poeClass?: number;
  watts?: number;
}

export interface PoeBudgetInput {
  budgetWatts: number;
  basis: 'pse' | 'pd';
  devices: PoeDevice[];
}

export interface PoeBudgetResult {
  totalWatts: number;
  leftWatts: number;
  percentUsed: number | null;
  fits: boolean;
  ports: number;
  highestPortType: string | null;
}

// devices: [{ quantity, poeClass }] or [{ quantity, watts }] for a device with known wattage.
export function poeBudget({ budgetWatts, basis, devices }: PoeBudgetInput): PoeBudgetResult {
  let totalWatts = 0;
  let ports = 0;
  let highestType = -1;
  for (const device of devices) {
    const known = device.poeClass !== undefined ? POE_CLASSES[device.poeClass] : undefined;
    const wattsEach = known ? known[basis] : (device.watts ?? NaN);
    totalWatts += wattsEach * device.quantity;
    ports += device.quantity;
    if (known) highestType = Math.max(highestType, PORT_TYPE_ORDER.indexOf(known.standard));
  }
  const leftWatts = budgetWatts - totalWatts;
  return {
    totalWatts,
    leftWatts,
    percentUsed: budgetWatts > 0 ? (totalWatts / budgetWatts) * 100 : null,
    fits: leftWatts >= -1e-9,
    ports,
    highestPortType: highestType >= 0 ? PORT_TYPE_ORDER[highestType] : null,
  };
}

// What a person has typed into one device row. poeClass is null when the row is sized by a wattage
// they enter (only possible when counting at the device's max draw), so the watts box is then required.
export interface PoeRowText {
  quantityText: string;
  poeClass: number | null;
  wattsText: string;
}

export type PoeRowProblem =
  'quantity-invalid' | 'quantity-missing' | 'watts-invalid' | 'watts-missing';

export interface PoeRowReading {
  /** The device to add up, or null for a row that is empty, set to zero devices, or has a problem. */
  device: PoeDevice | null;
  problem: PoeRowProblem | null;
}

// A row nobody has touched is fine to ignore, but a row with something typed in must be complete: a
// half-filled row dropped quietly would leave devices out of the total and still say "Fits". A typed
// 0 is an answer (zero devices, or a 0 W device that still takes a port); a blank is not.
export function readPoeRow({ quantityText, poeClass, wattsText }: PoeRowText): PoeRowReading {
  const quantity = readPositiveNumber(quantityText);
  const needsWatts = poeClass === null;
  const watts = needsWatts ? readPositiveNumber(wattsText) : { value: NaN, bad: false };

  if (quantity.bad || (isFinite(quantity.value) && !Number.isInteger(quantity.value))) {
    return { device: null, problem: 'quantity-invalid' };
  }
  if (watts.bad) return { device: null, problem: 'watts-invalid' };

  const quantityBlank = !isFinite(quantity.value);
  const wattsBlank = needsWatts && !isFinite(watts.value);
  if (quantityBlank) {
    return { device: null, problem: needsWatts && !wattsBlank ? 'quantity-missing' : null };
  }
  if (quantity.value === 0) return { device: null, problem: null };
  if (wattsBlank) return { device: null, problem: 'watts-missing' };
  return {
    device: needsWatts
      ? { quantity: quantity.value, watts: watts.value }
      : { quantity: quantity.value, poeClass },
    problem: null,
  };
}

// The sentence shown above the results for a row's problem; deviceNumber is the row's place in the list.
export function poeRowMessage(problem: PoeRowProblem, deviceNumber: number): string {
  switch (problem) {
    case 'quantity-invalid':
      return `Device ${deviceNumber}: use a whole number for the quantity.`;
    case 'quantity-missing':
      return `Device ${deviceNumber}: enter how many there are.`;
    case 'watts-invalid':
      return `Device ${deviceNumber}: use a positive number for the watts.`;
    case 'watts-missing':
      return `Device ${deviceNumber}: enter the watts each, or pick a PoE class.`;
  }
}

// ---- NVR storage (formula: Genetec; decimal TB: Seagate; RAID: QNAP, Dell) ----
const SECONDS_PER_DAY = 86400;

export type Resolution = '720p' | '2MP' | '4MP' | '5MP' | '8MP' | '12MP';
export type FpsBand = 'normal' | 'high';
export type Codec = 'h264' | 'h265';

interface BitrateGuideEntry {
  label: string;
  normal: [number, number];
  high: [number, number];
}

// IC Realtime published H.264 bitrate guide, Kbps. "normal" = 5-30 fps range, "high" = 60 fps.
export const BITRATE_GUIDE_H264: Record<Resolution, BitrateGuideEntry> = {
  '720p': { label: '720p', normal: [384, 2048], high: [4096, 4096] },
  '2MP': { label: '2MP / 1080p', normal: [768, 4096], high: [8192, 8192] },
  '4MP': { label: '4MP', normal: [768, 4096], high: [8192, 8192] },
  '5MP': { label: '5MP', normal: [768, 4096], high: [8192, 8192] },
  '8MP': { label: '8MP / 4K', normal: [1536, 8192], high: [16400, 16400] },
  '12MP': { label: '12MP', normal: [2560, 12288], high: [18432, 18432] },
};
export const H265_SHARE_OF_H264 = 0.5; // "approximately 50% bitrate reduction" (same guide)

export interface EstimatedBitrateInput {
  resolution: Resolution;
  fps: FpsBand;
  codec: Codec;
}

export interface EstimatedBitrateResult {
  lowKbps: number;
  highKbps: number;
}

export function estimatedBitrate({
  resolution,
  fps,
  codec,
}: EstimatedBitrateInput): EstimatedBitrateResult {
  const [low, high] = BITRATE_GUIDE_H264[resolution][fps];
  const share = codec === 'h265' ? H265_SHARE_OF_H264 : 1;
  return { lowKbps: low * share, highKbps: high * share };
}

export interface NvrStorageInput {
  kbps: number;
  cameras: number;
  days: number;
  recordingPercent: number;
}

export interface NvrStorageResult {
  gbPerDay: number;
  totalGB: number;
  totalTB: number;
  perCameraTB: number;
  bandwidthMbps: number;
}

// Decimal units throughout, like drive labels: 1 Kbps = 1,000 bits/s, 1 TB = 10^12 bytes.
export function nvrStorage({
  kbps,
  cameras,
  days,
  recordingPercent,
}: NvrStorageInput): NvrStorageResult {
  const bytesPerSecond = (kbps * 1000) / 8;
  const share = recordingPercent / 100;
  const bytesPerDay = bytesPerSecond * SECONDS_PER_DAY * cameras * share;
  const totalBytes = bytesPerDay * days;
  return {
    gbPerDay: bytesPerDay / 1e9,
    totalGB: totalBytes / 1e9,
    totalTB: totalBytes / 1e12,
    perCameraTB: cameras > 0 ? totalBytes / cameras / 1e12 : 0,
    bandwidthMbps: (kbps * cameras) / 1000, // while all cameras are recording
  };
}

export type RaidType = 'none' | 'raid5' | 'raid6' | 'raid10';

interface RaidLayout {
  label: string;
  parityDrives?: number;
  minDrives: number;
  mirrored?: boolean;
}

export const RAID_LAYOUTS: Record<RaidType, RaidLayout> = {
  none: { label: 'no RAID', parityDrives: 0, minDrives: 1 },
  raid5: { label: 'RAID 5', parityDrives: 1, minDrives: 3 },
  raid6: { label: 'RAID 6', parityDrives: 2, minDrives: 4 },
  raid10: { label: 'RAID 10', mirrored: true, minDrives: 4 },
};

// Type guards for values read back from the NVR tool's dropdowns, which the browser hands over as plain
// strings: only a value the tool knows is accepted.
export function isResolution(value: string): value is Resolution {
  return Object.hasOwn(BITRATE_GUIDE_H264, value);
}

export function isFpsBand(value: string): value is FpsBand {
  return value === 'normal' || value === 'high';
}

export function isRaidType(value: string): value is RaidType {
  return Object.hasOwn(RAID_LAYOUTS, value);
}

export interface UsableTbInput {
  drives: number;
  driveTB: number;
  raid: RaidType;
}

export function usableTB({ drives, driveTB, raid }: UsableTbInput): number {
  const layout = RAID_LAYOUTS[raid];
  if (layout.mirrored) return (drives * driveTB) / 2;
  return (drives - (layout.parityDrives ?? 0)) * driveTB;
}

export interface DrivesNeededInput {
  neededTB: number;
  driveTB: number;
  raid: RaidType;
}

export interface DrivesNeededResult {
  drives: number;
  usableTB: number;
}

// Fewest drives of this size whose usable space covers what's needed.
export function drivesNeeded({ neededTB, driveTB, raid }: DrivesNeededInput): DrivesNeededResult {
  const layout = RAID_LAYOUTS[raid];
  const dataDrives = Math.max(1, Math.ceil(neededTB / driveTB - 1e-9));
  let drives = layout.mirrored ? dataDrives * 2 : dataDrives + (layout.parityDrives ?? 0);
  drives = Math.max(drives, layout.minDrives);
  if (layout.mirrored && drives % 2) drives += 1;
  return { drives, usableTB: usableTB({ drives, driveTB, raid }) };
}

// What the NVR or Windows will display for a drive (they count 1 TB as 2^40 bytes).
export const shownByNvrTB = (labelTB: number): number => (labelTB * 1e12) / 2 ** 40;
