import { describe, expect, it } from 'vitest';
import {
  addToChangelog,
  biggestBump,
  bumpOf,
  CHANGELOG_TITLE,
  changelogReleases,
  effectiveSubject,
  nextVersion,
  NO_NOTES,
  notesOfTagMessage,
  parseTitle,
  releaseNotes,
  tagMessage,
  titleProblem,
  versionOfTag,
  type Commit,
} from './release.mts';

const commit = (subject: string, body = ''): Commit => ({ subject, body });

describe('parseTitle', () => {
  it('reads type, scope and description, without the PR number a squash adds', () => {
    expect(parseTitle('feat(line-card): a Back to top button (#108)')).toEqual({
      type: 'feat',
      scope: 'line-card',
      breaking: false,
      description: 'a Back to top button',
    });
  });

  it('takes a title with no scope, and a breaking one', () => {
    expect(parseTitle('fix: a typo')?.scope).toBeNull();
    expect(parseTitle('feat(tools)!: new margin rules')?.breaking).toBe(true);
  });

  it('keeps issue numbers that are part of the description', () => {
    expect(parseTitle('fix(poe): incomplete rows (#54, #60) (#137)')?.description).toBe(
      'incomplete rows (#54, #60)',
    );
  });

  it('is null for a title without a type', () => {
    expect(parseTitle('Line Card: a Back to top button')).toBeNull();
    expect(parseTitle('feat:no space')).toBeNull();
  });
});

describe('titleProblem', () => {
  it('accepts the known types', () => {
    expect(titleProblem('feat(tools): tips')).toBeNull();
    expect(titleProblem('docs: releases')).toBeNull();
  });

  it('explains what’s wrong otherwise', () => {
    expect(titleProblem('Tools: tips')).toMatch(/Start the title with a type/);
    expect(titleProblem('feature: tips')).toMatch(/"feature" isn't a type/);
  });
});

describe('bumpOf', () => {
  it('is major for a ! or a BREAKING CHANGE footer, minor for feat, patch for the rest', () => {
    expect(bumpOf(commit('feat!: new rules'))).toBe('major');
    expect(bumpOf(commit('fix: x', 'Details.\n\nBREAKING CHANGE: saved sales move'))).toBe('major');
    expect(bumpOf(commit('feat(tools): tips'))).toBe('minor');
    expect(bumpOf(commit('fix: typo'))).toBe('patch');
    expect(bumpOf(commit('docs: readme'))).toBe('patch');
    expect(bumpOf(commit('Something without a type'))).toBe('patch');
  });

  it('reads a merge commit by its PR title', () => {
    const merge = commit('Merge pull request #12 from rchps/feat/tips', 'feat(tools): tips\n');
    expect(effectiveSubject(merge)).toBe('feat(tools): tips');
    expect(bumpOf(merge)).toBe('minor');
  });
});

describe('biggestBump', () => {
  it('takes the biggest among the commits', () => {
    expect(biggestBump([commit('fix: a'), commit('feat: b')])).toBe('minor');
    expect(biggestBump([commit('feat!: a'), commit('feat: b')])).toBe('major');
  });

  it('is a patch with nothing in it: every deploy is a release', () => {
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
  it('lists the feat, fix and perf titles, oldest first, capitalised', () => {
    // As git log gives them: newest first.
    const commits = [
      commit('fix(poe): a wrong total (#140)'),
      commit('docs: releases (#139)'),
      commit('feat(tools): tips the first time Tools opens (#138)'),
    ];
    expect(releaseNotes(commits)).toEqual(['Tips the first time Tools opens', 'A wrong total']);
  });

  it('keeps anything breaking, whatever its type', () => {
    expect(releaseNotes([commit('refactor!: saved data moves')])).toEqual(['Saved data moves']);
  });

  it('keeps a title without a type as it is, since there’s no telling', () => {
    expect(releaseNotes([commit('Update readme screenshots (#139)')])).toEqual([
      'Update readme screenshots',
    ]);
  });

  it('still says something with nothing to tell', () => {
    expect(releaseNotes([commit('ci: faster')])).toEqual([NO_NOTES]);
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
