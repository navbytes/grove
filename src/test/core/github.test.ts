import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { GitHubAuth } from '../../core/github.js';
import { createPR, fetchCIStatus, fetchFullPRStatus, fetchReviewStatus, findPRByBranch } from '../../core/github.js';

const testAuth: GitHubAuth = {
  baseUrl: 'https://api.github.com',
  org: 'test-org',
  token: 'test-token',
};

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('findPRByBranch', () => {
  test('finds an open PR', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify([
          {
            number: 42,
            html_url: 'https://github.com/test-org/repo/pull/42',
            state: 'open',
            merged_at: null,
            title: 'Add feature X',
            draft: false,
          },
        ]),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await findPRByBranch('repo', 'feature-branch', testAuth);

    expect(result.success).toBe(true);
    expect(result.data?.number).toBe(42);
    expect(result.data?.state).toBe('open');
    expect(result.data?.url).toBe('https://github.com/test-org/repo/pull/42');
    expect(result.data?.draft).toBe(false);
  });

  test('detects merged PR', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify([
          {
            number: 50,
            html_url: 'https://github.com/test-org/repo/pull/50',
            state: 'closed',
            merged_at: '2026-01-15T10:00:00Z',
            title: 'Merged PR',
            draft: false,
          },
        ]),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await findPRByBranch('repo', 'merged-branch', testAuth);

    expect(result.success).toBe(true);
    expect(result.data?.state).toBe('merged');
  });

  test('returns null when no PR found', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify([]), { status: 200 });
    }) as typeof fetch;

    const result = await findPRByBranch('repo', 'no-pr-branch', testAuth);

    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  test('handles 404 repo not found', async () => {
    globalThis.fetch = mock(async () => {
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const result = await findPRByBranch('nonexistent', 'branch', testAuth);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('handles 401 auth error', async () => {
    globalThis.fetch = mock(async () => {
      return new Response('Unauthorized', { status: 401 });
    }) as typeof fetch;

    const result = await findPRByBranch('repo', 'branch', testAuth);

    expect(result.success).toBe(false);
    expect(result.error).toContain('authentication failed');
  });

  test('handles network error', async () => {
    globalThis.fetch = mock(async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;

    const result = await findPRByBranch('repo', 'branch', testAuth);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Could not connect');
  });

  test('sends correct request URL and headers', async () => {
    let capturedUrl = '';
    let capturedHeaders: Headers | undefined;

    globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
      capturedUrl = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      capturedHeaders = new Headers(init?.headers);
      return new Response(JSON.stringify([]), { status: 200 });
    }) as typeof fetch;

    await findPRByBranch('my-repo', 'feat/branch', testAuth);

    expect(capturedUrl).toBe('https://api.github.com/repos/test-org/my-repo/pulls?head=test-org:feat/branch&state=all');
    expect(capturedHeaders?.get('Authorization')).toBe('Bearer test-token');
    expect(capturedHeaders?.get('Accept')).toBe('application/vnd.github+json');
  });
});

describe('createPR', () => {
  test('creates a PR successfully', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          number: 100,
          html_url: 'https://github.com/test-org/repo/pull/100',
          state: 'open',
          title: 'TASK-1: New feature',
          draft: false,
        }),
        { status: 201 },
      );
    }) as typeof fetch;

    const result = await createPR(
      'repo',
      { title: 'TASK-1: New feature', body: 'desc', head: 'feat', base: 'main' },
      testAuth,
    );

    expect(result.success).toBe(true);
    expect(result.data?.number).toBe(100);
    expect(result.data?.state).toBe('open');
  });

  test('handles duplicate PR error', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ message: 'A pull request already exists for this branch.' }), {
        status: 422,
      });
    }) as typeof fetch;

    const result = await createPR('repo', { title: 'title', body: 'body', head: 'feat', base: 'main' }, testAuth);

    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });

  test('sends correct POST body', async () => {
    let capturedBody = '';

    globalThis.fetch = mock(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedBody = init?.body as string;
      return new Response(JSON.stringify({ number: 1, html_url: 'url', state: 'open', title: 't', draft: false }), {
        status: 201,
      });
    }) as typeof fetch;

    await createPR('repo', { title: 'My PR', body: 'Description', head: 'feat', base: 'main' }, testAuth);

    const parsed = JSON.parse(capturedBody);
    expect(parsed.title).toBe('My PR');
    expect(parsed.body).toBe('Description');
    expect(parsed.head).toBe('feat');
    expect(parsed.base).toBe('main');
  });
});

