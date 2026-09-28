import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
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
  turnstileToken: 'XXXX.DUMMY.TOKEN.XXXX',
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
    expect(properties['turnstileToken']?.maxLength).toBe(LIMITS.turnstileToken);
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
    expect(parseSubmission({ ...SUBMISSION, turnstileToken: undefined })).toBeNull();
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
  const env: Env = {
    ASSETS: { fetch: () => Promise.resolve(new Response()) },
    GITHUB_REPO: 'owner/repo',
    GITHUB_TOKEN: 'secret-token',
    TURNSTILE_SECRET_KEY: 'turnstile-secret',
  };
  let fetchMock: Mock<typeof fetch>;

  function post(body: unknown): Request {
    return new Request('https://example.com/api/feedback', {
      method: 'POST',
      headers: { 'Cf-Access-Authenticated-User-Email': 'rep@example.com' },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    });
  }

  /** Turnstile answers first, then GitHub. */
  function respond(turnstileSuccess: boolean, githubStatus = 201): void {
    fetchMock
      .mockResolvedValueOnce(Response.json({ success: turnstileSuccess }))
      .mockResolvedValueOnce(new Response('{}', { status: githubStatus }));
  }

  beforeEach(() => {
    vi.unstubAllGlobals();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('checks the Turnstile token, then files the issue', async () => {
    respond(true);
    const response = await handleFeedback(post(SUBMISSION), env);
    expect(response.status).toBe(201);

    const [siteverifyUrl, siteverifyInit] = fetchMock.mock.calls[0];
    expect(siteverifyUrl).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify');
    expect(JSON.parse(siteverifyInit?.body as string)).toEqual({
      secret: 'turnstile-secret',
      response: SUBMISSION.turnstileToken,
    });
    expect(fetchMock.mock.calls[1][0]).toBe('https://api.github.com/repos/owner/repo/issues');
  });

  it("never passes on who sent it (Access's email header)", async () => {
    respond(true);
    await handleFeedback(post(SUBMISSION), env);
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain('rep@example.com');
  });

  it("doesn't reach GitHub when Turnstile says no", async () => {
    respond(false);
    const response = await handleFeedback(post(SUBMISSION), env);
    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('turns away a bad body or method without calling anything', async () => {
    expect((await handleFeedback(post('not json'), env)).status).toBe(400);
    expect((await handleFeedback(post({ kind: 'problem' }), env)).status).toBe(400);
    const get = new Request('https://example.com/api/feedback');
    expect((await handleFeedback(get, env)).status).toBe(405);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('reports a GitHub failure as a bad gateway', async () => {
    respond(true, 401);
    expect((await handleFeedback(post(SUBMISSION), env)).status).toBe(502);
  });
});
