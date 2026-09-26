import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StorageService } from './storage.service';

describe('StorageService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('round-trips a value through get/set', () => {
    const storage = TestBed.inject(StorageService);
    storage.set('k', 'v');
    expect(storage.get('k')).toBe('v');
  });

  it('remove deletes a stored value', () => {
    const storage = TestBed.inject(StorageService);
    storage.set('k', 'v');
    storage.remove('k');
    expect(storage.get('k')).toBeNull();
  });

  it('returns null instead of throwing when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const storage = TestBed.inject(StorageService);
    expect(storage.get('k')).toBeNull();
  });

  it('does not throw when storage blocks a write', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const storage = TestBed.inject(StorageService);
    expect(() => storage.set('k', 'v')).not.toThrow();
  });

  it('does not throw when storage blocks a remove', () => {
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const storage = TestBed.inject(StorageService);
    expect(() => storage.remove('k')).not.toThrow();
  });
});
