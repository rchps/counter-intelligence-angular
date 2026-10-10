import { describe, expect, it } from 'vitest';
import {
  addToChangelog,
  biggestBump,
  CHANGELOG_TITLE,
  changelogReleases,
  isAppFile,
  nextVersion,
  NO_NOTES,
  notesOfTagMessage,
  parseChangeset,
  releaseNotes,
  tagMessage,
  versionOfTag,
  type Changeset,
} from './release.mts';

const changeset = (file: string, bump: Changeset['bump'], note = file): Changeset => ({
  file,
  bump,
  note,
});

describe('parseChangeset', () => {
  it('reads the bump and the line for the counter', () => {
    const text = '---\nbump: minor\n---\nTools shows a few tips\nthe first time it opens.\n';
    expect(parseChangeset('.changeset/tips.md', text)).toEqual({
      file: '.changeset/tips.md',
      bump: 'minor',
      note: 'Tools shows a few tips the first time it opens.',
    });
  });

  it('accepts Windows line endings', () => {
    expect(parseChangeset('a.md', '---\r\nbump: patch\r\n---\r\nFixed.\r\n').bump).toBe('patch');
  });

  it('names the file when the bump is missing or misspelled', () => {
    expect(() => parseChangeset('a.md', 'Fixed.')).toThrow(/a\.md/);
    expect(() => parseChangeset('b.md', '---\nbump: minro\n---\nFixed.')).toThrow(/b\.md.*minro/);
  });

  it('wants a note', () => {
    expect(() => parseChangeset('c.md', '---\nbump: patch\n---\n')).toThrow(/c\.md/);
  });
});

describe('biggestBump', () => {
  it('takes the biggest asked for', () => {
    expect(biggestBump([changeset('a', 'patch'), changeset('b', 'minor')])).toBe('minor');
    expect(biggestBump([changeset('a', 'major'), changeset('b', 'minor')])).toBe('major');
  });

  it('is a patch with nothing asked for: every deploy is a release', () => {
    expect(biggestBump([])).toBe('patch');
  });
});

describe('nextVersion', () => {
  it('bumps one part and zeroes the ones after it', () => {
    expect(nextVersion('1.4.2', 'patch')).toBe('1.4.3');
    expect(nextVersion('1.4.2', 'minor')).toBe('1.5.0');
    expect(nextVersion('1.4.2', 'major')).toBe('2.0.0');
    expect(nextVersion('0.0.0', 'minor')).toBe('0.1.0');
  });

  it('counts past 9 as numbers, not text', () => {
    expect(nextVersion('1.9.9', 'patch')).toBe('1.9.10');
  });

  it('refuses something that isn’t a version', () => {
    expect(() => nextVersion('v1.4', 'patch')).toThrow();
  });
});

describe('versionOfTag', () => {
  it('reads release tags only', () => {
    expect(versionOfTag('v1.4.0')).toBe('1.4.0');
    expect(versionOfTag('1.4.0')).toBeNull();
    expect(versionOfTag('v1.4.0-rc1')).toBeNull();
  });
});

describe('release notes', () => {
  it('lists each changeset’s note, in file order', () => {
    expect(
      releaseNotes([changeset('b.md', 'patch', 'B'), changeset('a.md', 'minor', 'A')]),
    ).toEqual(['A', 'B']);
  });

  it('still says something with no changesets', () => {
    expect(releaseNotes([])).toEqual([NO_NOTES]);
  });

  it('round-trips through the tag’s message', () => {
    const message = tagMessage('1.4.0', ['Tips for Tools.', 'Swipe tip.']);
    expect(message).toBe('v1.4.0\n\n- Tips for Tools.\n- Swipe tip.\n');
    expect(notesOfTagMessage(message)).toEqual(['Tips for Tools.', 'Swipe tip.']);
  });
});

describe('addToChangelog', () => {
  const v1 = { version: '1.0.0', date: '2026-10-01', notes: ['First.'] };
  const v11 = { version: '1.1.0', date: '2026-10-05', notes: ['Tips.', 'Swipe.'] };
  const v12 = { version: '1.2.0', date: '2026-10-09', notes: ['Versions.'] };

  it('starts a changelog, newest release first, with a dated section each', () => {
    expect(addToChangelog(null, [v1, v11])).toBe(
      `${CHANGELOG_TITLE}\n\n## v1.1.0 (2026-10-05)\n\n- Tips.\n- Swipe.\n\n## v1.0.0 (2026-10-01)\n\n- First.\n`,
    );
  });

  it('adds only the releases it doesn’t list yet, above the rest', () => {
    const existing = addToChangelog(null, [v1, v11]);
    const updated = addToChangelog(existing, [v1, v11, v12]);
    expect(changelogReleases(updated).map((r) => r.version)).toEqual(['1.2.0', '1.1.0', '1.0.0']);
  });

  it('changes nothing the second time', () => {
    const once = addToChangelog(null, [v1, v11]);
    expect(addToChangelog(once, [v1, v11])).toBe(once);
  });

  it('keeps hand edits to sections already there', () => {
    const edited = addToChangelog(null, [v1]).replace('- First.', '- First, by hand.');
    expect(addToChangelog(edited, [v1, v11])).toContain('- First, by hand.');
  });

  it('reads back what it wrote, for the app’s What’s new', () => {
    expect(changelogReleases(addToChangelog(null, [v1, v11]))).toEqual([v11, v1]);
  });
});

describe('isAppFile', () => {
  it('counts the app and its data, not tests, scripts or docs', () => {
    expect(isAppFile('src/app/core/tour.ts')).toBe(true);
    expect(isAppFile('public/data/lines.json')).toBe(true);
    expect(isAppFile('src/app/core/tour.spec.ts')).toBe(false);
    expect(isAppFile('scripts/release.mts')).toBe(false);
    expect(isAppFile('docs/ci-cd.md')).toBe(false);
  });
});
