// Versioned releases (#129), from git and files in the repo alone: no GitHub token, API or setting, so
// moving CI to another host means changing the one workflow step that calls this.
//
// - A change that matters to the counter adds a changeset: .changeset/<any-name>.md with a bump size
//   (patch, minor or major) and one plain-language line (.changeset/README.md).
// - Each deploy of main is a release. CI asks `plan` for the next version (the biggest bump among the
//   changesets added since the last release tag, or a patch if there are none), builds with it, deploys,
//   and only then runs `tag`: an annotated tag (v1.4.0) whose message is the release notes. A failed
//   deploy leaves no tag. main is protected, so CI never commits; the tag is the record of the release.
// - Now and then, `npm run release` (no command) brings the repo up to date with the tags: a dated
//   CHANGELOG.md section per release not in it yet, package.json's version set to the newest, and the
//   changesets those releases used deleted. Commit that on a branch and merge it like any other change.
//   `--dry-run` shows what it would do and changes nothing.
// - `check` warns when a branch changes the app without adding a changeset; `whats-new <file>` writes the
//   newest CHANGELOG.md sections as JSON for the app to show (the build runs it).
//
// Run with `node scripts/release.mts [plan | tag | check | whats-new <file>] [--dry-run]`.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export type Bump = 'patch' | 'minor' | 'major';

const BUMPS: readonly Bump[] = ['patch', 'minor', 'major'];

export interface Changeset {
  file: string;
  bump: Bump;
  note: string;
}

export interface Release {
  /** Without the leading v: "1.4.0". */
  version: string;
  /** YYYY-MM-DD. */
  date: string;
  notes: string[];
}

/** What a release with no changesets says: every deploy is a release, even one with nothing to tell. */
export const NO_NOTES = 'Small fixes and upkeep.';
export const CHANGELOG_TITLE = '# Changelog';
/** How many releases the app's What's new data holds. */
export const WHATS_NEW_RELEASES = 5;

// ---- Pure parts (unit tested in release.spec.mts) ----

/**
 * Reads a changeset file:
 *
 *     ---
 *     bump: minor
 *     ---
 *     Tools shows a few tips the first time it opens.
 *
 * Throws, naming the file, when it isn't in that shape: a release shouldn't go out with a typo in it.
 */
export function parseChangeset(file: string, text: string): Changeset {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text.trim() + '\n');
  if (!match) throw new Error(`${file}: expected a "---" block with bump: patch|minor|major`);
  const bump = /^bump:\s*(\S+)\s*$/m.exec(match[1])?.[1];
  if (!isBump(bump)) throw new Error(`${file}: bump must be patch, minor or major, not "${bump}"`);
  const note = match[2].trim().replace(/\s+/g, ' ');
  if (!note) throw new Error(`${file}: add one line saying what changed, for the counter`);
  return { file, bump, note };
}

function isBump(value: unknown): value is Bump {
  return BUMPS.includes(value as Bump);
}

/** The biggest bump asked for. Nothing asked: a patch, since every deploy is a release. */
export function biggestBump(changesets: readonly Changeset[]): Bump {
  return changesets.reduce<Bump>(
    (biggest, { bump }) => (BUMPS.indexOf(bump) > BUMPS.indexOf(biggest) ? bump : biggest),
    'patch',
  );
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

/** The release's notes, one per changeset, in the order the files sort. */
export function releaseNotes(changesets: readonly Changeset[]): string[] {
  const notes = [...changesets].sort((a, b) => a.file.localeCompare(b.file)).map((c) => c.note);
  return notes.length ? notes : [NO_NOTES];
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

/** Whether a path is part of the app people use, so changing it deserves a changeset. Tests don't. */
export function isAppFile(path: string): boolean {
  if (!path.startsWith('src/') && !path.startsWith('public/')) return false;
  return !/\.spec\.ts$/.test(path);
}

// ---- Git and files ----

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CHANGESET_DIR = '.changeset';

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

function changesetFilesNow(): string[] {
  const dir = join(ROOT, CHANGESET_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .map((name) => `${CHANGESET_DIR}/${name}`);
}

function changesetFilesAt(ref: string): Set<string> {
  const listing = gitOrNull('ls-tree', '--name-only', `${ref}:${CHANGESET_DIR}`) ?? '';
  return new Set(
    listing
      .split('\n')
      .filter(Boolean)
      .map((name) => `${CHANGESET_DIR}/${name}`),
  );
}

/** The changesets added since the last release: the ones the next release is made of. */
function pendingChangesets(): Changeset[] {
  const tag = lastReleaseTag();
  const released = tag ? changesetFilesAt(tag) : new Set<string>();
  return changesetFilesNow()
    .filter((file) => !released.has(file))
    .map((file) => parseChangeset(file, readFileSync(join(ROOT, file), 'utf-8')));
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
  const current = (last && versionOfTag(last)) ?? packageVersion();
  const changesets = pendingChangesets();
  return {
    version: nextVersion(current, biggestBump(changesets)),
    notes: releaseNotes(changesets),
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
  // KEY=value lines, which CI appends to its step outputs.
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

function runCheck(base: string): void {
  const changed = (gitOrNull('diff', '--name-only', '--diff-filter=AMDR', `${base}...HEAD`) ?? '')
    .split('\n')
    .filter(Boolean);
  const appChanged = changed.some(isAppFile);
  const added = changed.some(
    (file) => file.startsWith(`${CHANGESET_DIR}/`) && file !== `${CHANGESET_DIR}/README.md`,
  );
  pendingChangesets(); // fails the check on a malformed changeset
  if (!appChanged || added) {
    console.log(appChanged ? 'The app changed, with a changeset.' : 'The app is unchanged.');
    return;
  }
  const text =
    'This branch changes the app but adds no changeset, so its release will say only ' +
    `"${NO_NOTES}" Add one if the counter would notice (.changeset/README.md).`;
  console.log(process.env['GITHUB_ACTIONS'] ? `::warning::${text}` : `Note: ${text}`);
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
  const released = changesetFilesAt(`v${newest}`);
  const used = changesetFilesNow().filter((file) => released.has(file));
  const packagePath = join(ROOT, 'package.json');
  const pkg = readFileSync(packagePath, 'utf-8');
  const newPkg = pkg.replace(/"version": "[^"]*"/, `"version": "${newest}"`);

  const changes = [
    ...(after !== before ? ['CHANGELOG.md: add the releases it was missing'] : []),
    ...(newPkg !== pkg ? [`package.json: version ${newest}`] : []),
    ...used.map((file) => `delete ${file} (released)`),
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
  used.forEach((file) => rmSync(join(ROOT, file)));
  console.log('\nCommit these on a branch and merge them like any other change.');
}

function main(): void {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const [command, value] = args.filter((arg) => !arg.startsWith('--'));
  if (command === 'plan') runPlan();
  else if (command === 'tag') runTag(dryRun);
  else if (command === 'check') runCheck(value ?? 'origin/main');
  else if (command === 'whats-new' && value) runWhatsNew(value);
  else if (command === undefined) runRelease(dryRun);
  else {
    console.error(
      'Usage: node scripts/release.mts [plan | tag | check [base] | whats-new <file>] [--dry-run]',
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
