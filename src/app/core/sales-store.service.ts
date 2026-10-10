import { inject, Service } from '@angular/core';
import type { SalesStore } from './sales-math';
import { STORAGE_KEYS } from './storage-keys';
import { StorageService } from './storage.service';

const STORAGE_KEY = STORAGE_KEYS.sales;

// Reads and writes the whole SalesStore as one JSON blob,
// falling back to an empty store (never throwing) if storage is blocked or holds something unreadable.
// Other tabs share that blob, so edits go through update(), which applies them to what is saved right
// now rather than to a tab's older copy.

export interface SalesUpdate {
  store: SalesStore;
  saved: boolean;
}

@Service()
export class SalesStoreService {
  private readonly storage = inject(StorageService);

  load(): SalesStore {
    const raw = this.storage.get(STORAGE_KEY);
    if (!raw) return { months: {} };
    try {
      const parsed = JSON.parse(raw) as Partial<SalesStore>;
      return parsed.months ? (parsed as SalesStore) : { months: {} };
    } catch {
      return { months: {} };
    }
  }

  save(store: SalesStore): boolean {
    return this.storage.set(STORAGE_KEY, JSON.stringify(store));
  }

  // Read-modify-write: applies `change` to the currently saved store and saves the result, so another
  // tab's edits survive. `inMemory` is only the base when storage can't be read at all (private
  // windows), where reloading would otherwise forget everything entered so far this visit.
  update(inMemory: SalesStore, change: (saved: SalesStore) => SalesStore): SalesUpdate {
    const store = change(this.isAvailable() ? this.load() : inMemory);
    return { store, saved: this.save(store) };
  }

  // Whether a `storage` event (fired only in the tabs that did NOT make the change) is about the
  // sales. A null key means the whole storage was cleared.
  isSalesChange(event: StorageEvent): boolean {
    return event.key === null || event.key === STORAGE_KEY;
  }

  // Whether storage can be read at all, so the page can warn that sales won't be saved. A missing key
  // is not a failure (JSON.parse(null) is valid JSON, null);
  // this only reports false when storage itself throws (fully blocked, e.g. some private windows).
  isAvailable(): boolean {
    try {
      localStorage.getItem(STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  }
}
