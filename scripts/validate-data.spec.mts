import { describe, expect, it } from 'vitest';
import { checkData, type LinesData, type ModuleData, type ProductType } from './validate-data.mts';

const validLine = {
  name: 'Altronix',
  url: 'https://www.altronix.com/',
  cats: ['power'],
  aka: ['alt'],
  logo: 'altronix.png',
};
const validBranch = {
  st: 'WA',
  city: 'Spokane',
  addr: '123 Main St, Spokane, WA 99212',
  phone: '(509) 555-0100',
};

function baseData(overrides: Partial<LinesData> = {}): LinesData {
  return {
    asOf: '2026-09-25',
    cats: { power: 'Power' },
    lines: [validLine],
    branches: [validBranch],
    ...overrides,
  };
}

const NO_MODULES: ModuleData = {};

describe('checkData: top level', () => {
  it('passes on valid data with no problems or warnings', () => {
    expect(checkData(baseData(), [], NO_MODULES)).toEqual({ problems: [], warnings: [] });
  });

  it('requires "asOf" to be a YYYY-MM-DD date', () => {
    const { problems } = checkData(baseData({ asOf: 'September 25' }), [], NO_MODULES);
    expect(problems).toContain('lines.json "asOf" must be a date like 2026-09-25.');
  });
});

describe('checkData: manufacturers', () => {
  it('flags an unknown field (typo-catcher)', () => {
    const { problems } = checkData(
      baseData({ lines: [{ ...validLine, wesbite: 'x' }] }),
      [],
      NO_MODULES,
    );
    expect(problems).toContain("lines.json: Altronix: unknown field(s) ['wesbite'] (typo?)");
  });

  it('flags a manufacturer listed twice, case-insensitively', () => {
    const { problems } = checkData(
      baseData({ lines: [validLine, { ...validLine, name: 'ALTRONIX' }] }),
      [],
      NO_MODULES,
    );
    expect(problems).toContain('lines.json: ALTRONIX: listed twice');
  });

  it('requires at least one category, and each category to be a known one', () => {
    const noCat = checkData(baseData({ lines: [{ ...validLine, cats: [] }] }), [], NO_MODULES);
    expect(noCat.problems).toContain('lines.json: Altronix: needs at least one category');

    const badCat = checkData(
      baseData({ lines: [{ ...validLine, cats: ['nope'] }] }),
      [],
      NO_MODULES,
    );
    expect(badCat.problems).toContain(
      "lines.json: Altronix: category \"nope\" isn't one of ['power']",
    );
  });

  it('requires a url starting with http(s), or null', () => {
    const badUrl = checkData(
      baseData({ lines: [{ ...validLine, url: 'www.altronix.com' }] }),
      [],
      NO_MODULES,
    );
    expect(badUrl.problems).toContain(
      'lines.json: Altronix: url should start with https:// (or be null if unknown): "www.altronix.com"',
    );

    const nullUrl = checkData(baseData({ lines: [{ ...validLine, url: null }] }), [], NO_MODULES);
    expect(nullUrl.problems).toEqual([]);
  });

  it('warns (not a problem) about a plain http:// url', () => {
    const { problems, warnings } = checkData(
      baseData({ lines: [{ ...validLine, url: 'http://altronix.com/' }] }),
      [],
      NO_MODULES,
    );
    expect(problems).toEqual([]);
    expect(warnings).toContain(
      'lines.json: Altronix: not https (http://altronix.com/); fine if the site has no https version',
    );
  });

  it('requires a logo path', () => {
    const { problems } = checkData(
      baseData({ lines: [{ ...validLine, logo: '' }] }),
      [],
      NO_MODULES,
    );
    expect(problems).toContain('lines.json: Altronix: missing logo path');
  });

  it('requires every alias to be non-empty text', () => {
    const { problems } = checkData(
      baseData({ lines: [{ ...validLine, aka: ['ok', '   '] }] }),
      [],
      NO_MODULES,
    );
    expect(problems).toContain('lines.json: Altronix: aliases must be non-empty text');
  });
});

describe('checkData: branches', () => {
  it('flags an unknown field', () => {
    const { problems } = checkData(
      baseData({ branches: [{ ...validBranch, zip: '99212' }] }),
      [],
      NO_MODULES,
    );
    expect(problems).toContain("lines.json branch: Spokane, WA: unknown field(s) ['zip'] (typo?)");
  });

  it('requires a two-letter state code', () => {
    const { problems } = checkData(
      baseData({ branches: [{ ...validBranch, st: 'Washington' }] }),
      [],
      NO_MODULES,
    );
    expect(problems).toContain(
      'lines.json branch: Spokane, Washington: state must be a two-letter code like WA',
    );
  });

  it('requires a city and an address', () => {
    const { problems } = checkData(
      baseData({ branches: [{ ...validBranch, city: '' }] }),
      [],
      NO_MODULES,
    );
    expect(problems).toContain('lines.json branch: ?, WA: needs a city and an address');
  });

  it('requires phone to match the (555) 555-5555 format, or be null', () => {
    const badPhone = checkData(
      baseData({ branches: [{ ...validBranch, phone: '509-555-0100' }] }),
      [],
      NO_MODULES,
    );
    expect(badPhone.problems).toContain(
      'lines.json branch: Spokane, WA: phone should look like (509) 555-1234 (or be null if not open yet): "509-555-0100"',
    );

    const nullPhone = checkData(
      baseData({ branches: [{ ...validBranch, phone: null }] }),
      [],
      NO_MODULES,
    );
    expect(nullPhone.problems).toEqual([]);
  });
});

describe('checkData: product types', () => {
  const terms: ProductType[] = [{ label: 'Maglocks', lines: ['Altronix'] }];

  it('passes when every term is linked to a real line', () => {
    expect(checkData(baseData(), terms, NO_MODULES).problems).toEqual([]);
  });

  it('flags a term listed twice, case-insensitively', () => {
    const { problems } = checkData(
      baseData(),
      [...terms, { label: 'MAGLOCKS', lines: ['Altronix'] }],
      NO_MODULES,
    );
    expect(problems).toContain('terms.json: "MAGLOCKS" is listed twice');
  });

  it('requires a term to be linked to at least one line', () => {
    const { problems } = checkData(baseData(), [{ label: 'Maglocks', lines: [] }], NO_MODULES);
    expect(problems).toContain('terms.json: "Maglocks" isn\'t linked to any line');
  });

  it("flags a term naming a line that isn't in lines.json", () => {
    const { problems } = checkData(
      baseData(),
      [{ label: 'Maglocks', lines: ['Nope Inc'] }],
      NO_MODULES,
    );
    expect(problems).toContain(
      'terms.json: "Maglocks" names "Nope Inc", which isn\'t in lines.json',
    );
  });
});

describe('checkData: "Try these instead" alternatives', () => {
  it("flags an alternatives brand offering a line that isn't in lines.json", () => {
    const modules: ModuleData = {
      alternatives: { brands: [{ brand: 'Hikvision', offer: ['Nope Inc'] }] },
    };
    const { problems } = checkData(baseData(), [], modules);
    expect(problems).toContain(
      'alternatives.json: "Hikvision" offers "Nope Inc", which isn\'t in lines.json',
    );
  });

  it('passes when every offered line is real', () => {
    const modules: ModuleData = {
      alternatives: { brands: [{ brand: 'Hikvision', offer: ['Altronix'] }] },
    };
    expect(checkData(baseData(), [], modules).problems).toEqual([]);
  });
});
