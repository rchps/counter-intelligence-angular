import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';

describe('app routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter(routes, withComponentInputBinding())],
    });
  });

  it('redirects the empty path to /lines', async () => {
    const harness = await RouterTestingHarness.create('/');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Line Card');
  });

  it('renders Branches at /branches', async () => {
    const harness = await RouterTestingHarness.create('/branches');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Branches');
  });

  it('redirects /tools to /tools/margin', async () => {
    const harness = await RouterTestingHarness.create('/tools');
    expect(harness.routeNativeElement?.textContent).toContain('margin');
  });

  it('binds the :tool route param as a component input', async () => {
    const harness = await RouterTestingHarness.create('/tools/poe');
    expect(harness.routeNativeElement?.textContent).toContain('poe');
  });

  it('redirects an unknown path to /lines', async () => {
    const harness = await RouterTestingHarness.create('/nope/not/a/route');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Line Card');
  });
});
