// What the feedback endpoint accepts from the page, and the GitHub request it turns that into. Pure, so
// both can be checked directly (feedback.spec.ts); index.ts does the fetching.

export type FeedbackKind = 'problem' | 'idea';

export interface FeedbackSubmission {
  kind: FeedbackKind;
  title: string;
  body: string;
  /** The Turnstile widget's answer, checked with Cloudflare before anything is posted. */
  turnstileToken: string;
}

// The dialog's boxes are 500 characters each, so a real report is far under these. They stop anyone
// posting straight to the endpoint from filing something huge. 2048 is Turnstile's own token maximum.
export const LIMITS = { title: 256, body: 4000, turnstileToken: 2048 };

// GitHub's default labels, so they exist in any repo without setting them up.
const LABELS: Record<FeedbackKind, string> = { problem: 'bug', idea: 'enhancement' };

function isText(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

/** The request body, or null when it isn't exactly what the dialog sends. */
export function parseSubmission(value: unknown): FeedbackSubmission | null {
  if (typeof value !== 'object' || value === null) return null;
  const { kind, title, body, turnstileToken } = value as Record<string, unknown>;
  if (kind !== 'problem' && kind !== 'idea') return null;
  if (!isText(title, LIMITS.title) || !isText(body, LIMITS.body)) return null;
  if (!isText(turnstileToken, LIMITS.turnstileToken)) return null;
  return { kind, title: title.trim(), body: body.trim(), turnstileToken };
}

export interface GitHubIssueRequest {
  url: string;
  init: RequestInit;
}

// docs.github.com/en/rest/issues/issues#create-an-issue. The issue's author is the token's owner, and
// nothing about the person who sent it is added: only the title and body the dialog built.
export function githubIssueRequest(
  repo: string,
  token: string,
  submission: FeedbackSubmission,
): GitHubIssueRequest {
  return {
    url: `https://api.github.com/repos/${repo}/issues`,
    init: {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        // GitHub rejects API requests without one.
        'User-Agent': 'counter-intelligence-feedback',
        'X-GitHub-Api-Version': '2026-03-10',
      },
      body: JSON.stringify({
        title: submission.title,
        body: submission.body,
        labels: [LABELS[submission.kind]],
      }),
    },
  };
}
