# Data Models & Types

> **Auto-update trigger**: Update this file when modifying `src/core/types.ts`.

## Location

All types defined in `src/core/types.ts`

## Core Types

### Task (Primary data model)

```typescript
interface Task {
  id: string;                    // Jira ticket ID (e.g., "PROJ-123")
  title: string;                 // Task description
  jiraUrl?: string;              // Linked Jira URL
  jiraTickets: string[];         // Multiple ticket IDs
  status: TaskStatus;            // 'active' | 'archived' | 'completed'
  createdAt: string;             // ISO timestamp
  updatedAt: string;             // ISO timestamp
  projects: TaskProject[];       // Worktrees in this task
  workspaceFile: string;         // Path to .code-workspace file
  notes: string;                 // User notes (preserved across updates)
  slackThreads: SlackThread[];   // Linked Slack discussions
  links: TaskLink[];             // Generic links (Confluence, Notion, etc.)
}
```

### TaskProject (Worktree in a task)

```typescript
interface TaskProject {
  name: string;           // Project name (e.g., "backend")
  repoPath: string;       // Original repo path
  worktreePath: string;   // Worktree location
  branch: string;         // Feature branch name
  baseBranch: string;     // Base branch (main/develop)
  pr: PRInfo | null;      // PR tracking info
}
```

### Project (Registered repository)

```typescript
interface Project {
  name: string;              // Display name
  path: string;              // Repo path (supports ~/)
  defaultBaseBranch: string; // main or develop
  remoteUrl?: string;        // Git remote URL
}
```

### PRInfo (Pull request tracking)

```typescript
interface PRInfo {
  number: number;
  url: string;
  status: PRStatus;         // 'open' | 'closed' | 'merged' | 'draft'
  reviewStatus: ReviewStatus; // 'pending' | 'approved' | 'changes_requested' | 'commented'
  ciStatus: CIStatus;       // 'pending' | 'running' | 'passed' | 'failed' | 'cancelled'
  title?: string;
  updatedAt?: string;
}
```

### GroveConfig (Global configuration)

```typescript
interface GroveConfig {
  workspaceDir: string;         // Where tasks are created (default: ~/grove-workspaces)
  jira?: JiraConfig;            // Optional Jira config
  git?: GitConfig;              // Optional Git provider config
  ci?: CIConfig;                // Optional CI config
  branchPrefix: string;         // Prefix for branches
  branchTemplate: string;       // Template: "{ticketId}-{slug}"
  defaultBaseBranch: string;    // "main" or "develop"
  pollingInterval: number;      // Seconds between status checks (default: 300)
}

interface JiraConfig {
  baseUrl: string;   // e.g., "https://company.atlassian.net"
  email: string;     // User email for API
  // apiToken stored in VS Code SecretStorage
}

interface GitConfig {
  provider: GitProvider;  // 'github' | 'gitlab' | 'bitbucket'
  baseUrl: string;        // API base URL
  org: string;            // Organization/owner
  // apiToken stored in VS Code SecretStorage
}
```

### SlackThread & TaskLink

```typescript
interface SlackThread {
  url: string;
  title?: string;
  addedAt: string;  // ISO timestamp
}

interface TaskLink {
  url: string;
  title?: string;
  type: LinkType;   // 'confluence' | 'notion' | 'google-docs' | 'figma' | 'other'
  addedAt: string;
}
```

## Status Types

```typescript
type TaskStatus = 'active' | 'archived' | 'completed';
type PRStatus = 'open' | 'closed' | 'merged' | 'draft';
type ReviewStatus = 'pending' | 'approved' | 'changes_requested' | 'commented';
type CIStatus = 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';
type GitProvider = 'github' | 'gitlab' | 'bitbucket';
type CIProvider = 'github-actions' | 'gitlab-ci' | 'jenkins' | 'circleci';
type LinkType = 'confluence' | 'notion' | 'google-docs' | 'figma' | 'other';
```

## Result Type Pattern

```typescript
interface OperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}
```

Used consistently across all operations for error handling.

## Constants

```typescript
const SECRET_KEYS = {
  JIRA_API_TOKEN: 'grove.jira.apiToken',
  GIT_API_TOKEN: 'grove.git.apiToken',
} as const;

const GROVE_PATHS = {
  CONFIG_DIR: '.grove',
  CONFIG_FILE: 'config.json',
  PROJECTS_FILE: 'projects.json',
  TASKS_FILE: 'tasks.json',
  CONTEXT_FILE: '.grove-context.md',
} as const;

const DEFAULT_CONFIG: GroveConfig = {
  workspaceDir: '~/grove-workspaces',
  branchPrefix: '',
  branchTemplate: '{ticketId}-{slug}',
  defaultBaseBranch: 'main',
  pollingInterval: 300,
};
```

## Option Interfaces

```typescript
interface WorktreeCreateOptions {
  repoPath: string;
  worktreePath: string;
  branch: string;
  baseBranch: string;
  createBranch?: boolean;
}

interface PRCreateOptions {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;  // Feature branch
  base: string;  // Target branch
  draft?: boolean;
}
```

## Common Modifications

### Adding a new task field

1. Add to `Task` interface
2. Update `createTask()` in `tasks.ts` to initialize
3. Update `generateContextFile()` in `context.ts` if needed

### Adding a new status type

1. Add to relevant union type (e.g., `TaskStatus`)
2. Update UI rendering in `sidebar.ts`
3. Update filtering logic in `store.ts` if needed

### Adding a new link type

1. Add to `LinkType` union
2. Update `detectLinkType()` in `tasks.ts`
3. Update sidebar icon in `sidebar.ts`

---
*Last updated: 2026-02-03*
