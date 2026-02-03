# Integrations Knowledge

> **Auto-update trigger**: Update this file when modifying `src/core/github.ts`, `src/core/jira.ts`, or `src/core/git-provider.ts`.

## Overview

External API integrations are in `src/core/`. They have zero VS Code dependencies.

| File | Purpose |
|------|---------|
| `git-provider.ts` | Abstract interface for Git providers |
| `github.ts` | GitHub API implementation |
| `jira.ts` | Jira API client |

## GitHub Integration (github.ts)

### GitHubClient Class

```typescript
class GitHubClient implements GitProviderClient {
  setToken(token: string): void

  // PR Operations
  createPR(options: PRCreateOptions): Promise<OperationResult<PRDetails>>
  getPR(owner, repo, prNumber): Promise<OperationResult<PRDetails>>
  findPRByBranch(owner, repo, branch): Promise<OperationResult<PRDetails | null>>

  // Status Operations
  getReviewStatus(owner, repo, prNumber): Promise<OperationResult<ReviewStatus>>
  getCIStatus(owner, repo, ref): Promise<OperationResult<CIStatus>>
  getCIChecks(owner, repo, ref): Promise<OperationResult<CICheck[]>>

  // URL Helpers
  getPRUrl(owner, repo, prNumber): string
  getCIUrl(owner, repo, ref): string
}

// Factory function
createGitHubClient(baseUrl?: string): GitHubClient
```

### Usage

```typescript
import { createGitHubClient } from '../core/github';

const client = createGitHubClient();
client.setToken(token); // From VS Code SecretStorage

// Create PR
const result = await client.createPR({
  owner: 'org',
  repo: 'repo',
  title: 'PROJ-123: Add feature',
  body: 'Description...',
  head: 'feature-branch',
  base: 'main',
  draft: false,
});

// Get PR with full status
const pr = await client.getPR('org', 'repo', 123);
// pr.data includes: status, reviewStatus, ciStatus
```

### API Endpoints Used

| Operation | Endpoint |
|-----------|----------|
| Create PR | `POST /repos/{owner}/{repo}/pulls` |
| Get PR | `GET /repos/{owner}/{repo}/pulls/{number}` |
| Find PR by branch | `GET /repos/{owner}/{repo}/pulls?head=...` |
| Get reviews | `GET /repos/{owner}/{repo}/pulls/{number}/reviews` |
| Get CI checks | `GET /repos/{owner}/{repo}/commits/{ref}/check-runs` |

### Review Status Logic

Priority order (highest wins):
1. `CHANGES_REQUESTED` → `changes_requested`
2. `APPROVED` → `approved`
3. `COMMENTED` → `commented`
4. Default → `pending`

### CI Status Logic

```
If any check is running → 'running'
If any check failed/timed_out → 'failed'
If any check cancelled → 'cancelled'
Otherwise → 'passed'
```

## Jira Integration (jira.ts)

### JiraClient Class

```typescript
interface JiraClientConfig {
  baseUrl: string;    // e.g., "https://company.atlassian.net"
  email: string;      // User email
  apiToken: string;   // API token (from SecretStorage)
}

class JiraClient {
  constructor(config: JiraClientConfig)

  getTicket(ticketId: string): Promise<OperationResult<JiraTicket>>
  getTickets(ticketIds: string[]): Promise<OperationResult<JiraTicket[]>>
  searchTickets(jql: string, maxResults?: number): Promise<OperationResult<JiraTicket[]>>
  testConnection(): Promise<OperationResult<boolean>>
  getTicketUrl(ticketKey: string): string
}

// Factory function
createJiraClient(config: JiraClientConfig): JiraClient
```

### Usage

```typescript
import { createJiraClient } from '../core/jira';

const client = createJiraClient({
  baseUrl: config.jira.baseUrl,
  email: config.jira.email,
  apiToken: token, // From VS Code SecretStorage
});

// Fetch ticket info
const result = await client.getTicket('PROJ-123');
// result.data: { id, key, summary, status, url }

// Search tickets
const results = await client.searchTickets('project = PROJ AND status = "In Progress"');
```

### API Endpoints Used

| Operation | Endpoint |
|-----------|----------|
| Get ticket | `GET /rest/api/3/issue/{key}` |
| Search | `GET /rest/api/3/search?jql=...` |
| Test connection | `GET /rest/api/3/myself` |

### Authentication

Jira uses Basic Auth with email:apiToken:
```typescript
const credentials = Buffer.from(`${email}:${apiToken}`).toString('base64');
headers.set('Authorization', `Basic ${credentials}`);
```

## Git Provider Interface (git-provider.ts)

Abstract interface for Git hosting providers:

```typescript
interface GitProviderClient {
  readonly name: string;
  setToken(token: string): void;
  createPR(options: PRCreateOptions): Promise<OperationResult<PRDetails>>;
  getPR(owner, repo, prNumber): Promise<OperationResult<PRDetails>>;
  findPRByBranch(owner, repo, branch): Promise<OperationResult<PRDetails | null>>;
  getReviewStatus(owner, repo, prNumber): Promise<OperationResult<ReviewStatus>>;
  getCIStatus(owner, repo, ref): Promise<OperationResult<CIStatus>>;
  getCIChecks(owner, repo, ref): Promise<OperationResult<CICheck[]>>;
  getPRUrl(owner, repo, prNumber): string;
  getCIUrl(owner, repo, ref): string;
}

interface PRDetails {
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

// Helper to convert PRDetails to PRInfo (for storage)
function prDetailsToInfo(details: PRDetails): PRInfo
```

## Token Storage

Tokens are stored in VS Code's SecretStorage, not in config files:

```typescript
// Keys defined in types.ts
const SECRET_KEYS = {
  JIRA_API_TOKEN: 'grove.jira.apiToken',
  GIT_API_TOKEN: 'grove.git.apiToken',
};

// Write token
await context.secrets.store(SECRET_KEYS.GIT_API_TOKEN, token);

// Read token
const token = await context.secrets.get(SECRET_KEYS.GIT_API_TOKEN);
```

## Adding a New Git Provider (e.g., GitLab)

1. Create `src/core/gitlab.ts`
2. Implement `GitProviderClient` interface
3. Map provider-specific API responses to `PRDetails`
4. Export factory function: `createGitLabClient()`
5. Update setup wizard in `setup.ts` to handle provider selection
6. Update polling in `polling.ts` to use correct client

---
*Last updated: 2026-02-03*
