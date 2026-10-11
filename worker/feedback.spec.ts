import { readFileSync } from 'node:fs';
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose';
import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { parse } from 'yaml';
import { githubIssueRequest, LIMITS, parseSubmission, type FeedbackSubmission } from './feedback';
import { handleFeedback, type Env } from './index';

interface StringSchema {
  maxLength: number;
}
interface ApiSpec {
  components: { schemas: { FeedbackSubmission: { properties: Record<string, StringSchema> } } };
}

const SUBMISSION: FeedbackSubmission = {
  kind: 'problem',
  title: 'Counter Intelligence: Wrong or broken link (Altronix)',
  body: "What's wrong: Wrong or broken link\nManufacturer: Altronix",
};

describe('the API spec', () => {
  // The generated types carry each field's type but not its length, so this keeps the two in step.
  it('allows the same lengths the Worker does', () => {
    const spec = parse(
      readFileSync(new URL('../api/openapi.yaml', import.meta.url), 'utf8'),
    ) as ApiSpec;
    const { properties } = spec.components.schemas.FeedbackSubmission;
    expect(properties['title']?.maxLength).toBe(LIMITS.title);
    expect(properties['body']?.maxLength).toBe(LIMITS.body);
  });
});

describe('wrangler.jsonc', () => {
  // Empty Access settings make the Worker turn every report away, so they can't reach a deploy.
  it('names the Access login the Worker checks', () => {
    const config = readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
    expect(config).toMatch(/"ACCESS_TEAM_DOMAIN": "https:\/\/[a-z0-9-]+\.cloudflareaccess\.com"/);
    expect(config).toMatch(/"ACCESS_AUD": "[^"]+"/);
  });
});

describe('parseSubmission', () => {
  it('takes what the dialog sends, trimmed', () => {
    expect(parseSubmission({ ...SUBMISSION, title: `  ${SUBMISSION.title} ` })).toEqual(SUBMISSION);
  });

  it('turns away anything else', () => {
    expect(parseSubmission(null)).toBeNull();
    expect(parseSubmission('text')).toBeNull();
    expect(parseSubmission({ ...SUBMISSION, kind: 'spam' })).toBeNull();
    expect(parseSubmission({ ...SUBMISSION, title: '   ' })).toBeNull();
    expect(parseSubmission({ ...SUBMISSION, body: 42 })).toBeNull();
  });

  it('turns away oversized fields', () => {
    expect(parseSubmission({ ...SUBMISSION, title: 'x'.repeat(LIMITS.title + 1) })).toBeNull();
    expect(parseSubmission({ ...SUBMISSION, body: 'x'.repeat(LIMITS.body + 1) })).toBeNull();
  });
});

describe('githubIssueRequest', () => {
  it("posts the title and body to the repo's issues, labelled by kind", () => {
    const { url, init } = githubIssueRequest('owner/repo', 'secret-token', SUBMISSION);
    expect(url).toBe('https://api.github.com/repos/owner/repo/issues');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      title: SUBMISSION.title,
      body: SUBMISSION.body,
      labels: ['bug'],
    });
    const idea = githubIssueRequest('owner/repo', 'secret-token', { ...SUBMISSION, kind: 'idea' });
    expect(JSON.parse(idea.init.body as string).labels).toEqual(['enhancement']);
  });

  it('sends the headers GitHub requires', () => {
    const headers = githubIssueRequest('owner/repo', 'secret-token', SUBMISSION).init
      .headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer secret-token');
    expect(headers['User-Agent']).toBeTruthy();
    expect(headers['X-GitHub-Api-Version']).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('handleFeedback', () => {
  const TEAM = 'https://counter.cloudflareaccess.com';
  const AUD = 'access-app-aud';
  const env: Env = {
    ASSETS: { fetch: () => Promise.resolve(new Response()) },
    GITHUB_REPO: 'owner/repo',
    ACCESS_TEAM_DOMAIN: TEAM,
    ACCESS_AUD: AUD,
    GITHUB_TOKEN: 'secret-token',
  };
  // Stands in for the team's Access signing key; its public half is served from the certs address.
  let accessKey: CryptoKey;
  let certs: { keys: object[] };
  let fetchMock: Mock<typeof fetch>;
  let githubStatus: number;

  beforeAll(async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    accessKey = privateKey;
    certs = { keys: [{ ...(await exportJWK(publicKey)), kid: 'access-key', alg: 'RS256' }] };
  });

  /** An Access token as Access would sign it; each claim can be changed to make a bad one. */
  function accessToken(
    claims: { iss?: string; aud?: string; key?: CryptoKey } = {},
  ): Promise<string> {
    return new SignJWT({ email: 'rep@example.com' })
      .setProtectedHeader({ alg: 'RS256', kid: 'access-key' })
      .setIssuer(claims.iss ?? TEAM)
      .setAudience(claims.aud ?? AUD)
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(claims.key ?? accessKey);
  }

  function post(body: unknown, token?: string): Request {
    const headers: Record<string, string> = {
      'Cf-Access-Authenticated-User-Email': 'rep@example.com',
    };
    if (token) headers['Cf-Access-Jwt-Assertion'] = token;
    return new Request('https://example.com/api/feedback', {
      method: 'POST',
      headers,
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  function githubCalls(): unknown[][] {
    return fetchMock.mock.calls.filter(([url]) =>
      String(url).startsWith('https://api.github.com/'),
    );
  }

  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    githubStatus = 201;
    fetchMock = vi.fn<typeof fetch>((input) =>
      Promise.resolve(
        String(input) === `${TEAM}/cdn-cgi/access/certs`
          ? Response.json(certs)
          : new Response('{}', { status: githubStatus }),
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
  });

  it('checks the Access token, then files the issue', async () => {
    const response = await handleFeedback(post(SUBMISSION, await accessToken()), env);
    expect(response.status).toBe(201);
    expect(githubCalls().map(([url]) => url)).toEqual([
      'https://api.github.com/repos/owner/repo/issues',
    ]);
  });

  it("never passes on who sent it (Access's email header and token)", async () => {
    await handleFeedback(post(SUBMISSION, await accessToken()), env);
    expect(JSON.stringify(githubCalls())).not.toContain('rep@example.com');
  });

  it("doesn't reach GitHub without a valid Access token", async () => {
    const { privateKey: otherKey } = await generateKeyPair('RS256');
    const tokens = [
      undefined,
      'not-a-token',
      await accessToken({ key: otherKey }),
      await accessToken({ aud: 'another-app' }),
      await accessToken({ iss: 'https://other.cloudflareaccess.com' }),
    ];
    for (const token of tokens) {
      expect((await handleFeedback(post(SUBMISSION, token), env)).status).toBe(403);
    }
    expect(githubCalls()).toHaveLength(0);
  });

  it('stays closed when the Access settings are missing', async () => {
    const token = await accessToken();
    const noAud = { ...env, ACCESS_AUD: '' };
    expect((await handleFeedback(post(SUBMISSION, token), noAud)).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('turns away a bad body or method without reaching GitHub', async () => {
    const token = await accessToken();
    expect((await handleFeedback(post('not json', token), env)).status).toBe(400);
    expect((await handleFeedback(post({ kind: 'problem' }, token), env)).status).toBe(400);
    const get = new Request('https://example.com/api/feedback');
    expect((await handleFeedback(get, env)).status).toBe(405);
    expect(githubCalls()).toHaveLength(0);
  });

  it('reports a GitHub failure as a bad gateway', async () => {
    githubStatus = 401;
    expect((await handleFeedback(post(SUBMISSION, await accessToken()), env)).status).toBe(502);
  });
});
