import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it } from 'vitest';
import { SearchToolbarComponent } from './search-toolbar.component';

function stubMatchMedia(initialMatches: boolean) {
  const listeners: ((event: { matches: boolean }) => void)[] = [];
  const mql = {
    matches: initialMatches,
    media: '(max-width: 640px)',
    addEventListener: (_type: string, callback: (event: { matches: boolean }) => void) =>
      listeners.push(callback),
    removeEventListener: (_type: string, callback: (event: { matches: boolean }) => void) => {
      const index = listeners.indexOf(callback);
      if (index >= 0) listeners.splice(index, 1);
    },
  };
  window.matchMedia = (() => mql) as unknown as typeof window.matchMedia;
  return {
    fireChange(matches: boolean) {
      mql.matches = matches;
      [...listeners].forEach((callback) => callback({ matches }));
    },
  };
}

@Component({
  selector: 'app-host',
  imports: [SearchToolbarComponent],
  template: `
    <app-search-toolbar
      inputLabel="Search manufacturers"
      placeholderWide="Search 234 manufacturers"
      placeholderNarrow="Search brands"
      [(search)]="search"
    />
  `,
})
class HostComponent {
  search = '';
}

describe('SearchToolbarComponent', () => {
  afterEach(() => {
    document.body.focus();
  });

  it('shows the wide placeholder and the Ctrl/Cmd K hint by default', () => {
    stubMatchMedia(false);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.placeholder).toBe('Search 234 manufacturers');
    expect(fixture.nativeElement.querySelector('.kbd')).toBeTruthy();
  });

  it('switches to the narrow placeholder when the viewport crosses the breakpoint', () => {
    const media = stubMatchMedia(false);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    media.fireChange(true);
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.placeholder).toBe('Search brands');
  });

  it('typing updates the two-way bound search model', () => {
    stubMatchMedia(false);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.value = 'wheelock';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    expect(fixture.componentInstance.search).toBe('wheelock');
    expect(fixture.nativeElement.querySelector('.search').classList.contains('has-value')).toBe(
      true,
    );
  });

  it('Escape clears the search when there is a value', () => {
    stubMatchMedia(false);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.search = 'wheelock';
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.search).toBe('');
  });

  it('the Clear button clears the search and refocuses the input', () => {
    stubMatchMedia(false);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.search = 'wheelock';
    fixture.detectChanges();

    const clearButton: HTMLButtonElement = fixture.nativeElement.querySelector('.clear');
    clearButton.click();
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(fixture.componentInstance.search).toBe('');
    expect(document.activeElement).toBe(input);
  });

  it('Ctrl/Cmd K focuses the search box from anywhere on the page', () => {
    stubMatchMedia(false);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    document.body.focus();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(document.activeElement).toBe(input);
  });

  it('"/" focuses the search box, unless already typing in a field', () => {
    stubMatchMedia(false);
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    document.body.focus();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/' }));

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(document.activeElement).toBe(input);
  });
});
