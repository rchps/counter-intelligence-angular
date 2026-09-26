// TEMPORARY stand-in for Cypress — see line-card.smoke.spec.ts for the full rationale and caveats
// (mocked HTTP means this can't catch a static-asset path/config bug, only a broken render pipeline).
// Delete this file and move its assertions into cypress/e2e/branches.cy.ts once Cypress exists.
import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { routes } from '../app/app.routes';
import alternativesData from '../../public/data/alternatives.json';
import linesData from '../../public/data/lines.json';
import termsData from '../../public/data/terms.json';

describe('Branches page (smoke)', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes, withComponentInputBinding()),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('shows real branch entries once the data loads', async () => {
    const harness = await RouterTestingHarness.create('/branches');
    TestBed.tick(); // triggers DataService's httpResource requests

    httpMock.expectOne('data/lines.json').flush(linesData);
    httpMock.expectOne('data/terms.json').flush(termsData);
    httpMock.expectOne('data/alternatives.json').flush(alternativesData);

    await TestBed.inject(ApplicationRef).whenStable();
    harness.detectChanges();

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Spokane');
    expect(text).toMatch(/Showing \d+ of \d+ branches/);
  });
});
