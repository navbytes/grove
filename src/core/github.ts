/**
 * GitHub API client for Grove
 */

import {
  PRCreateOptions,
  PRStatus,
  ReviewStatus,
  CIStatus,
  OperationResult,
} from './types';
import {
  GitProviderClient,
  PRDetails,
  CICheck,
  fetchWithAuth,
} from './git-provider';

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * GitHub API response types
 */
interface GitHubPR {
  number: number;
  html_url: string;
  title: string;
  state: 'open' | 'closed';
  merged: boolean;
  draft: boolean;
  updated_at: string;
  head: { ref: string };
  base: { ref: string };
}

interface GitHubReview {
  state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED' | 'PENDING' | 'DISMISSED';
}

interface GitHubCheckRun {
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  html_url: string;
}

interface GitHubCheckRunsResponse {
  total_count: number;
  check_runs: GitHubCheckRun[];
}

/**
 * GitHub provider implementation
 */
export class GitHubClient implements GitProviderClient {
  readonly name = 'github';
  private token: string = '';
  private baseUrl: string;

  constructor(baseUrl: string = GITHUB_API_BASE) {
    this.baseUrl = baseUrl;
  }

  setToken(token: string): void {
    this.token = token;
  }

  async createPR(options: PRCreateOptions): Promise<OperationResult<PRDetails>> {
    try {
      const response = await fetchWithAuth(
        `${this.baseUrl}/repos/${options.owner}/${options.repo}/pulls`,
        this.token,
        {
          method: 'POST',
          body: JSON.stringify({
            title: options.title,
            body: options.body,
            head: options.head,
            base: options.base,
            draft: options.draft || false,
          }),
        }
      );

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          success: false,
          error: `Failed to create PR: ${response.status} ${errorBody}`,
        };
      }

