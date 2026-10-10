import * as T from './tools-math';

// Published worked examples and source tables. Each case says where its answer comes from, so a failure
// points at the source to re-check rather than at a number someone typed in.
const MATH_CASES = [
  {
    name: 'Battery: Talkaphone AOR-10 NFPA 72-2022 worked example',
    source:
      'talkaphone.com AOR-10_NFPA_72_2022_Battery_Calculations (0.192 A x 24 h + 0.585 A x 240 min, x1.25)',
    run: () =>
      T.batteryAmpHours({
        standbyAmps: 0.192,
        alarmAmps: 0.585,
        standbyHours: 24,
        alarmMinutes: 240,
        factor: 1.25,
      }),
    expect: { standbyAh: 4.608, alarmAh: 2.34, subtotalAh: 6.948, requiredAh: 8.685, nextSize: 12 },
  },
  {
    name: 'Battery: Fire-Lite MS-5UD worksheet method (main board only, 24 h + 5 min, x1.2)',
    source:
      'Fire-Lite MS-5UD battery worksheet: board 0.110 A standby, 0.214 A alarm; multiply by derating factor 1.2',
    run: () =>
      T.batteryAmpHours({
        standbyAmps: 0.11,
        alarmAmps: 0.214,
        standbyHours: 24,
        alarmMinutes: 5,
        factor: 1.2,
      }),
    expect: { standbyAh: 2.64, subtotalAh: 2.657833, requiredAh: 3.1894, nextSize: 7 },
    tolerance: 0.0005,
  },
  {
    name: 'Voltage drop: ExpertCE worked example with NEC Table 8 value',
    source:
      'expertce.com conductor resistance article: 12 AWG, 100 ft, 15 A, 1.93 ohm/kft -> 5.79 V (4.83% of 120 V)',
    run: () =>
      T.voltageDrop({
        supplyVolts: 120,
        amps: 15,
        oneWayFeet: 100,
        gauge: 12,
        conductor: 'solid',
        minVolts: NaN,
      }),
    expect: { dropVolts: 5.79, dropPercent: 4.825 },
    tolerance: 0.001,
  },
  {
    name: 'Voltage drop: longest run is where the device gets exactly its minimum',
    source: 'algebra check on the same formula (24 V, 1 A, 16 V minimum, 18 AWG solid)',
    run: () => {
      const first = T.voltageDrop({
        supplyVolts: 24,
        amps: 1,
        oneWayFeet: 100,
        gauge: 18,
        conductor: 'solid',
        minVolts: 16,
      });
      const atMax = T.voltageDrop({
        supplyVolts: 24,
        amps: 1,
        oneWayFeet: first.maxFeet!,
        gauge: 18,
        conductor: 'solid',
        minVolts: 16,
      });
      return { maxFeet: first.maxFeet, endVoltsAtMax: atMax.endVolts };
    },
    expect: { maxFeet: 514.8005, endVoltsAtMax: 16 },
    tolerance: 0.001,
  },
  {
    name: 'NEC Chapter 9 Table 8 resistances (75 C, uncoated copper)',
    source: 'NEC 2017 Chapter 9 Table 8',
    run: () => T.OHMS_PER_1000_FT,
    expect: {
      solid: { 18: 7.77, 16: 4.89, 14: 3.07, 12: 1.93, 10: 1.21 },
      stranded: { 18: 7.95, 16: 4.99, 14: 3.14, 12: 1.98, 10: 1.24 },
    },
  },
  {
    name: 'PoE class limits (switch / device watts)',
    source: 'IEEE 802.3af/at/bt, per Skyworks and Ethernet Alliance 802.3bt white papers',
    run: () =>
      Object.fromEntries(Object.entries(T.POE_CLASSES).map(([c, v]) => [c, [v.pse, v.pd]])),
    expect: {
      0: [15.4, 13],
      1: [4, 3.84],
      2: [7, 6.49],
      3: [15.4, 13],
      4: [30, 25.5],
      5: [45, 40],
      6: [60, 51],
      7: [75, 62],
      8: [90, 71.3],
    },
  },
  {
    name: 'PoE budget: 8 x Class 3 cameras on a 120 W switch',
    source: 'class table above: 8 x 15.4 = 123.2 W reserved (over); 8 x 13 = 104 W max draw (fits)',
    run: () => ({
      reserved: T.poeBudget({
        budgetWatts: 120,
        basis: 'pse',
        devices: [{ quantity: 8, poeClass: 3 }],
      }),
      drawn: T.poeBudget({
        budgetWatts: 120,
        basis: 'pd',
        devices: [{ quantity: 8, poeClass: 3 }],
      }),
    }),
    expect: {
      reserved: { totalWatts: 123.2, fits: false, ports: 8, highestPortType: '802.3af' },
      drawn: { totalWatts: 104, fits: true },
    },
    tolerance: 0.0001,
  },
  {
    name: 'NVR storage: Genetec worked example',
    source:
      'techdocs.genetec.com Stratocast NAS storage calculator: 500 Kbps average for 7 days = 37.8 GB',
    run: () => T.nvrStorage({ kbps: 500, cameras: 1, days: 7, recordingPercent: 100 }),
    expect: { totalGB: 37.8, gbPerDay: 5.4 },
    tolerance: 1e-9,
  },
  {
    name: 'NVR storage: scales with cameras and share of the day',
    source:
      'same formula: 16 cameras x 4096 Kbps x 30 days = 21.23 TB; at 50% recording = 10.62 TB',
    run: () => ({
      full: T.nvrStorage({ kbps: 4096, cameras: 16, days: 30, recordingPercent: 100 }),
      half: T.nvrStorage({ kbps: 4096, cameras: 16, days: 30, recordingPercent: 50 }),
    }),
    expect: { full: { totalTB: 21.233664, bandwidthMbps: 65.536 }, half: { totalTB: 10.616832 } },
    tolerance: 1e-6,
  },
  {
    name: 'NVR bitrate guide: IC Realtime H.264 ranges, H.265 = half',
    source: 'knowledge.ic.plus IC Realtime resolution/bit rate/frame rate reference guide',
    run: () => ({
      guide: Object.fromEntries(
        Object.entries(T.BITRATE_GUIDE_H264).map(([k, v]) => [k, [...v.normal, ...v.high]]),
      ),
      fourMpH265: T.estimatedBitrate({ resolution: '4MP', fps: 'normal', codec: 'h265' }),
    }),
    expect: {
      guide: {
        '720p': [384, 2048, 4096, 4096],
        '2MP': [768, 4096, 8192, 8192],
        '4MP': [768, 4096, 8192, 8192],
        '5MP': [768, 4096, 8192, 8192],
        '8MP': [1536, 8192, 16400, 16400],
        '12MP': [2560, 12288, 18432, 18432],
      },
      fourMpH265: { lowKbps: 384, highKbps: 2048 },
    },
  },
  {
    name: 'RAID usable space: QNAP and Dell examples',
    source:
      'QNAP FAQ: 4 x 6 TB RAID 5 = 18 TB, 8 x 6 TB RAID 6 = 36 TB; Dell RAID guide: 4 x 1 TB RAID 10 = 2 TB',
    run: () => ({
      raid5: T.usableTB({ drives: 4, driveTB: 6, raid: 'raid5' }),
      raid6: T.usableTB({ drives: 8, driveTB: 6, raid: 'raid6' }),
      raid10: T.usableTB({ drives: 4, driveTB: 1, raid: 'raid10' }),
    }),
    expect: { raid5: 18, raid6: 36, raid10: 2 },
  },
  {
    name: 'Drives needed: fewest drives that cover the need, with RAID minimums',
    source: 'RAID rules above: 20 TB on 8 TB drives',
    run: () => ({
      none: T.drivesNeeded({ neededTB: 20, driveTB: 8, raid: 'none' }),
      raid5: T.drivesNeeded({ neededTB: 20, driveTB: 8, raid: 'raid5' }),
      raid6: T.drivesNeeded({ neededTB: 20, driveTB: 8, raid: 'raid6' }),
      raid10: T.drivesNeeded({ neededTB: 20, driveTB: 8, raid: 'raid10' }),
      smallRaid5: T.drivesNeeded({ neededTB: 2, driveTB: 8, raid: 'raid5' }),
    }),
    expect: {
      none: { drives: 3, usableTB: 24 },
      raid5: { drives: 4, usableTB: 24 },
      raid6: { drives: 5, usableTB: 24 },
      raid10: { drives: 6, usableTB: 24 },
      smallRaid5: { drives: 3, usableTB: 16 },
    },
  },
  {
    name: 'Decimal TB vs what the NVR shows',
    source: 'Seagate: one terabyte equals one trillion bytes; OS reports lower (2^40 bytes per TB)',
    run: () => ({ eight: T.shownByNvrTB(8), ten: T.shownByNvrTB(10) }),
    expect: { eight: 7.275957614, ten: 9.094947018 },
    tolerance: 1e-8,
  },
];

