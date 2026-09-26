import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { TopBarComponent } from './top-bar.component';

@Component({ selector: 'app-stub', template: '' })
class StubComponent {}

describe('TopBarComponent', () => {
  let fixture: ComponentFixture<TopBarComponent>;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [TopBarComponent],
      providers: [
        provideRouter([
          { path: 'lines', component: StubComponent },
          { path: 'branches', component: StubComponent },
          { path: 'tools', component: StubComponent },
        ]),
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(TopBarComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset['theme'];
  });

  it('links to the three sections', () => {
    const hrefs = [...fixture.nativeElement.querySelectorAll('nav a')].map((a: HTMLAnchorElement) =>
      a.getAttribute('href'),
    );
    expect(hrefs).toEqual(['/lines', '/branches', '/tools']);
  });

  it('shows the brand and the internal-only pill', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Counter Intelligence');
    expect(text).toContain('Internal only');
  });

  it('the theme switch reflects and toggles ThemeService state', () => {
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('.theme-switch');
    const initial = button.getAttribute('aria-checked');

    button.click();
    fixture.detectChanges();

    expect(button.getAttribute('aria-checked')).not.toBe(initial);
  });
});
