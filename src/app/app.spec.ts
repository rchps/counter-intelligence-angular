import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { App } from './app';

@Component({ selector: 'app-stub', template: 'stub' })
class StubComponent {}

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([{ path: '**', component: StubComponent }])],
    }).compileComponents();
  });

  it('creates the app', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('renders the top bar and a focusable main-content landmark', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('app-top-bar')).toBeTruthy();
    const main = root.querySelector('#main-content');
    expect(main).toBeTruthy();
    expect(main?.getAttribute('tabindex')).toBe('-1');
  });

  it('moves focus to main content after navigating, but not on the initial load', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const main = fixture.nativeElement.querySelector('#main-content') as HTMLElement;
    const router = TestBed.inject(Router);

    // TestBed doesn't perform the app's real initial navigation the way bootstrapping does, so this
    // stands in for it: the "first" NavigationEnd App sees should never move focus.
    await router.navigateByUrl('/');
    expect(document.activeElement).not.toBe(main);

    await router.navigateByUrl('/somewhere');
    expect(document.activeElement).toBe(main);
  });
});
