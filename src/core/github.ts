import { loadConfig } from './config.js';
import { getToken } from './secrets.js';
import type { OperationResult, TaskProjectPR } from './types.js';

export interface GitHubAuth {
  baseUrl: string;
  org: string;
  token: string;
}

export interface GitHubPR {
  number: number;
  url: string;
  state: 'open' | 'closed' | 'merged';
  title: string;
  draft: boolean;
}

export interface GitHubReview {
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'DISMISSED' | 'PENDING';
}

export interface GitHubCheckRun {
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
}

export async function getGitHubAuth(): Promise<GitHubAuth | null> {
  const config = await loadConfig();
  if (!config.git?.org) {
    return null;
  }

  const token = await getToken('GROVE_GITHUB_TOKEN', 'github-api-token');
  if (!token) {
    return null;
  }

  return {
    baseUrl: 'https://api.github.com',
    org: config.git.org,
    token,
  };
}

export async function isGitHubConfigured(): Promise<boolean> {
  const auth = await getGitHubAuth();
  return auth !== null;
}

async function githubFetch(auth: GitHubAuth, path: string, opts?: RequestInit): Promise<Response> {
  return fetch(`${auth.baseUrl}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${auth.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...opts?.headers,
    },
  });
}

export async function findPRByBranch(
  repo: string,
  branch: string,
  auth: GitHubAuth,
): Promise<OperationResult<GitHubPR | null>> {
  try {
    const response = await githubFetch(auth, `/repos/${auth.org}/${repo}/pulls?head=${auth.org}:${branch}&state=all`);

    if (!response.ok) {
      if (response.status === 401) {
        return { success: false, error: 'GitHub authentication failed. Check your token with `grove init`.' };
      }
      if (response.status === 404) {
        return { success: false, error: `Repository "${auth.org}/${repo}" not found on GitHub.` };
      }
      return { success: false, error: `GitHub API error: ${response.status} ${response.statusText}` };
    }

    const prs = (await response.json()) as Array<{
      number: number;
      html_url: string;
      state: string;
      merged_at: string | null;
      title: string;
      draft: boolean;
    }>;

    if (prs.length === 0) {
      return { success: true, data: null };
    }

    const pr = prs[0] as (typeof prs)[0];
    const state: GitHubPR['state'] = pr.merged_at ? 'merged' : (pr.state as 'open' | 'closed');

    return {
      success: true,
      data: {
        number: pr.number,
        url: pr.html_url,
        state,
        title: pr.title,
        draft: pr.draft,
      },
    };
  } catch (err) {
    if (err instanceof TypeError && String(err.message).includes('fetch')) {
      return { success: false, error: 'Could not connect to GitHub. Check your network.' };
    }
    return { success: false, error: `GitHub request failed: ${err}` };
  }
}

export async function createPR(
  repo: string,
  opts: { title: string; body: string; head: string; base: string },
  auth: GitHubAuth,
): Promise<OperationResult<GitHubPR>> {
  try {
    const response = await githubFetch(auth, `/repos/${auth.org}/${repo}/pulls`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: opts.title,
        body: opts.body,
        head: opts.head,
        base: opts.base,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      if (response.status === 422) {
        if (errorBody.includes('A pull request already exists')) {
          return { success: false, error: 'A pull request already exists for this branch.' };
        }
        return { success: false, error: `GitHub validation error: ${errorBody}` };
      }
      return { success: false, error: `GitHub API error: ${response.status} ${response.statusText}` };
    }

    const pr = (await response.json()) as {
      number: number;
      html_url: string;
      state: string;
      title: string;
      draft: boolean;
    };

    return {
      success: true,
      data: {
        number: pr.number,
        url: pr.html_url,
        state: 'open',
        title: pr.title,
        draft: pr.draft,
      },
    };
  } catch (err) {
    if (err instanceof TypeError && String(err.message).includes('fetch')) {
      return { success: false, error: 'Could not connect to GitHub. Check your network.' };
    }
    return { success: false, error: `GitHub request failed: ${err}` };
  }
}

export async function fetchReviewStatus(
  repo: string,
  prNumber: number,
  auth: GitHubAuth,
): Promise<OperationResult<TaskProjectPR['reviewStatus']>> {
  try {
    const response = await githubFetch(auth, `/repos/${auth.org}/${repo}/pulls/${prNumber}/reviews`);

    if (!response.ok) {
      return { success: false, error: `GitHub API error: ${response.status}` };
    }

    const reviews = (await response.json()) as GitHubReview[];

    // Get the latest meaningful review per reviewer
    let hasApproval = false;
    let hasChangesRequested = false;

    for (const review of reviews) {
      if (review.state === 'APPROVED') hasApproval = true;
      if (review.state === 'CHANGES_REQUESTED') hasChangesRequested = true;
    }

    if (hasChangesRequested) return { success: true, data: 'changes_requested' };
    if (hasApproval) return { success: true, data: 'approved' };
    return { success: true, data: 'pending' };
  } catch {
    return { success: true, data: 'none' };
  }
}

export async function fetchCIStatus(
  repo: string,
  ref: string,
  auth: GitHubAuth,
): Promise<OperationResult<TaskProjectPR['ciStatus']>> {
  try {
    const response = await githubFetch(auth, `/repos/${auth.org}/${repo}/commits/${ref}/check-runs`);

    if (!response.ok) {
      return { success: false, error: `GitHub API error: ${response.status}` };
    }

    const data = (await response.json()) as { total_count: number; check_runs: GitHubCheckRun[] };

    if (data.total_count === 0) {
      return { success: true, data: 'none' };
    }

    const allCompleted = data.check_runs.every((cr) => cr.status === 'completed');
    if (!allCompleted) {
      return { success: true, data: 'pending' };
    }

    const allSuccess = data.check_runs.every(
      (cr) => cr.conclusion === 'success' || cr.conclusion === 'neutral' || cr.conclusion === 'skipped',
    );
    return { success: true, data: allSuccess ? 'passed' : 'failed' };
  } catch {
    return { success: true, data: 'none' };
  }
}

export async function fetchFullPRStatus(
  repo: string,
  branch: string,
  auth: GitHubAuth,
): Promise<OperationResult<TaskProjectPR | null>> {
  const prResult = await findPRByBranch(repo, branch, auth);
  if (!prResult.success) return { success: false, error: prResult.error };
  if (!prResult.data) return { success: true, data: null };

  const pr = prResult.data;

  const [reviewResult, ciResult] = await Promise.all([
    fetchReviewStatus(repo, pr.number, auth),
    fetchCIStatus(repo, branch, auth),
  ]);

  return {
    success: true,
    data: {
      number: pr.number,
      url: pr.url,
      status: pr.state,
      reviewStatus: reviewResult.data || 'none',
      ciStatus: ciResult.data || 'none',
    },
  };
}
