import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SavedLinesService } from './saved-lines.service';

describe('SavedLinesService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('starts with nothing pinned or recent', () => {
    const service = TestBed.inject(SavedLinesService);
    expect(service.pinned()).toEqual([]);
    expect(service.recent()).toEqual([]);
  });

  it('remembers pins across visits', () => {
    TestBed.inject(SavedLinesService).togglePin('HID');
    TestBed.resetTestingModule();
    expect(TestBed.inject(SavedLinesService).pinned()).toEqual(['HID']);
  });

  it('unpins a pinned line', () => {
    const service = TestBed.inject(SavedLinesService);
    service.togglePin('HID');
    service.togglePin('HID');
    expect(service.pinned()).toEqual([]);
  });

  it('remembers opened lines across visits, newest first', () => {
    const service = TestBed.inject(SavedLinesService);
    service.recordOpened('HID');
    service.recordOpened('Altronix');
    TestBed.resetTestingModule();
    expect(TestBed.inject(SavedLinesService).recent()).toEqual(['Altronix', 'HID']);
  });

  it('still pins for this visit when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const service = TestBed.inject(SavedLinesService);
    service.togglePin('HID');
    expect(service.pinned()).toEqual(['HID']);
  });
});
