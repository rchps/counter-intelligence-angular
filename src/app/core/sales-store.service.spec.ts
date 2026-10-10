import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mergeImportedMonths, removeMonth, updateMonthRecord } from './sales-math';
import { SalesStoreService } from './sales-store.service';

const KEY = 'counter-intelligence:sales:v1';

describe('SalesStoreService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns an empty store when nothing is saved yet', () => {
    const service = TestBed.inject(SalesStoreService);
    expect(service.load()).toEqual({ months: {} });
  });

  it('round-trips a store through save/load', () => {
    const service = TestBed.inject(SalesStoreService);
    const store = {
      months: { '2026-09': { goal: 50000, sales: { '2026-09-01': 1200 }, overrides: {} } },
    };
    expect(service.save(store)).toBe(true);
    expect(service.load()).toEqual(store);
  });

  it('falls back to an empty store when the saved value is not valid JSON', () => {
    localStorage.setItem('counter-intelligence:sales:v1', 'not json');
    const service = TestBed.inject(SalesStoreService);
    expect(service.load()).toEqual({ months: {} });
  });

  it('falls back to an empty store when the saved value has no months property', () => {
    localStorage.setItem('counter-intelligence:sales:v1', JSON.stringify({ foo: 'bar' }));
    const service = TestBed.inject(SalesStoreService);
    expect(service.load()).toEqual({ months: {} });
  });

  it('returns false from save when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const service = TestBed.inject(SalesStoreService);
    expect(service.save({ months: {} })).toBe(false);
  });

  it('isAvailable is true when storage can be read', () => {
    const service = TestBed.inject(SalesStoreService);
    expect(service.isAvailable()).toBe(true);
  });

  it('isAvailable is false when storage throws on read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const service = TestBed.inject(SalesStoreService);
    expect(service.isAvailable()).toBe(false);
  });

  // "Tab A" below holds `stale`, a copy loaded before "tab B" saved; B's save is written straight to
  // storage, exactly as another tab would.
  describe('update (two tabs)', () => {
    const stale = { months: {} };
    const tabBSaved = {
      months: { '2026-10': { goal: null, sales: { '2026-10-01': 1000 }, overrides: {} } },
    };

    beforeEach(() => {
      localStorage.setItem(KEY, JSON.stringify(tabBSaved));
    });

    it("keeps the other tab's month when this tab edits a different month", () => {
      const service = TestBed.inject(SalesStoreService);
      const { store, saved } = service.update(stale, (current) =>
        updateMonthRecord(current, '2026-09', (data) => ({
          ...data,
          sales: { '2026-09-28': 2500 },
        })),
      );
      expect(saved).toBe(true);
      expect(Object.keys(store.months)).toEqual(['2026-10', '2026-09']);
      expect(service.load()).toEqual(store);
    });

    it("keeps the other tab's days when this tab edits another day of the same month", () => {
      const service = TestBed.inject(SalesStoreService);
      service.update(stale, (current) =>
        updateMonthRecord(current, '2026-10', (data) => ({
          ...data,
          sales: { ...data.sales, '2026-10-02': 700 },
        })),
      );
      expect(service.load().months['2026-10'].sales).toEqual({
        '2026-10-01': 1000,
        '2026-10-02': 700,
      });
    });

    it('lets the last write win when both tabs edit the same day', () => {
      const service = TestBed.inject(SalesStoreService);
      service.update(stale, (current) =>
        updateMonthRecord(current, '2026-10', (data) => ({
          ...data,
          sales: { ...data.sales, '2026-10-01': 1234 },
        })),
      );
      expect(service.load().months['2026-10'].sales['2026-10-01']).toBe(1234);
    });

    it("clears one month without erasing the other tab's months", () => {
      const service = TestBed.inject(SalesStoreService);
      service.update(stale, (current) =>
        updateMonthRecord(current, '2026-09', (data) => ({ ...data, goal: 5 })),
      );
      service.update(stale, (current) => removeMonth(current, '2026-09'));
      expect(service.load()).toEqual(tabBSaved);
    });

    it("imports into what is saved now, keeping the other tab's months", () => {
      const service = TestBed.inject(SalesStoreService);
      service.update(stale, (current) =>
        mergeImportedMonths(current, {
          months: { '2026-09': { goal: 44000, sales: {}, overrides: {} } },
        }),
      );
      expect(Object.keys(service.load().months).sort()).toEqual(['2026-09', '2026-10']);
    });

    it("builds on this tab's own copy when storage cannot be read", () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      const service = TestBed.inject(SalesStoreService);
      const inMemory = { months: { '2026-09': { goal: 1, sales: {}, overrides: {} } } };
      const { store } = service.update(inMemory, (current) => removeMonth(current, '2026-10'));
      expect(store).toEqual(inMemory);
    });
  });

  describe('isSalesChange', () => {
    it('is true for the sales key and a whole-storage clear, false for other keys', () => {
      const service = TestBed.inject(SalesStoreService);
      expect(service.isSalesChange(new StorageEvent('storage', { key: KEY }))).toBe(true);
      expect(service.isSalesChange(new StorageEvent('storage', { key: null }))).toBe(true);
      expect(service.isSalesChange(new StorageEvent('storage', { key: 'other' }))).toBe(false);
    });
  });
});
