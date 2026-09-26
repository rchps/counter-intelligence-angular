import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SearchStatusComponent } from './search-status.component';

@Component({
  selector: 'app-host',
  imports: [SearchStatusComponent],
  template: `
    <app-search-status
      [shownCount]="shownCount()"
      [totalCount]="234"
      [noun]="{ one: 'manufacturer', many: 'manufacturers' }"
      [filterLabel]="filterLabel()"
      [search]="search()"
      [correctedSearch]="correctedSearch()"
      (clear)="cleared.set(true)"
    />
  `,
})
class HostComponent {
  readonly shownCount = signal(6);
  readonly filterLabel = signal<string | null>(null);
  readonly search = signal('');
  readonly correctedSearch = signal('');
  readonly cleared = signal(false);
}

describe('SearchStatusComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  function statusText(fixture: ReturnType<typeof setup>): string {
    return (fixture.nativeElement.querySelector('.status') as HTMLElement)
      .textContent!.replace(/\s+/g, ' ')
      .trim();
  }

  it('shows the plain count with no search or filter active', () => {
    const fixture = setup();
    expect(statusText(fixture)).toBe('Showing 6 of 234 manufacturers');
  });

  it('uses the singular noun for a count of exactly 1', () => {
    const fixture = setup();
    fixture.componentInstance.shownCount.set(1);
    fixture.detectChanges();
    expect(statusText(fixture)).toContain('Showing 1 of 234 manufacturer');
    expect(statusText(fixture)).not.toContain('manufacturers');
  });

  it('adds the filter clause when a category is selected', () => {
    const fixture = setup();
    fixture.componentInstance.filterLabel.set('Fire');
    fixture.detectChanges();
    expect(statusText(fixture)).toContain('in Fire');
  });

  it('shows the search term, and the typo-correction note when corrected', () => {
    const fixture = setup();
    fixture.componentInstance.search.set('wheelok');
    fixture.componentInstance.correctedSearch.set('wheelock');
    fixture.detectChanges();
    expect(statusText(fixture)).toContain('matching “wheelock”');
    expect(statusText(fixture)).toContain('(you typed “wheelok”)');
  });

  it('shows the search term alone when nothing needed correcting', () => {
    const fixture = setup();
    fixture.componentInstance.search.set('wheelock');
    fixture.detectChanges();
    expect(statusText(fixture)).toContain('matching “wheelock”');
    expect(statusText(fixture)).not.toContain('you typed');
  });

  it('shows the clear button only when a search or filter is active, and emits clear on click', () => {
    const fixture = setup();
    expect(fixture.nativeElement.querySelector('.linkbtn')).toBeNull();

    fixture.componentInstance.search.set('wheelock');
    fixture.detectChanges();
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.linkbtn');
    expect(button).toBeTruthy();

    button.click();
    expect(fixture.componentInstance.cleared()).toBe(true);
  });
});
