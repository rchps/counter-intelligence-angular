// TEMPORARY stand-in for Cypress, which isn't set up yet (ANGULAR_CONVERSION.md Phase 3's "Done when"
// calls for a real Cypress spec here). Exists only to catch "the page renders but shows no data".
//
// Caveat: this mocks HTTP, so unlike a real browser hitting `ng serve`, it can NOT catch a static-asset
// path/config bug (e.g. angular.json's `assets` entries pointing at the wrong folder) — that class of bug
// only shows up when something makes a real request to a real server. It DOES catch a broken
// search/render pipeline that produces no results even with good data.
//
// Delete this file and move its assertions into cypress/e2e/line-card.cy.ts once Cypress exists; the
// shape (visit the route, wait for it to settle, assert real data rendered) carries over as-is —
// `RouterTestingHarness.create('/lines')` becomes `cy.visit('/lines')`, and the httpMock.flush() calls
// disappear since Cypress hits the real dev server.
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

describe('Line Card page (smoke)', () => {
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

  it('shows real manufacturer entries once the data loads', async () => {
    const harness = await RouterTestingHarness.create('/lines');
    TestBed.tick(); // triggers DataService's httpResource requests

    httpMock.expectOne('data/lines.json').flush(linesData);
    httpMock.expectOne('data/terms.json').flush(termsData);
    httpMock.expectOne('data/alternatives.json').flush(alternativesData);

    await TestBed.inject(ApplicationRef).whenStable();
    harness.detectChanges();

    const text = harness.routeNativeElement?.textContent ?? '';
    expect(text).toContain('Altronix');
    expect(text).toMatch(/Showing \d+ of \d+ manufacturers/);
  });
});
