import { Service } from '@angular/core';

// Safe localStorage wrapper (ported from the try/catch pattern used throughout page.js): some browsers
// block storage entirely (private windows, embedded previews), and this should never break the page.
@Service()
export class StorageService {
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