// Recursively compare expected values (numbers within tolerance); extra actual fields are ignored.
// Compares only the fields a case expects (numbers within its tolerance); extra fields are ignored.
function mismatches(expected: unknown, actual: unknown, tolerance: number, where = ''): string[] {
  if (typeof expected === 'number') {
    return typeof actual === 'number' && Math.abs(actual - expected) <= tolerance
      ? []
      : [`${where}: expected ${expected}, got ${actual}`];
  }
  if (expected && typeof expected === 'object') {
    return Object.keys(expected).flatMap((key) =>
      mismatches(
        (expected as Record<string, unknown>)[key],
        actual ? (actual as Record<string, unknown>)[key] : undefined,
        tolerance,
        `${where}.${key}`,
      ),
    );
  }
  return expected === actual ? [] : [`${where}: expected ${expected}, got ${actual}`];
}

describe('tools-math (worked examples from published sources)', () => {
  for (const testCase of MATH_CASES) {
    it(`${testCase.name} [${testCase.source}]`, () => {
      const actual = testCase.run();
      const problems = mismatches(testCase.expect, actual, testCase.tolerance ?? 1e-9);
      expect(problems).toEqual([]);
    });
  }
});

describe('readPositiveNumber', () => {
  it('is NaN, not bad, for blank text', () => {
    expect(T.readPositiveNumber('')).toEqual({ value: NaN, bad: false });
  });

  it('strips commas and whitespace', () => {
    expect(T.readPositiveNumber('1,500')).toEqual({ value: 1500, bad: false });
    expect(T.readPositiveNumber(' 24 ')).toEqual({ value: 24, bad: false });
  });

  it('flags non-numeric text as bad', () => {
    expect(T.readPositiveNumber('abc').bad).toBe(true);
  });

  it('flags a negative number as bad', () => {
    expect(T.readPositiveNumber('-5').bad).toBe(true);
  });
});

