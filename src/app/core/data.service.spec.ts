import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DataService } from './data.service';

describe('DataService', () => {
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('prepares lines, branches, categories, and known words once all three fixtures load', async () => {
    const service = TestBed.inject(DataService);
    TestBed.tick(); // triggers the httpResources' initial requests

    httpMock.expectOne('data/lines.json').flush({
      asOf: '2026-09-25',
      logoBase: 'logos/',
      cats: { access: 'Access Control' },
      lines: [
        {
          name: 'Altronix',
          url: 'https://www.altronix.com/',
          cats: ['access'],
          logo: 'altronix.png',
        },
      ],
      branches: [
        {
          st: 'WA',
          city: 'Spokane',
          addr: '123 Main St, Spokane, WA 99212',
          phone: '(509) 555-0100',
        },
      ],
    });
    httpMock
      .expectOne('data/terms.json')
      .flush({ terms: [{ label: 'Maglocks', syn: ['maglock'], lines: ['Altronix'] }] });
    httpMock.expectOne('data/alternatives.json').flush({
      brands: [{ brand: 'Hikvision', match: ['hikvision', 'hik vision'], offer: ['Altronix'] }],
    });

    await TestBed.inject(ApplicationRef).whenStable();

    expect(service.isLoading()).toBe(false);
    expect(service.asOf()).toBe('2026-09-25');
    expect(service.categories()).toEqual({ access: 'Access Control' });

    const [line] = service.lines();
    expect(line.name).toBe('Altronix');
    expect(line.productTerms).toEqual([
      {
        label: 'Maglocks',
        keywords: 'Maglocks | maglock',
        searchText: 'maglocks maglock',
        searchTextNoSpaces: 'maglocksmaglock',
      },
    ]);

    expect(service.branches().map((b) => b.city)).toEqual(['Spokane']);

    // "hikvision" isn't in lines.json at all, but alternatives.json's brand names still make it a
    // known word so typo-correction ("hickvision") can suggest it.
    expect(service.knownWords().get('hikvision')).toBe(1);
  });

  it('is loading until all three fixtures resolve', () => {
    const service = TestBed.inject(DataService);
    TestBed.tick(); // triggers the httpResources' initial requests
    expect(service.isLoading()).toBe(true);
    expect(service.lines()).toEqual([]);
    expect(service.branches()).toEqual([]);

    httpMock
      .expectOne('data/lines.json')
      .flush({ asOf: '', logoBase: '', cats: {}, lines: [], branches: [] });
    httpMock.expectOne('data/terms.json').flush({ terms: [] });
    httpMock.expectOne('data/alternatives.json').flush({ brands: [] });
  });

  describe('when a request fails', () => {
    const linesBody = {
      asOf: '2026-09-25',
      logoBase: 'logos/',
      cats: { access: 'Access Control' },
      lines: [{ name: 'Altronix', url: '', cats: ['access'], logo: 'altronix.png' }],
      branches: [{ st: 'WA', city: 'Spokane', addr: '1 Main St', phone: '(509) 555-0100' }],
    };
    const termsBody = { terms: [{ label: 'Maglocks', syn: [], lines: ['Altronix'] }] };

    let service: DataService;

    beforeEach(() => {
      service = TestBed.inject(DataService);
      TestBed.tick(); // triggers the httpResources' initial requests
    });

    it('reads as empty, without throwing, when lines.json fails', async () => {
      httpMock.expectOne('data/lines.json').flush('', { status: 500, statusText: 'Server Error' });
      httpMock.expectOne('data/terms.json').flush(termsBody);
      httpMock.expectOne('data/alternatives.json').flush({ brands: [] });
      await TestBed.inject(ApplicationRef).whenStable();

      expect(service.loadFailed()).toBe(true);
      expect(service.branchesFailed()).toBe(true);
      expect(service.lines()).toEqual([]);
      expect(service.branches()).toEqual([]);
      expect(service.categories()).toEqual({});
      expect(service.asOf()).toBe('');
      expect(service.knownWords().size).toBe(0);
    });

    it('fails the line list but not the branches when only terms.json fails', async () => {
      httpMock.expectOne('data/lines.json').flush(linesBody);
      httpMock.expectOne('data/terms.json').error(new ProgressEvent('error'));
      httpMock.expectOne('data/alternatives.json').flush({ brands: [] });
      await TestBed.inject(ApplicationRef).whenStable();

      expect(service.loadFailed()).toBe(true);
      expect(service.branchesFailed()).toBe(false);
      expect(service.lines()).toEqual([]);
      expect(service.branches().map((b) => b.city)).toEqual(['Spokane']);
    });

    it('keeps core search data when only alternatives.json fails', async () => {
      httpMock.expectOne('data/lines.json').flush(linesBody);
      httpMock.expectOne('data/terms.json').flush(termsBody);
      httpMock
        .expectOne('data/alternatives.json')
        .flush('', { status: 500, statusText: 'Server Error' });
      await TestBed.inject(ApplicationRef).whenStable();

      expect(service.loadFailed()).toBe(false);
      expect(service.alternatives()).toEqual([]);
      expect(service.lines().map((l) => l.name)).toEqual(['Altronix']);
      expect(service.knownWords().get('altronix')).toBe(1);
    });

    it('recovers after retry() succeeds', async () => {
      httpMock.expectOne('data/lines.json').flush('', { status: 500, statusText: 'Server Error' });
      httpMock.expectOne('data/terms.json').flush(termsBody);
      httpMock.expectOne('data/alternatives.json').flush({ brands: [] });
      await TestBed.inject(ApplicationRef).whenStable();
      expect(service.loadFailed()).toBe(true);

      service.retry();
      TestBed.tick();
      // Only the failed request is repeated.
      httpMock.expectOne('data/lines.json').flush(linesBody);
      await TestBed.inject(ApplicationRef).whenStable();

      expect(service.loadFailed()).toBe(false);
      expect(service.lines().map((l) => l.name)).toEqual(['Altronix']);
    });
  });
});
