/**
 * Git provider abstraction for Grove
 * Defines the interface for different git hosting providers (GitHub, GitLab, Bitbucket)
 */

import {
  PRInfo,
  PRCreateOptions,
  PRStatus,
  ReviewStatus,
  CIStatus,
  OperationResult,
} from './types';

/**
 * PR details returned from provider
 */
export interface PRDetails {
  number: number;
  url: string;
  title: string;
  status: PRStatus;
  reviewStatus: ReviewStatus;
  ciStatus: CIStatus;
  updatedAt: string;
  headBranch: string;
  baseBranch: string;
}

/**
 * CI check/run details
 */
export interface CICheck {
  name: string;
  status: CIStatus;
  url?: string;
  conclusion?: string;
}

/**
 * Interface for git hosting providers
 */
export interface GitProviderClient {
  /**
   * Get the provider name
   */
  readonly name: string;

  /**
   * Set the API token for authentication
   */
  setToken(token: string): void;

  /**
   * Create a pull request
   */
  createPR(options: PRCreateOptions): Promise<OperationResult<PRDetails>>;

  /**
   * Get PR by number
   */
  getPR(owner: string, repo: string, prNumber: number): Promise<OperationResult<PRDetails>>;

  /**
   * Find PR by branch name
   */
  findPRByBranch(
    owner: string,
    repo: string,
    branch: string
  ): Promise<OperationResult<PRDetails | null>>;

  /**
   * Get review status for a PR
   */
  getReviewStatus(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<OperationResult<ReviewStatus>>;

  /**
   * Get CI status for a commit/branch
   */
  getCIStatus(
    owner: string,
    repo: string,
    ref: string
  ): Promise<OperationResult<CIStatus>>;

  /**
   * Get detailed CI checks
   */
  getCIChecks(
    owner: string,
    repo: string,
    ref: string
  ): Promise<OperationResult<CICheck[]>>;

  /**
   * Get the URL for a PR
   */
  getPRUrl(owner: string, repo: string, prNumber: number): string;

  /**
   * Get the URL for CI checks
   */
  getCIUrl(owner: string, repo: string, ref: string): string;
}

/**
 * Convert PRDetails to PRInfo
 */
export function prDetailsToInfo(details: PRDetails): PRInfo {
  return {
    number: details.number,
    url: details.url,
    status: details.status,
    reviewStatus: details.reviewStatus,
    ciStatus: details.ciStatus,
    title: details.title,
    updatedAt: details.updatedAt,
  };
}

/**
 * Make an HTTP request with proper error handling
 */
export async function fetchWithAuth(
  url: string,
  token: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);
  headers.set('Authorization', `Bearer ${token}`);
  headers.set('Accept', 'application/json');

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  return fetch(url, {
    ...options,
    headers,
  });
}