describe('NVR dropdown type guards', () => {
  it('accept only values the tool knows', () => {
    expect(T.isResolution('4MP')).toBe(true);
    expect(T.isResolution('3MP')).toBe(false);
    expect(T.isFpsBand('high')).toBe(true);
    expect(T.isFpsBand('low')).toBe(false);
    expect(T.isRaidType('raid6')).toBe(true);
    expect(T.isRaidType('raid0')).toBe(false);
  });

  it('are not fooled by names every object inherits', () => {
    expect(T.isResolution('toString')).toBe(false);
    expect(T.isRaidType('constructor')).toBe(false);
  });
});

describe('readPoeRow', () => {
  const classRow = { poeClass: 3, wattsText: '' };
  const wattsRow = { poeClass: null, quantityText: '8' };

  it('ignores a row nobody has filled in', () => {
    expect(T.readPoeRow({ ...classRow, quantityText: '' })).toEqual({
      device: null,
      problem: null,
    });
    expect(T.readPoeRow({ ...wattsRow, quantityText: '', wattsText: '' })).toEqual({
      device: null,
      problem: null,
    });
  });

  it('counts a class row once it has a quantity', () => {
    expect(T.readPoeRow({ ...classRow, quantityText: '4' })).toEqual({
      device: { quantity: 4, poeClass: 3 },
      problem: null,
    });
  });

  it('counts a known-watts row that has both quantity and watts', () => {
    expect(T.readPoeRow({ ...wattsRow, wattsText: '12.5' })).toEqual({
      device: { quantity: 8, watts: 12.5 },
      problem: null,
    });
  });

  it('blocks a known-watts row with a quantity but no watts', () => {
    expect(T.readPoeRow({ ...wattsRow, wattsText: '' })).toEqual({
      device: null,
      problem: 'watts-missing',
    });
    expect(T.readPoeRow({ ...wattsRow, wattsText: '  ' }).problem).toBe('watts-missing');
  });

  it('blocks a known-watts row with watts but no quantity', () => {
    expect(T.readPoeRow({ ...wattsRow, quantityText: '', wattsText: '10' }).problem).toBe(
      'quantity-missing',
    );
  });

  it('treats a typed 0 as an answer, not as blank', () => {
    // 0 W is a real (if odd) device that still takes a port.
    expect(T.readPoeRow({ ...wattsRow, wattsText: '0' })).toEqual({
      device: { quantity: 8, watts: 0 },
      problem: null,
    });
    // Zero devices needs no wattage and adds nothing.
    expect(T.readPoeRow({ ...wattsRow, quantityText: '0', wattsText: '' })).toEqual({
      device: null,
      problem: null,
    });
  });

  it('flags a quantity that is not a whole number or not a number', () => {
    expect(T.readPoeRow({ ...classRow, quantityText: '2.5' }).problem).toBe('quantity-invalid');
    expect(T.readPoeRow({ ...classRow, quantityText: 'x' }).problem).toBe('quantity-invalid');
    expect(T.readPoeRow({ ...classRow, quantityText: '-1' }).problem).toBe('quantity-invalid');
  });

  it('flags bad watts only on a row that uses them', () => {
    expect(T.readPoeRow({ ...wattsRow, wattsText: 'abc' }).problem).toBe('watts-invalid');
    expect(T.readPoeRow({ ...classRow, quantityText: '2', wattsText: 'abc' }).problem).toBeNull();
  });

  it('does not need watts from a class row, however blank the watts are', () => {
    expect(T.readPoeRow({ ...classRow, quantityText: '2' }).problem).toBeNull();
  });
});

describe('poeRowMessage', () => {
  it('names the device and what to enter', () => {
    expect(T.poeRowMessage('watts-missing', 2)).toBe(
      'Device 2: enter the watts each, or pick a PoE class.',
    );
    expect(T.poeRowMessage('quantity-missing', 1)).toContain('Device 1');
  });
});
