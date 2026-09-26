// Ported from counter-intelligence/tools.html `window.SDS_TOOLS`. Names and behavior are unchanged;
// only types were added. See tools-math.spec.ts for the published worked examples this is checked against.

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

export function batteryAmpHours({ standbyAmps, alarmAmps, standbyHours, alarmMinutes, factor }: BatteryAmpHoursInput) {
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

export function voltageDrop({ supplyVolts, amps, oneWayFeet, gauge, conductor, minVolts }: VoltageDropInput) {
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

// devices: [{ quantity, poeClass }] or [{ quantity, watts }] for a device with known wattage.
export function poeBudget({ budgetWatts, basis, devices }: PoeBudgetInput) {
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

export function estimatedBitrate({
  resolution,
  fps,
  codec,
}: {
  resolution: Resolution;
  fps: FpsBand;
  codec: Codec;
}) {
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

// Decimal units throughout, like drive labels: 1 Kbps = 1,000 bits/s, 1 TB = 10^12 bytes.
export function nvrStorage({ kbps, cameras, days, recordingPercent }: NvrStorageInput) {
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

export function usableTB({ drives, driveTB, raid }: { drives: number; driveTB: number; raid: RaidType }) {
  const layout = RAID_LAYOUTS[raid];
  if (layout.mirrored) return (drives * driveTB) / 2;
  return (drives - (layout.parityDrives ?? 0)) * driveTB;
}

// Fewest drives of this size whose usable space covers what's needed.
export function drivesNeeded({
  neededTB,
  driveTB,
  raid,
}: {
  neededTB: number;
  driveTB: number;
  raid: RaidType;
}) {
  const layout = RAID_LAYOUTS[raid];
  const dataDrives = Math.max(1, Math.ceil(neededTB / driveTB - 1e-9));
  let drives = layout.mirrored ? dataDrives * 2 : dataDrives + (layout.parityDrives ?? 0);
  drives = Math.max(drives, layout.minDrives);
  if (layout.mirrored && drives % 2) drives += 1;
  return { drives, usableTB: usableTB({ drives, driveTB, raid }) };
}

// What the NVR or Windows will display for a drive (they count 1 TB as 2^40 bytes).
export const shownByNvrTB = (labelTB: number) => (labelTB * 1e12) / 2 ** 40;
