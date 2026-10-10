// Versioned releases (#129), from git alone: no GitHub token, API or setting, so moving CI to another
// host means changing the one workflow step that calls this.
//
// - Pull request titles follow Conventional Commits (conventionalcommits.org): `feat(tools): ...`,
//   `fix(line-card): ...`, `docs: ...`. PRs are squash-merged, so each title becomes one commit on main,
//   and that's what this reads. `check-title` checks a title before it gets there.
// - Each deploy of main is a release. CI asks `plan` for the next version: the last release tag bumped
//   by the biggest change since it (a `!` or BREAKING CHANGE: major, feat: minor, anything else: patch),
//   with the feat/fix/perf titles as its notes. It builds with that version, deploys, and only then runs
//   `tag`: an annotated tag (v1.4.0) whose message is the notes. A failed deploy leaves no tag. main is
//   protected, so CI never commits; the tag is the record of the release.
// - Now and then, `npm run release` (no command) brings the repo up to date with the tags: a dated
//   CHANGELOG.md section per release not in it yet, and package.json's version set to the newest. Commit
//   that on a branch and merge it like any other change. `--dry-run` shows what it would do.
// - `whats-new <file>` writes the newest CHANGELOG.md sections as JSON for the app (the build runs it).
//
// Run with `node scripts/release.mts [plan | tag | check-title [title] | whats-new <file>] [--dry-run]`.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export type Bump = 'patch' | 'minor' | 'major';

const BUMPS: readonly Bump[] = ['patch', 'minor', 'major'];

/** The Conventional Commits types a title may use. Only feat, fix and perf make the release notes:
 *  the rest are changes the counter wouldn't notice. */
export const TITLE_TYPES = [
  'feat',
  'fix',
  'perf',
  'refactor',
  'docs',
  'test',
  'ci',
  'build',
  'chore',
  'style',
  'revert',
] as const;
const NOTED_TYPES: readonly string[] = ['feat', 'fix', 'perf'];

export interface Commit {
  subject: string;
  body: string;
}

export interface Title {
  type: string;
  scope: string | null;
  breaking: boolean;
  /** Without the PR number GitHub adds when it squashes: "a Back to top button". */
  description: string;
}

export interface Release {
  /** Without the leading v: "1.4.0". */
  version: string;
  /** YYYY-MM-DD. */
  date: string;
  notes: string[];
}

/** What a release says with nothing the counter would notice in it: every deploy is a release. */
export const NO_NOTES = 'Small fixes and upkeep.';
/** The first release's note: before it, history has no titles to read. */
export const FIRST_RELEASE_NOTE = 'The first numbered release.';
export const CHANGELOG_TITLE = '# Changelog';
/** How many releases the app's What's new data holds. */
export const WHATS_NEW_RELEASES = 5;

// ---- Pure parts (unit tested in release.spec.mts) ----

/**
 * Reads a Conventional Commits title, `type(scope)!: description`, or null when it isn't one. A
 * trailing PR number from a squash merge, " (#123)", is left out of the description.
 */
