import { inject, Service, signal } from '@angular/core';
import { parseNames, pushRecent, togglePinned } from './saved-lines';
import { STORAGE_KEYS } from './storage-keys';
import { StorageService } from './storage.service';

// Pinned and recently opened manufacturers, kept in this browser. If storage is blocked they still work
// for the visit, they just aren't remembered.
@Service()
export class SavedLinesService {
  private readonly storage = inject(StorageService);

  private readonly pinnedNames = signal(parseNames(this.storage.get(STORAGE_KEYS.pinnedLines)));
  private readonly recentNames = signal(parseNames(this.storage.get(STORAGE_KEYS.recentLines)));

  readonly pinned = this.pinnedNames.asReadonly();
  readonly recent = this.recentNames.asReadonly();

  togglePin(name: string): void {
    const next = togglePinned(this.pinnedNames(), name);
    this.pinnedNames.set(next);
    this.storage.set(STORAGE_KEYS.pinnedLines, JSON.stringify(next));
  }

  recordOpened(name: string): void {
    const next = pushRecent(this.recentNames(), name);
    this.recentNames.set(next);
    this.storage.set(STORAGE_KEYS.recentLines, JSON.stringify(next));
  }
}