describe('fetchReviewStatus', () => {
  test('returns approved when approved review exists', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify([{ state: 'APPROVED' }]), { status: 200 });
    }) as typeof fetch;

    const result = await fetchReviewStatus('repo', 42, testAuth);
    expect(result.data).toBe('approved');
  });

  test('returns changes_requested when present', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify([{ state: 'APPROVED' }, { state: 'CHANGES_REQUESTED' }]), { status: 200 });
    }) as typeof fetch;

    const result = await fetchReviewStatus('repo', 42, testAuth);
    expect(result.data).toBe('changes_requested');
  });

  test('returns pending when no meaningful reviews', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify([{ state: 'COMMENTED' }]), { status: 200 });
    }) as typeof fetch;

    const result = await fetchReviewStatus('repo', 42, testAuth);
    expect(result.data).toBe('pending');
  });

  test('returns none on error', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('network error');
    }) as typeof fetch;

    const result = await fetchReviewStatus('repo', 42, testAuth);
    expect(result.data).toBe('none');
  });
});

describe('fetchCIStatus', () => {
  test('returns passed when all checks succeed', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          total_count: 2,
          check_runs: [
            { status: 'completed', conclusion: 'success' },
            { status: 'completed', conclusion: 'success' },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchCIStatus('repo', 'abc123', testAuth);
    expect(result.data).toBe('passed');
  });

  test('returns failed when any check fails', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          total_count: 2,
          check_runs: [
            { status: 'completed', conclusion: 'success' },
            { status: 'completed', conclusion: 'failure' },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchCIStatus('repo', 'abc123', testAuth);
    expect(result.data).toBe('failed');
  });

  test('returns pending when checks are in progress', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          total_count: 1,
          check_runs: [{ status: 'in_progress', conclusion: null }],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchCIStatus('repo', 'abc123', testAuth);
    expect(result.data).toBe('pending');
  });

  test('returns none when no checks exist', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify({ total_count: 0, check_runs: [] }), { status: 200 });
    }) as typeof fetch;

    const result = await fetchCIStatus('repo', 'abc123', testAuth);
    expect(result.data).toBe('none');
  });

  test('treats skipped and neutral as passing', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          total_count: 2,
          check_runs: [
            { status: 'completed', conclusion: 'skipped' },
            { status: 'completed', conclusion: 'neutral' },
          ],
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    const result = await fetchCIStatus('repo', 'abc123', testAuth);
    expect(result.data).toBe('passed');
  });
});

describe('fetchFullPRStatus', () => {
  test('returns null when no PR exists', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(JSON.stringify([]), { status: 200 });
    }) as typeof fetch;

    const result = await fetchFullPRStatus('repo', 'no-pr-branch', testAuth);
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  test('returns full PR status with review and CI', async () => {
    let _callCount = 0;
    globalThis.fetch = mock(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      _callCount++;

      if (urlStr.includes('/pulls?')) {
        return new Response(
          JSON.stringify([
            {
              number: 10,
              html_url: 'https://github.com/test-org/repo/pull/10',
              state: 'open',
              merged_at: null,
              title: 'PR',
              draft: false,
            },
          ]),
          { status: 200 },
        );
      }
      if (urlStr.includes('/reviews')) {
        return new Response(JSON.stringify([{ state: 'APPROVED' }]), { status: 200 });
      }
      if (urlStr.includes('/check-runs')) {
        return new Response(
          JSON.stringify({ total_count: 1, check_runs: [{ status: 'completed', conclusion: 'success' }] }),
          { status: 200 },
        );
      }
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const result = await fetchFullPRStatus('repo', 'feature', testAuth);

    expect(result.success).toBe(true);
    expect(result.data?.number).toBe(10);
    expect(result.data?.status).toBe('open');
    expect(result.data?.reviewStatus).toBe('approved');
    expect(result.data?.ciStatus).toBe('passed');
  });
});

describe('module exports', () => {
  test('exports expected functions', async () => {
    const github = await import('../../core/github.js');
    expect(typeof github.getGitHubAuth).toBe('function');
    expect(typeof github.isGitHubConfigured).toBe('function');
    expect(typeof github.findPRByBranch).toBe('function');
    expect(typeof github.createPR).toBe('function');
    expect(typeof github.fetchReviewStatus).toBe('function');
    expect(typeof github.fetchCIStatus).toBe('function');
    expect(typeof github.fetchFullPRStatus).toBe('function');
  });
});
