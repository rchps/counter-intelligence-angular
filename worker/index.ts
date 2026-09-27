// The site's only server code. wrangler.jsonc runs this Worker first for /api/* and serves every other
// path straight from the static build. POST /api/feedback checks the Turnstile answer, then files the
// report as a GitHub issue. The GitHub token lives here, as a Worker secret, so it never reaches the
// browser.
//
// Cloudflare Access adds the signed-in person's email to every request (Cf-Access-Authenticated-User-
// Email). It's never read or passed on: the GitHub request is built from the report's title and body only.
import { githubIssueRequest, parseSubmission } from './feedback';

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** "owner/repo", from wrangler.jsonc's vars. */
  GITHUB_REPO: string;
  /** Secrets, set with `wrangler secret put` (docs/ci-cd.md). */
  GITHUB_TOKEN: string;
  TURNSTILE_SECRET_KEY: string;
}

interface SiteverifyResult {
  success: boolean;
  'error-codes'?: string[];
}

function status(code: number, headers?: HeadersInit): Response {
  return new Response(null, { status: code, headers });
}

// developers.cloudflare.com/turnstile/get-started/server-side-validation/. A token passes once, and only
// within five minutes of the widget issuing it.
async function passesTurnstile(token: string, secret: string): Promise<boolean> {
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, response: token }),
  });
  if (!response.ok) return false;
  const result: SiteverifyResult = await response.json();
  if (!result.success) console.warn('Turnstile said no:', result['error-codes']);
  return result.success;
}

export async function handleFeedback(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return status(405, { Allow: 'POST' });

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return status(400);
  }
  const submission = parseSubmission(json);
  if (!submission) return status(400);

  if (!(await passesTurnstile(submission.turnstileToken, env.TURNSTILE_SECRET_KEY))) {
    return status(403);
  }

  const { url, init } = githubIssueRequest(env.GITHUB_REPO, env.GITHUB_TOKEN, submission);
  const github = await fetch(url, init);
  if (!github.ok) {
    console.error('GitHub refused the issue:', github.status, await github.text());
    return status(502);
  }
  return status(201);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/api/feedback') return handleFeedback(request, env);
    if (pathname.startsWith('/api/')) return status(404);
    return env.ASSETS.fetch(request);
  },
};
