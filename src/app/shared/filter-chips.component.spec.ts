import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FilterChipsComponent, type FilterChip } from './filter-chips.component';

const CHIPS: FilterChip[] = [
  { key: 'access', label: 'Access Control', count: 3, colored: true },
  { key: 'fire', label: 'Fire', count: 0, colored: true },
];

@Component({
  selector: 'app-host',
  imports: [FilterChipsComponent],
  template: `
    <app-filter-chips
      groupLabel="Filter by category"
      [total]="5"
      [chips]="chips"
      [selected]="selected()"
      (selectedChange)="selected.set($event)"
    />
  `,
})
class HostComponent {
  readonly chips = CHIPS;
  readonly selected = signal('all');
}

describe('FilterChipsComponent', () => {
  function setup() {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    return fixture;
  }

  it('renders "All" first with the total count, then each chip with its own count', () => {
    const fixture = setup();
    const buttons = [...fixture.nativeElement.querySelectorAll('.chip')] as HTMLButtonElement[];
    expect(buttons.map((b) => b.textContent?.replace(/\s+/g, ' ').trim())).toEqual([
      'All 5',
      'Access Control 3',
      'Fire 0',
    ]);
  });

  it('marks the selected chip as pressed', () => {
    const fixture = setup();
    fixture.componentInstance.selected.set('access');
    fixture.detectChanges();
    const buttons = [...fixture.nativeElement.querySelectorAll('.chip')] as HTMLButtonElement[];
    expect(buttons.map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
  });

  it('marks an empty non-"All" chip with data-empty, never "All" itself', () => {
    const fixture = setup();
    const buttons = [...fixture.nativeElement.querySelectorAll('.chip')] as HTMLButtonElement[];
    expect(buttons[0].hasAttribute('data-empty')).toBe(false);
    expect(buttons[1].getAttribute('data-empty')).toBe('false');
    expect(buttons[2].getAttribute('data-empty')).toBe('true');
  });

  it('clicking a chip updates the two-way bound selection', () => {
    const fixture = setup();
    const fireChip = [...fixture.nativeElement.querySelectorAll('.chip')].find(
      (b: HTMLButtonElement) => b.textContent?.includes('Fire'),
    ) as HTMLButtonElement;

    fireChip.click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selected()).toBe('fire');
  });
});
