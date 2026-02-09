import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import type { JiraAuth } from '../../core/jira.js';
import { fetchJiraIssueWithAuth } from '../../core/jira.js';

const testAuth: JiraAuth = {
  baseUrl: 'https://test.atlassian.net',
  email: 'test@example.com',
  token: 'test-api-token',
};

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('fetchJiraIssueWithAuth', () => {
  test('fetches issue successfully', async () => {
    globalThis.fetch = mock(async () => {
      return new Response(
        JSON.stringify({
          key: 'TEST-100',
          fields: {
            summary: 'Implement user authentication',
            status: { name: 'In Progress' },
            issuetype: { name: 'Story' },
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }) as typeof fetch;

    const result = await fetchJiraIssueWithAuth('TEST-100', testAuth);

    expect(result.success).toBe(true);
    expect(result.data?.key).toBe('TEST-100');
    expect(result.data?.summary).toBe('Implement user authentication');
    expect(result.data?.status).toBe('In Progress');
    expect(result.data?.issueType).toBe('Story');
  });

  test('sends correct authorization header', async () => {
    let capturedHeaders: Headers | undefined;

    globalThis.fetch = mock(async (_url: string | URL | Request, init?: RequestInit) => {
      capturedHeaders = new Headers(init?.headers);
      return new Response(
        JSON.stringify({
          key: 'TEST-1',
          fields: {
            summary: 'Test',
            status: { name: 'Open' },
            issuetype: { name: 'Task' },
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    await fetchJiraIssueWithAuth('TEST-1', testAuth);

    const expectedCredentials = Buffer.from('test@example.com:test-api-token').toString('base64');
    expect(capturedHeaders?.get('Authorization')).toBe(`Basic ${expectedCredentials}`);
    expect(capturedHeaders?.get('Accept')).toBe('application/json');
  });

  test('constructs correct API URL', async () => {
    let capturedUrl = '';

    globalThis.fetch = mock(async (url: string | URL | Request) => {
      capturedUrl = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      return new Response(
        JSON.stringify({
          key: 'PROJ-42',
          fields: {
            summary: 'Test',
            status: { name: 'Open' },
            issuetype: { name: 'Bug' },
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    await fetchJiraIssueWithAuth('PROJ-42', testAuth);

    expect(capturedUrl).toBe('https://test.atlassian.net/rest/api/3/issue/PROJ-42?fields=summary,status,issuetype');
  });

  test('handles 404 response', async () => {
    globalThis.fetch = mock(async () => {
      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    const result = await fetchJiraIssueWithAuth('NONEXISTENT-999', testAuth);

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('handles 401 response', async () => {
    globalThis.fetch = mock(async () => {
      return new Response('Unauthorized', { status: 401 });
    }) as typeof fetch;

    const result = await fetchJiraIssueWithAuth('TEST-1', testAuth);

    expect(result.success).toBe(false);
    expect(result.error).toContain('authentication failed');
  });

  test('handles 500 response', async () => {
    globalThis.fetch = mock(async () => {
      return new Response('Internal Server Error', { status: 500, statusText: 'Internal Server Error' });
    }) as typeof fetch;

    const result = await fetchJiraIssueWithAuth('TEST-1', testAuth);

    expect(result.success).toBe(false);
    expect(result.error).toContain('500');
  });

  test('handles network error', async () => {
    globalThis.fetch = mock(async () => {
      throw new TypeError('fetch failed');
    }) as typeof fetch;

    const result = await fetchJiraIssueWithAuth('TEST-1', testAuth);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Could not connect to Jira');
  });

  test('handles unexpected error', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('something broke');
    }) as typeof fetch;

    const result = await fetchJiraIssueWithAuth('TEST-1', testAuth);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Jira request failed');
  });

  test('encodes special characters in issue key', async () => {
    let capturedUrl = '';

    globalThis.fetch = mock(async (url: string | URL | Request) => {
      capturedUrl = typeof url === 'string' ? url : url instanceof URL ? url.toString() : url.url;
      return new Response(
        JSON.stringify({
          key: 'TEST-1',
          fields: {
            summary: 'Test',
            status: { name: 'Open' },
            issuetype: { name: 'Task' },
          },
        }),
        { status: 200 },
      );
    }) as typeof fetch;

    await fetchJiraIssueWithAuth('TEST/KEY', testAuth);

    expect(capturedUrl).toContain('TEST%2FKEY');
  });
});

describe('JiraIssue type', () => {
  test('has required fields', () => {
    const issue: import('../../core/jira.js').JiraIssue = {
      key: 'TEST-123',
      summary: 'Test issue',
      status: 'In Progress',
      issueType: 'Story',
    };
    expect(issue.key).toBe('TEST-123');
    expect(issue.summary).toBe('Test issue');
    expect(issue.status).toBe('In Progress');
    expect(issue.issueType).toBe('Story');
  });
});

describe('JiraAuth type', () => {
  test('has required fields', () => {
    const auth: JiraAuth = {
      baseUrl: 'https://test.atlassian.net',
      email: 'user@example.com',
      token: 'secret',
    };
    expect(auth.baseUrl).toBe('https://test.atlassian.net');
    expect(auth.email).toBe('user@example.com');
    expect(auth.token).toBe('secret');
  });
});

describe('module exports', () => {
  test('exports expected functions', async () => {
    const jira = await import('../../core/jira.js');
    expect(typeof jira.fetchJiraIssue).toBe('function');
    expect(typeof jira.fetchJiraIssueWithAuth).toBe('function');
    expect(typeof jira.fetchMultipleJiraIssues).toBe('function');
    expect(typeof jira.isJiraConfigured).toBe('function');
    expect(typeof jira.getJiraAuth).toBe('function');
  });
});
