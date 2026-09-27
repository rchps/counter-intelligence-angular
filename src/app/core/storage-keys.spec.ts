import { describe, expect, it } from 'vitest';
import { type KeyValueStore, migrateKeys } from './storage-keys';

/** A KeyValueStore over a plain Map, standing in for localStorage. */
function mapStore(
  entries: Record<string, string>,
): KeyValueStore & { entries: Map<string, string> } {
  const map = new Map(Object.entries(entries));
  return {
    entries: map,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  };
}

describe('migrateKeys', () => {
  const renamed = { 'old-theme': 'new:theme', 'old-sales': 'new:sales' };
  it('moves a value saved under an old key to the new key', () => {
    const store = mapStore({ 'old-theme': 'dark' });
    migrateKeys(store, renamed);
    expect(Object.fromEntries(store.entries)).toEqual({ 'new:theme': 'dark' });
  });

  it('keeps a value already under the new key, and still removes the old one', () => {
    const store = mapStore({ 'old-theme': 'dark', 'new:theme': 'light' });
    migrateKeys(store, renamed);
    expect(Object.fromEntries(store.entries)).toEqual({ 'new:theme': 'light' });
  });

  it('leaves everything else alone', () => {
    const store = mapStore({ unrelated: 'x', 'new:sales': '{}' });
    migrateKeys(store, renamed);
    expect(Object.fromEntries(store.entries)).toEqual({ unrelated: 'x', 'new:sales': '{}' });
  });

  it('moves an empty string too (a saved value, not a missing one)', () => {
    const store = mapStore({ 'old-sales': '' });
    migrateKeys(store, renamed);
    expect(Object.fromEntries(store.entries)).toEqual({ 'new:sales': '' });
  });
});