export function parseTitle(subject: string): Title | null {
  const match = /^([a-z]+)(?:\(([^)\s]+)\))?(!)?: (\S.*)$/.exec(subject.trim());
  if (!match) return null;
  const [, type, scope, bang, rest] = match;
  return {
    type,
    scope: scope ?? null,
    breaking: !!bang,
    description: rest.replace(/ \(#\d+\)$/, '').trim(),
  };
}

/** Why a PR title won't do, or null when it will. */
export function titleProblem(title: string): string | null {
  const parsed = parseTitle(title);
  const example = 'feat(tools): tips the first time Tools opens';
  if (!parsed) return `Start the title with a type, like "${example}".`;
  if (!(TITLE_TYPES as readonly string[]).includes(parsed.type)) {
    return `"${parsed.type}" isn't a type. Use one of: ${TITLE_TYPES.join(', ')}.`;
  }
  return null;
}

/**
 * A commit on main as it reads for a release. A merge commit ("Merge pull request #12 from ...") is read
 * by its PR title, which GitHub puts on the first line of its body.
 */
export function effectiveSubject(commit: Commit): string {
  if (/^Merge pull request #\d+ /.test(commit.subject)) {
    return (
      commit.body
        .split('\n')
        .find((line) => line.trim())
        ?.trim() ?? commit.subject
    );
  }
  return commit.subject;
}

/** A `!` or a BREAKING CHANGE footer: major. feat: minor. Anything else, or no type at all: patch. */
export function bumpOf(commit: Commit): Bump {
  const title = parseTitle(effectiveSubject(commit));
  if (title?.breaking || /^BREAKING[ -]CHANGE:/m.test(commit.body)) return 'major';
  return title?.type === 'feat' ? 'minor' : 'patch';
}

/** The biggest bump among the commits. None at all: a patch, since every deploy is a release. */
export function biggestBump(commits: readonly Commit[]): Bump {
  return commits
    .map(bumpOf)
    .reduce<Bump>((big, bump) => (BUMPS.indexOf(bump) > BUMPS.indexOf(big) ? bump : big), 'patch');
}

/**
 * The release's notes, oldest change first: each feat, fix and perf title, and anything breaking. A
 * subject without a type is kept as it is, since there's no telling whether the counter would notice.
 */
export function releaseNotes(commits: readonly Commit[]): string[] {
  const notes = [...commits].reverse().flatMap((commit) => {
    const subject = effectiveSubject(commit);
    const title = parseTitle(subject);
    if (!title) return [subject.replace(/ \(#\d+\)$/, '')];
    const noted = NOTED_TYPES.includes(title.type) || bumpOf(commit) === 'major';
    return noted ? [capitalize(title.description)] : [];
  });
  return notes.length ? notes : [NO_NOTES];
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "1.4.2" bumped: patch 1.4.3, minor 1.5.0, major 2.0.0. */
export function nextVersion(current: string, bump: Bump): string {
  const parts = /^(\d+)\.(\d+)\.(\d+)$/.exec(current);
  if (!parts) throw new Error(`Not a version (major.minor.patch): "${current}"`);
  const [major, minor, patch] = parts.slice(1).map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/** "v1.4.0" → "1.4.0"; anything else (a non-release tag) → null. */
export function versionOfTag(tag: string): string | null {
  return /^v(\d+\.\d+\.\d+)$/.exec(tag)?.[1] ?? null;
}

/** The release tag's message: its name, then the notes as a list (read back by notesOfTagMessage). */
export function tagMessage(version: string, notes: readonly string[]): string {
  return [`v${version}`, '', ...notes.map((note) => `- ${note}`)].join('\n') + '\n';
}

export function notesOfTagMessage(message: string): string[] {
  return message
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim());
}

export function changelogSection(release: Release): string {
  return [
    `## v${release.version} (${release.date})`,
    '',
    ...release.notes.map((n) => `- ${n}`),
  ].join('\n');
}

/** The releases a CHANGELOG.md lists, newest first, as written by addToChangelog. */
export function changelogReleases(markdown: string): Release[] {
  const releases: Release[] = [];
  for (const line of markdown.split('\n')) {
    const heading = /^## v(\d+\.\d+\.\d+) \((\d{4}-\d{2}-\d{2})\)\s*$/.exec(line);
    if (heading) releases.push({ version: heading[1], date: heading[2], notes: [] });
    else if (line.startsWith('- ') && releases.length) releases.at(-1)!.notes.push(line.slice(2));
  }
  return releases;
}

/**
 * CHANGELOG.md with a section for each release it doesn't list yet, newest at the top. Releases already
 * in it are left as they are, so running this twice changes nothing the second time.
 */
export function addToChangelog(existing: string | null, releases: readonly Release[]): string {
  const listed = new Set(changelogReleases(existing ?? '').map((r) => r.version));
  const added = releases
    .filter((r) => !listed.has(r.version))
    .sort((a, b) => compareVersions(b.version, a.version));
  const body = (existing ?? '').replace(CHANGELOG_TITLE, '').trim();
  const sections = [...added.map(changelogSection), ...(body ? [body] : [])];
  return [CHANGELOG_TITLE, '', ...sections.flatMap((s) => [s, ''])].join('\n');
}

export function compareVersions(a: string, b: string): number {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

// ---- Git and files ----

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function git(...args: string[]): string {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf-8' }).trim();
}

/** For questions git may have no answer to (no tags yet): null, and git's error kept off the screen. */
function gitOrNull(...args: string[]): string | null {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch {
    return null;
  }
}

/** The newest release tag reachable from HEAD, or null before the first release. */
function lastReleaseTag(): string | null {
  return gitOrNull('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*');
}

/** A release tag on HEAD itself: this commit has been released already (a re-run deploy). */
function releaseTagAtHead(): string | null {
  const tags = (gitOrNull('tag', '--points-at', 'HEAD', '--list', 'v[0-9]*') ?? '').split('\n');
  return tags.find((tag) => versionOfTag(tag)) ?? null;
}

function packageVersion(): string {
  return (JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf-8')) as { version: string })
    .version;
}

/** main's own commits since `tag`, newest first: one per merged PR, not the commits inside them. */
function commitsSince(tag: string): Commit[] {
  const log = git('log', '--first-parent', '--format=%s%x00%b%x1e', `${tag}..HEAD`);
  return log
    .split('\x1e')
    .map((record) => record.replace(/^\n/, ''))
    .filter(Boolean)
    .map((record) => {
      const [subject, body = ''] = record.split('\0');
      return { subject, body };
    });
}

interface Plan {
  version: string;
  notes: string[];
  /** HEAD already carries this release's tag: nothing to tag. */
  tagged: boolean;
}

function plan(): Plan {
  const tagged = releaseTagAtHead();
  if (tagged) {
    const message = git('tag', '--list', tagged, '--format=%(contents)');
    return { version: versionOfTag(tagged)!, notes: notesOfTagMessage(message), tagged: true };
  }
  const last = lastReleaseTag();
  // The first release is package.json's version as it stands.
  if (!last) return { version: packageVersion(), notes: [FIRST_RELEASE_NOTE], tagged: false };
  const commits = commitsSince(last);
  return {
    version: nextVersion(versionOfTag(last)!, biggestBump(commits)),
    notes: releaseNotes(commits),
    tagged: false,
  };
}

/** Every release tag, with its date and notes. */
function taggedReleases(): Release[] {
  const output = gitOrNull(
    'for-each-ref',
    'refs/tags/v*',
    '--format=%(refname:short)%00%(creatordate:short)%00%(contents)%00%00',
  );
  if (!output) return [];
  return output
    .split('\0\0')
    .map((record) => record.replace(/^\n/, '').split('\0'))
    .flatMap(([tag, date, message]) => {
      const version = tag ? versionOfTag(tag) : null;
      return version ? [{ version, date, notes: notesOfTagMessage(message ?? '') }] : [];
    });
}

// ---- Commands ----

function runPlan(): void {
  const { version, notes, tagged } = plan();
  // KEY=value lines, which CI appends to its step outputs. The notes go to stderr, for the log.
  console.log(`version=v${version}`);
  console.log(`tagged=${tagged}`);
  console.error(
    `\nv${version}${tagged ? ' (already tagged)' : ''}:\n${notes.map((n) => `- ${n}`).join('\n')}`,
  );
}

function runTag(dryRun: boolean): void {
  const { version, notes, tagged } = plan();
  if (tagged) {
    console.log(`HEAD is already v${version}.`);
    return;
  }
  const message = tagMessage(version, notes);
  if (dryRun) {
    console.log(`Would tag HEAD v${version}:\n\n${message}`);
    return;
  }
  git('tag', '--annotate', `v${version}`, '--message', message);
  console.log(`Tagged HEAD v${version}. Push it with: git push origin v${version}`);
}

function runCheckTitle(title: string): void {
  const problem = titleProblem(title);
  if (!problem) {
    console.log(`"${title}" is a ${bumpOf({ subject: title, body: '' })} change.`);
    return;
  }
  console.log(process.env['GITHUB_ACTIONS'] ? `::error::${problem}` : problem);
  process.exit(1);
}

function runWhatsNew(out: string): void {
  const path = join(ROOT, 'CHANGELOG.md');
  const releases = existsSync(path) ? changelogReleases(readFileSync(path, 'utf-8')) : [];
  writeFileSync(out, JSON.stringify({ releases: releases.slice(0, WHATS_NEW_RELEASES) }) + '\n');
}

function runRelease(dryRun: boolean): void {
  const releases = taggedReleases();
  const newest = releases
    .map((r) => r.version)
    .sort(compareVersions)
    .at(-1);
  if (!newest) {
    console.log('No release tags yet: the first deploy of main makes one.');
    return;
  }
  const changelogPath = join(ROOT, 'CHANGELOG.md');
  const before = existsSync(changelogPath) ? readFileSync(changelogPath, 'utf-8') : null;
  const after = addToChangelog(before, releases);
  const packagePath = join(ROOT, 'package.json');
  const pkg = readFileSync(packagePath, 'utf-8');
  const newPkg = pkg.replace(/"version": "[^"]*"/, `"version": "${newest}"`);

  const changes = [
    ...(after !== before ? ['CHANGELOG.md: add the releases it was missing'] : []),
    ...(newPkg !== pkg ? [`package.json: version ${newest}`] : []),
  ];
  if (!changes.length) {
    console.log(`Up to date with v${newest}.`);
    return;
  }
  console.log(`${dryRun ? 'Would' : 'Will'} bring the repo up to v${newest}:`);
  changes.forEach((change) => console.log(`  - ${change}`));
  if (dryRun) return;
  writeFileSync(changelogPath, after);
  writeFileSync(packagePath, newPkg);
  console.log('\nCommit these on a branch ("chore: changelog to vX") and merge it like any other.');
}

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const [command, value] = args.filter((arg) => !arg.startsWith('--'));
  if (command === 'plan') runPlan();
  else if (command === 'tag') runTag(dryRun);
  // CI passes the title through PR_TITLE, never on the command line, so a title can't run code.
  else if (command === 'check-title') runCheckTitle(value ?? process.env['PR_TITLE'] ?? '');
  else if (command === 'whats-new' && value) runWhatsNew(value);
  else if (command === undefined) runRelease(dryRun);
  else {
    console.error(
      'Usage: node scripts/release.mts [plan | tag | check-title [title] | whats-new <file>] [--dry-run]',
    );
    process.exit(2);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
