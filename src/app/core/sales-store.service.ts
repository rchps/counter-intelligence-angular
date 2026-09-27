import { inject, Service } from '@angular/core';
import type { SalesStore } from './sales-math';
import { StorageService } from './storage.service';

const STORAGE_KEY = 'sds-counter-reference:sales:v1';

// Reads and writes the whole SalesStore as one JSON blob,
// falling back to an empty store (never throwing) if storage is blocked or holds something unreadable.
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
