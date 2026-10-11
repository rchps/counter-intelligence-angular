// The site's only server code. wrangler.jsonc runs this Worker first for /api/* and serves every other
// path straight from the static build. POST /api/feedback checks that the request came through Cloudflare
// Access, then files the report as a GitHub issue. The GitHub token lives here, as a Worker secret, so it
// never reaches the browser.
//
// Access also adds the signed-in person's email to every request (Cf-Access-Authenticated-User-Email, and
// inside the token). It's never read or passed on: the GitHub request is built from the report's title and
// body only.
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { githubIssueRequest, parseSubmission } from './feedback';

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  /** "owner/repo", from wrangler.jsonc's vars. */
  GITHUB_REPO: string;
  /** "https://<team>.cloudflareaccess.com", from wrangler.jsonc's vars. */
  ACCESS_TEAM_DOMAIN: string;
  /** The Access application's audience (AUD) tag, from wrangler.jsonc's vars. */
  ACCESS_AUD: string;
  /** A secret, set with `wrangler secret put` (docs/ci-cd.md). */
  GITHUB_TOKEN: string;
}

function status(code: number, headers?: HeadersInit): Response {
  return new Response(null, { status: code, headers });
}

// developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/. Access lets only
// signed-in people reach the site at all, and signs a token saying so into every request. Checking it here
// means a mistake in the Access settings leaves the endpoint closed instead of open to anyone. The keys are
// fetched from the team's address (they rotate) and cached by jose for the life of the Worker instance.
const accessKeys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

async function passesAccess(request: Request, env: Env): Promise<boolean> {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || !env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) return false;
  let keys = accessKeys.get(env.ACCESS_TEAM_DOMAIN);
  if (!keys) {
    keys = createRemoteJWKSet(new URL('/cdn-cgi/access/certs', env.ACCESS_TEAM_DOMAIN));
    accessKeys.set(env.ACCESS_TEAM_DOMAIN, keys);
  }
  try {
    await jwtVerify(token, keys, { issuer: env.ACCESS_TEAM_DOMAIN, audience: env.ACCESS_AUD });
    return true;
  } catch (error) {
    console.warn('Access token refused:', error instanceof Error ? error.message : error);
    return false;
  }
}

export async function handleFeedback(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return status(405, { Allow: 'POST' });
  if (!(await passesAccess(request, env))) return status(403);

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return status(400);
  }
  const submission = parseSubmission(json);
  if (!submission) return status(400);

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
