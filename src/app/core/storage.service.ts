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

  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // not saved, the app still works for this visit
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
