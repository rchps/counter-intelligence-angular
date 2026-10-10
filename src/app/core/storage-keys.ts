// Every key the app saves in the browser, in one place.
export const STORAGE_KEYS = {
  theme: 'counter-intelligence:theme',
  sales: 'counter-intelligence:sales:v1',
  tool: 'counter-intelligence:tool',
  pinnedLines: 'counter-intelligence:pinned-lines:v1',
  recentLines: 'counter-intelligence:recent-lines:v1',
  /** Set once this browser has started or turned down the guided tour, so the invite shows once. */
  tourSeen: 'counter-intelligence:tour-seen',
  /** The ids of the tour steps and tips this browser has seen (a JSON list), so each tip shows once and
   *  a tour step added later shows as new. */
  tourStepsSeen: 'counter-intelligence:tour-steps-seen:v1',
} as const;

// The names the same keys had before the rename. A browser keeps what it saved under the old name
// until StorageService moves it over (migrateKeys), so this can go once everyone has opened the site
// since the rename (2026-09-27): after a few weeks, delete it and the migrateKeys call.
export const RENAMED_KEYS: Readonly<Record<string, string>> = {
  'sds-theme': STORAGE_KEYS.theme,
  'sds-counter-reference:sales:v1': STORAGE_KEYS.sales,
  'sds-counter-reference:tool': STORAGE_KEYS.tool,
};

/** The part of localStorage migrateKeys uses, so tests can hand it a plain object instead. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Moves each old key's value to its new key, unless the new key already has one (that's newer). */
export function migrateKeys(store: KeyValueStore, renamed: Readonly<Record<string, string>>): void {
  for (const [oldKey, newKey] of Object.entries(renamed)) {
    const value = store.getItem(oldKey);
    if (value === null) continue;
    if (store.getItem(newKey) === null) store.setItem(newKey, value);
    store.removeItem(oldKey);
  }
}
