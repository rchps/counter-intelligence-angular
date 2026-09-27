// The "Report a problem" / "Suggest an idea" choices and copy, and the report each one builds. Pure, so
// the titles and bodies can be checked directly (feedback.spec.ts). The dialog posts the report to
// /api/feedback, and the Worker (worker/index.ts) files it as a GitHub issue under the site's own account,
// without the sender's name.

export type FeedbackMode = 'problem' | 'idea';
export type ProblemKindKey = 'link' | 'logo' | 'missing' | 'search' | 'branch' | 'tool' | 'other';

export interface ProblemKind {
  key: ProblemKindKey;
  label: string;
  /** Ask which manufacturer it's about. */
  line: boolean;
  /** Placeholder for the Details box. */
  hint: string;
}

export const PROBLEM_KINDS: ProblemKind[] = [
  {
    key: 'link',
    label: 'Wrong or broken link',
    line: true,
    hint: "e.g. goes to the wrong company, or won't load",
  },
  {
    key: 'logo',
    label: 'Wrong logo or name',
    line: true,
    hint: "e.g. shows another company's logo",
  },
  {
    key: 'missing',
    label: "A line we carry isn't here",
    line: true,
    hint: 'Its name and website, if you know them',
  },
  {
    key: 'search',
    label: "Search didn't find it",
    line: false,
    hint: 'What you searched for and what you expected',
  },
  {
    key: 'branch',
    label: 'Branch info is wrong',
    line: false,
    hint: "Which branch and what's wrong (address, phone...)",
  },
  {
    key: 'tool',
    label: 'A calculator looks off',
    line: false,
    hint: 'Which one, what you entered, and what you expected',
  },
  { key: 'other', label: 'Something else', line: false, hint: 'What happened?' },
];

export const NO_KIND_HINT = 'Anything that helps get it fixed';
export const HOW_OFTEN = ['Every day', 'Every week', 'Now and then'];
export const TEXT_LIMIT = 500;

export interface ModeCopy {
  title: string;
  lede: string;
  thanks: string;
  /** Shown when Send is pressed before the one required answer is given. */
  nudge: string;
}

export const MODE_COPY: Record<FeedbackMode, ModeCopy> = {
  problem: {
    title: 'Report a problem',
    lede:
      "Pick what's wrong and add a note. Takes about a minute. It's posted publicly on the project's " +
      'GitHub, without your name, so leave out anything private.',
    thanks: 'Sent. Thanks, you just made this better for the whole counter.',
    nudge: "Pick what's wrong first.",
  },
  idea: {
    title: 'Suggest an idea',
    lede:
      "Start with what you were trying to do. The job matters more than the feature, and it's how good ideas " +
      "get built right. It's posted publicly on the project's GitHub, without your name.",
    thanks: 'Sent. Thanks, the best ideas come from the counter.',
    nudge: 'Tell us what you were trying to do first.',
  },
};

export function problemKind(key: string | null | undefined): ProblemKind | null {
  return PROBLEM_KINDS.find((kind) => kind.key === key) ?? null;
}

/** "18 / 500", or nothing for an empty box. */
export function countText(text: string): string {
  return text.length ? `${text.length} / ${TEXT_LIMIT}` : '';
}

/** What a search page was showing, for the "Page details" block. */
export interface SearchPageDetails {
  search: string;
  filterLabel: string | null;
  status: string;
}

export interface PageDetailsInput {
  build: string;
  tabName: string;
  search: SearchPageDetails | null;
}

// The search page's "Page said" is the status line's words (no buttons).
export function pageDetailLines({ build, tabName, search }: PageDetailsInput): string[] {
  const lines = [`Build: ${build}`, `Tab: ${tabName}`];
  if (search) {
    lines.push(`Search: ${search.search ? `"${search.search}"` : '(none)'}`);
    if (search.filterLabel) lines.push(`Filter: ${search.filterLabel}`);
    if (search.status) lines.push(`Page said: ${search.status}`);
  }
  return lines;
}

/** A noun's two forms, e.g. { one: 'branch', many: 'branches' }. */
export interface CountNoun {
  one: string;
  many: string;
}

/** The noun in "Showing N of <total> …" counts the total, so it's "1 of 22 branches". */
export function nounForTotal(totalCount: number, noun: CountNoun): string {
  return totalCount === 1 ? noun.one : noun.many;
}

export interface SearchStatusInput {
  shownCount: number;
  totalCount: number;
  noun: CountNoun;
  filterLabel: string | null;
  search: string;
  correctedSearch: string;
}

// The plain words of SearchStatusComponent's status line (same wording, minus the markup and the
// "Clear search & filters" button), for "Page said:".
export function searchStatusText({
  shownCount,
  totalCount,
  noun,
  filterLabel,
  search,
  correctedSearch,
}: SearchStatusInput): string {
  let text = `Showing ${shownCount} of ${totalCount} ${nounForTotal(totalCount, noun)}`;
  if (filterLabel) text += ` in ${filterLabel}`;
  if (search && correctedSearch) text += ` matching “${correctedSearch}” (you typed “${search}”)`;
  else if (search) text += ` matching “${search}”`;
  return text;
}

/** Sending, and the ways it can go. */
export const SEND_COPY = {
  sending: 'Sending…',
  checking: 'One moment, checking this browser first. Try Send again in a few seconds.',
  blocked:
    "This browser couldn't be checked, so it can't send. Reload the page, or turn off a blocker for it.",
  failed: "It didn't go through. Try again in a minute.",
};

/** A GitHub issue's two parts. */
export interface FeedbackReport {
  title: string;
  body: string;
}

export interface ProblemReportInput {
  kind: ProblemKind;
  line: string;
  details: string;
  tabName: string;
  pageLines: string[];
}

export function problemReport({
  kind,
  line,
  details,
  tabName,
  pageLines,
}: ProblemReportInput): FeedbackReport {
  const lineName = line.trim();
  const includeLine = kind.line && !!lineName;
  const title =
    `Counter Intelligence: ${kind.label}` + (includeLine ? ` (${lineName})` : ` (${tabName})`);
  const body = [`What's wrong: ${kind.label}`];
  if (includeLine) body.push(`Manufacturer: ${lineName}`);
  body.push(`Details: ${details.trim() || '(none)'}`);
  body.push('', 'Page details:', ...pageLines);
  return { title, body: body.join('\n') };
}

export interface IdeaReportInput {
  task: string;
  wish: string;
  often: string | null;
  pageLines: string[];
}

/** The task is the one required answer (at least 3 characters); null until it's given. */
export function ideaReport({
  task,
  wish,
  often,
  pageLines,
}: IdeaReportInput): FeedbackReport | null {
  const taskText = task.trim();
  if (taskText.length < 3) return null;
  const short = taskText.length > 60 ? taskText.slice(0, 57).trimEnd() + '…' : taskText;
  const body = [
    'Idea',
    `Trying to do: ${taskText}`,
    `Would make it easier: ${wish.trim() || '(not said)'}`,
    `How often: ${often ?? '(not said)'}`,
    '',
    'Page details:',
    ...pageLines,
  ];
  return { title: `Counter Intelligence idea: ${short}`, body: body.join('\n') };
}
