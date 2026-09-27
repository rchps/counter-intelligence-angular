import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SalesStoreService } from './sales-store.service';

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
});