      const pr = (await response.json()) as GitHubPR;
      return {
        success: true,
        data: this.mapPRToDetails(pr, options.owner, options.repo),
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to create PR: ${error}`,
      };
    }
  }

  async getPR(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<OperationResult<PRDetails>> {
    try {
      const response = await fetchWithAuth(
        `${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}`,
        this.token
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to get PR: ${response.status}`,
        };
      }

      const pr = (await response.json()) as GitHubPR;
      const details = this.mapPRToDetails(pr, owner, repo);

      // Get review status
      const reviewResult = await this.getReviewStatus(owner, repo, prNumber);
      if (reviewResult.success && reviewResult.data) {
        details.reviewStatus = reviewResult.data;
      }

      // Get CI status
      const ciResult = await this.getCIStatus(owner, repo, pr.head.ref);
      if (ciResult.success && ciResult.data) {
        details.ciStatus = ciResult.data;
      }

      return { success: true, data: details };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get PR: ${error}`,
      };
    }
  }

  async findPRByBranch(
    owner: string,
    repo: string,
    branch: string
  ): Promise<OperationResult<PRDetails | null>> {
    try {
      const response = await fetchWithAuth(
        `${this.baseUrl}/repos/${owner}/${repo}/pulls?head=${owner}:${branch}&state=all`,
        this.token
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to find PR: ${response.status}`,
        };
      }

      const prs = (await response.json()) as GitHubPR[];

      if (prs.length === 0) {
        return { success: true, data: null };
      }

      // Prioritize open PRs over closed/merged ones
      // If multiple open PRs exist, take the most recent (first in list)
      const openPR = prs.find((p) => p.state === 'open');
      const pr = openPR || prs[0];
      const details = this.mapPRToDetails(pr, owner, repo);

      // Get review status
      const reviewResult = await this.getReviewStatus(owner, repo, pr.number);
      if (reviewResult.success && reviewResult.data) {
        details.reviewStatus = reviewResult.data;
      }

      // Get CI status
      const ciResult = await this.getCIStatus(owner, repo, pr.head.ref);
      if (ciResult.success && ciResult.data) {
        details.ciStatus = ciResult.data;
      }

      return { success: true, data: details };
    } catch (error) {
      return {
        success: false,
        error: `Failed to find PR: ${error}`,
      };
    }
  }

  async findAllPRsByBranch(
    owner: string,
    repo: string,
    branch: string
  ): Promise<OperationResult<PRDetails[]>> {
    try {
      const response = await fetchWithAuth(
        `${this.baseUrl}/repos/${owner}/${repo}/pulls?head=${owner}:${branch}&state=all`,
        this.token
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to find PRs: ${response.status}`,
        };
      }

      const prs = (await response.json()) as GitHubPR[];

      if (prs.length === 0) {
        return { success: true, data: [] };
      }

      // Sort: open PRs first, then by updated date (most recent first)
      const sortedPRs = prs.sort((a, b) => {
        if (a.state === 'open' && b.state !== 'open') return -1;
        if (a.state !== 'open' && b.state === 'open') return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      // Map all PRs to details (without fetching review/CI status for performance)
      const allDetails: PRDetails[] = sortedPRs.map((pr) =>
        this.mapPRToDetails(pr, owner, repo)
      );

      return { success: true, data: allDetails };
    } catch (error) {
      return {
        success: false,
        error: `Failed to find PRs: ${error}`,
      };
    }
  }

  async getReviewStatus(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<OperationResult<ReviewStatus>> {
    try {
      const response = await fetchWithAuth(
        `${this.baseUrl}/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
        this.token
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to get reviews: ${response.status}`,
        };
      }

      const reviews = (await response.json()) as GitHubReview[];

      // Determine overall review status
      // Priority: CHANGES_REQUESTED > APPROVED > COMMENTED > PENDING
      let status: ReviewStatus = 'pending';

      for (const review of reviews) {
        if (review.state === 'CHANGES_REQUESTED') {
          return { success: true, data: 'changes_requested' };
        }
        if (review.state === 'APPROVED') {
          status = 'approved';
        } else if (review.state === 'COMMENTED' && status === 'pending') {
          status = 'commented';
        }
      }

      return { success: true, data: status };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get review status: ${error}`,
      };
    }
  }

  async getCIStatus(
    owner: string,
    repo: string,
    ref: string
  ): Promise<OperationResult<CIStatus>> {
    try {
      const response = await fetchWithAuth(
        `${this.baseUrl}/repos/${owner}/${repo}/commits/${ref}/check-runs`,
        this.token
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to get CI status: ${response.status}`,
        };
      }

      const data = (await response.json()) as GitHubCheckRunsResponse;

      if (data.total_count === 0) {
        return { success: true, data: 'pending' };
      }

      // Determine overall CI status
      let hasRunning = false;
      let hasFailed = false;
      let hasCancelled = false;

      for (const check of data.check_runs) {
        if (check.status !== 'completed') {
          hasRunning = true;
          continue;
        }

        switch (check.conclusion) {
          case 'failure':
          case 'timed_out':
            hasFailed = true;
            break;
          case 'cancelled':
            hasCancelled = true;
            break;
        }
      }

      if (hasRunning) {
        return { success: true, data: 'running' };
      }
      if (hasFailed) {
        return { success: true, data: 'failed' };
      }
      if (hasCancelled) {
        return { success: true, data: 'cancelled' };
      }

      return { success: true, data: 'passed' };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get CI status: ${error}`,
      };
    }
  }

  async getCIChecks(
    owner: string,
    repo: string,
    ref: string
  ): Promise<OperationResult<CICheck[]>> {
    try {
      const response = await fetchWithAuth(
        `${this.baseUrl}/repos/${owner}/${repo}/commits/${ref}/check-runs`,
        this.token
      );

      if (!response.ok) {
        return {
          success: false,
          error: `Failed to get CI checks: ${response.status}`,
        };
      }

      const data = (await response.json()) as GitHubCheckRunsResponse;

      const checks: CICheck[] = data.check_runs.map((check) => ({
        name: check.name,
        status: this.mapCheckStatus(check.status, check.conclusion),
        url: check.html_url,
        conclusion: check.conclusion || undefined,
      }));

      return { success: true, data: checks };
    } catch (error) {
      return {
        success: false,
        error: `Failed to get CI checks: ${error}`,
      };
    }
  }

  getPRUrl(owner: string, repo: string, prNumber: number): string {
    // Use github.com for PR URLs, not the API base
    return `https://github.com/${owner}/${repo}/pull/${prNumber}`;
  }

  getCIUrl(owner: string, repo: string, ref: string): string {
    return `https://github.com/${owner}/${repo}/actions?query=branch:${ref}`;
  }

  private mapPRToDetails(pr: GitHubPR, owner: string, repo: string): PRDetails {
    let status: PRStatus;
    if (pr.merged) {
      status = 'merged';
    } else if (pr.draft) {
      status = 'draft';
    } else if (pr.state === 'closed') {
      status = 'closed';
    } else {
      status = 'open';
    }

    return {
      number: pr.number,
      url: pr.html_url,
      title: pr.title,
      status,
      reviewStatus: 'pending',
      ciStatus: 'pending',
      updatedAt: pr.updated_at,
      headBranch: pr.head.ref,
      baseBranch: pr.base.ref,
    };
  }

  private mapCheckStatus(
    status: string,
    conclusion: string | null
  ): CIStatus {
    if (status !== 'completed') {
      return 'running';
    }

    switch (conclusion) {
      case 'success':
        return 'passed';
      case 'failure':
      case 'timed_out':
        return 'failed';
      case 'cancelled':
        return 'cancelled';
      default:
        return 'pending';
    }
  }
}

/**
 * Create a GitHub client instance
 */
export function createGitHubClient(baseUrl?: string): GitHubClient {
  return new GitHubClient(baseUrl);
}
