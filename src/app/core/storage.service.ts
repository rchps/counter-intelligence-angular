import { Service } from '@angular/core';
import { migrateKeys, RENAMED_KEYS } from './storage-keys';

// Safe localStorage wrapper: some browsers
// block storage entirely (private windows, embedded previews), and this should never break the page.
@Service()
export class StorageService {
  // Every read goes through here, so moving renamed keys first means nothing ever sees the old names.
  constructor() {
    try {
      migrateKeys(localStorage, RENAMED_KEYS);
    } catch {
      // storage blocked: nothing saved to move
    }
  }

  get(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }

  // Returns whether the write actually succeeded, so callers that need to tell the user their data
  // isn't being saved (private windows, storage quota) can — most callers just ignore it.
  set(key: string, value: string): boolean {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
