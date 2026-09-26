import { inject, Service } from '@angular/core';
import type { SalesStore } from './sales-math';
import { StorageService } from './storage.service';

const STORAGE_KEY = 'sds-counter-reference:sales:v1';

// Ported from sales.html's own store/save(): reads and writes the whole SalesStore as one JSON blob,
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
}
