import {
  countText,
  ideaReport,
  nounForTotal,
  pageDetailLines,
  problemKind,
  problemReport,
  searchStatusText,
} from './feedback';

// The reports the dialog builds. (Entry points, focus and the dialog itself are checked in
// cypress/e2e/feedback.cy.ts.)
const PAGE_LINES = pageDetailLines({
  build: '2026-09-26 · c68fb5d',
  tabName: 'Line Card',
  search: {
    search: 'altronix',
    filterLabel: null,
    status: 'Showing 1 of 180 manufacturers matching “altronix”',
  },
});

describe('pageDetailLines', () => {
  it('lists build, tab, search and what the page said', () => {
    expect(PAGE_LINES).toEqual([
      'Build: 2026-09-26 · c68fb5d',
      'Tab: Line Card',
      'Search: "altronix"',
      'Page said: Showing 1 of 180 manufacturers matching “altronix”',
    ]);
  });

  it('adds the filter when one is picked, and says (none) for an empty search', () => {
    const lines = pageDetailLines({
      build: 'unknown',
      tabName: 'Branches',
      search: { search: '', filterLabel: 'Texas', status: 'Showing 3 of 22 branches in Texas' },
    });
    expect(lines).toContain('Search: (none)');
    expect(lines).toContain('Filter: Texas');
  });

  it('has no search lines on a page without search', () => {
    expect(
      pageDetailLines({ build: 'unknown', tabName: 'Tools · PoE budget', search: null }),
    ).toEqual(['Build: unknown', 'Tab: Tools · PoE budget']);
  });
});

describe('problemReport', () => {
  it('wrong link for a manufacturer: title names it, body leads with the report', () => {
    const report = problemReport({
      kind: problemKind('link')!,
      line: 'Altronix',
      details: 'Goes to a 404 page',
      tabName: 'Line Card',
      pageLines: PAGE_LINES,
    });
    expect(report.title).toBe('Counter Intelligence: Wrong or broken link (Altronix)');
    expect(
      report.body.startsWith(
        "What's wrong: Wrong or broken link\nManufacturer: Altronix\nDetails: Goes to a 404 page",
      ),
    ).toBe(true);
    expect(report.body).toContain('Search: "altronix"');
    expect(report.body).toMatch(/Build: \d{4}-\d{2}-\d{2} · [0-9a-f]{7}/);
  });

  it('branch problems never mention a manufacturer, and name the tab instead', () => {
    const report = problemReport({
      kind: problemKind('branch')!,
      line: 'Altronix',
      details: '',
      tabName: 'Branches',
      pageLines: [],
    });
    expect(report.title).toBe('Counter Intelligence: Branch info is wrong (Branches)');
    expect(report.body).not.toContain('Manufacturer:');
    expect(report.body).toContain('Details: (none)');
  });
});

describe('ideaReport', () => {
  it('waits for the task (3+ characters)', () => {
    expect(ideaReport({ task: ' ab ', wish: '', often: null, pageLines: [] })).toBeNull();
  });

  it('builds the idea report with the task as the title', () => {
    const report = ideaReport({
      task: 'Quote a 16-camera job and pick a switch that can power it',
      wish: 'PoE budget linked from the line card',
      often: 'Every week',
      pageLines: PAGE_LINES,
    })!;
    expect(report.title).toBe(
      'Counter Intelligence idea: Quote a 16-camera job and pick a switch that can power it',
    );
    expect(
      report.body.startsWith(
        'Idea\nTrying to do: Quote a 16-camera job and pick a switch that can power it\n' +
          'Would make it easier: PoE budget linked from the line card\nHow often: Every week',
      ),
    ).toBe(true);
    expect(report.body).toContain('Page details:');
    expect(report.body).toContain('Tab: Line Card');
  });

  it('shortens a long task in the title', () => {
    const report = ideaReport({ task: 'x'.repeat(80), wish: '', often: null, pageLines: [] })!;
    expect(report.title).toBe(`Counter Intelligence idea: ${'x'.repeat(57)}…`);
    expect(report.body).toContain('Would make it easier: (not said)\nHow often: (not said)');
  });
});

describe('countText / searchStatusText', () => {
  it('counts characters against the limit', () => {
    expect(countText('Goes to a 404 page')).toBe('18 / 500');
    expect(countText('')).toBe('');
  });

  it('matches the status line wording, including a corrected search', () => {
    expect(
      searchStatusText({
        shownCount: 2,
        totalCount: 180,
        noun: { one: 'manufacturer', many: 'manufacturers' },
        filterLabel: 'Access Control',
        search: 'maglok',
        correctedSearch: 'maglock',
      }),
    ).toBe(
      'Showing 2 of 180 manufacturers in Access Control matching “maglock” (you typed “maglok”)',
    );
  });

  it('counts the total, not what is shown: "1 of 22 branches"', () => {
    const branch = { one: 'branch', many: 'branches' };
    expect(nounForTotal(22, branch)).toBe('branches');
    expect(nounForTotal(1, branch)).toBe('branch');
    const status = searchStatusText({
      shownCount: 1,
      totalCount: 22,
      noun: branch,
      filterLabel: null,
      search: 'spokane',
      correctedSearch: '',
    });
    expect(status).toBe('Showing 1 of 22 branches matching “spokane”');
  });
});
