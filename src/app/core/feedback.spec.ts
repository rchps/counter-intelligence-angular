import {
  countText,
  ideaEmail,
  mailtoHref,
  pageDetailLines,
  problemEmail,
  problemKind,
  searchStatusText,
} from './feedback';

// The emails the dialog builds. (Entry points, focus and the dialog itself are checked in
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

describe('problemEmail', () => {
  it('wrong link for a manufacturer: subject names it, body leads with the report', () => {
    const email = problemEmail({
      kind: problemKind('link')!,
      line: 'Altronix',
      details: 'Goes to a 404 page',
      tabName: 'Line Card',
      pageLines: PAGE_LINES,
    });
    expect(email.subject).toBe('Counter Intelligence: Wrong or broken link (Altronix)');
    expect(
      email.body.startsWith(
        "What's wrong: Wrong or broken link\nManufacturer: Altronix\nDetails: Goes to a 404 page",
      ),
    ).toBe(true);
    expect(email.body).toContain('Search: "altronix"');
    expect(email.body).toMatch(/Build: \d{4}-\d{2}-\d{2} · [0-9a-f]{7}/);
  });

  it('branch problems never mention a manufacturer, and name the tab instead', () => {
    const email = problemEmail({
      kind: problemKind('branch')!,
      line: 'Altronix',
      details: '',
      tabName: 'Branches',
      pageLines: [],
    });
    expect(email.subject).toBe('Counter Intelligence: Branch info is wrong (Branches)');
    expect(email.body).not.toContain('Manufacturer:');
    expect(email.body).toContain('Details: (none)');
  });
});

describe('ideaEmail', () => {
  it('waits for the task (3+ characters)', () => {
    expect(ideaEmail({ task: ' ab ', wish: '', often: null, pageLines: [] })).toBeNull();
  });

  it('builds the idea email with the task as the subject', () => {
    const email = ideaEmail({
      task: 'Quote a 16-camera job and pick a switch that can power it',
      wish: 'PoE budget linked from the line card',
      often: 'Every week',
      pageLines: PAGE_LINES,
    })!;
    expect(email.subject).toBe(
      'Counter Intelligence idea: Quote a 16-camera job and pick a switch that can power it',
    );
    expect(
      email.body.startsWith(
        'Idea\nTrying to do: Quote a 16-camera job and pick a switch that can power it\n' +
          'Would make it easier: PoE budget linked from the line card\nHow often: Every week',
      ),
    ).toBe(true);
    expect(email.body).toContain('Page details:');
    expect(email.body).toContain('Tab: Line Card');
  });

  it('shortens a long task in the subject', () => {
    const email = ideaEmail({ task: 'x'.repeat(80), wish: '', often: null, pageLines: [] })!;
    expect(email.subject).toBe(`Counter Intelligence idea: ${'x'.repeat(57)}…`);
    expect(email.body).toContain('Would make it easier: (not said)\nHow often: (not said)');
  });
});

describe('countText / mailtoHref / searchStatusText', () => {
  it('counts characters against the limit', () => {
    expect(countText('Goes to a 404 page')).toBe('18 / 500');
    expect(countText('')).toBe('');
  });

  it('encodes subject and body into a mailto link', () => {
    expect(mailtoHref('a@b.com', { subject: 'Hi there', body: 'Line 1\nLine 2' })).toBe(
      'mailto:a@b.com?subject=Hi%20there&body=Line%201%0ALine%202',
    );
  });

  it('matches the status line wording, including a corrected search', () => {
    expect(
      searchStatusText({
        shownCount: 2,
        totalCount: 180,
        noun: 'manufacturers',
        filterLabel: 'Access Control',
        search: 'maglok',
        correctedSearch: 'maglock',
      }),
    ).toBe(
      'Showing 2 of 180 manufacturers in Access Control matching “maglock” (you typed “maglok”)',
    );
  });
});
