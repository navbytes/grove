/**
 * Core types and interfaces for Grove
 * This module has no VS Code dependencies
 */

// Git Provider Types
export type GitProvider = 'github' | 'gitlab' | 'bitbucket';
export type CIProvider = 'github-actions' | 'gitlab-ci' | 'jenkins' | 'circleci';

// PR Status
export type PRStatus = 'open' | 'closed' | 'merged' | 'draft';
export type ReviewStatus = 'pending' | 'approved' | 'changes_requested' | 'commented';
export type CIStatus = 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';

// Task Status
export type TaskStatus = 'active' | 'archived' | 'completed';

/**
 * Global configuration stored at ~/.grove/config.json
 * Note: API tokens are stored separately in secure storage
 */
export interface GroveConfig {
  workspaceDir: string;
  jira?: JiraConfig;
  git?: GitConfig;
  ci?: CIConfig;
  branchPrefix: string;
  branchTemplate: string;
  defaultBaseBranch: string;
  pollingInterval: number; // in seconds
}

export interface JiraConfig {
  baseUrl: string;
  email: string;
  // apiToken stored in SecretStorage, not here
}

export interface GitConfig {
  provider: GitProvider;
  baseUrl: string;
  org: string;
  // apiToken stored in SecretStorage, not here
}

export interface CIConfig {
  provider: CIProvider;
}

/**
 * A registered git repository
 */
export interface Project {
  name: string;
  path: string;
  defaultBaseBranch: string;
  // Optional: remote URL for the repo
  remoteUrl?: string;
}

/**
 * PR information for a project within a task
 */
export interface PRInfo {
  number: number;
  url: string;
  status: PRStatus;
  reviewStatus: ReviewStatus;
  ciStatus: CIStatus;
  title?: string;
  updatedAt?: string;
}

/**
 * A project instance within a task (with worktree info)
 */
export interface TaskProject {
  name: string;
  repoPath: string;
  worktreePath: string;
  branch: string;
  baseBranch: string;
  pr: PRInfo | null;
}

/**
 * Slack thread link associated with a task
 */
export interface SlackThread {
  url: string;
  title?: string; // Optional user-provided title/description
  addedAt: string;
}

/**
 * Link type for categorizing external links
 */
export type LinkType = 'confluence' | 'notion' | 'google-docs' | 'figma' | 'other';

/**
 * Generic link associated with a task (Confluence, Notion, Google Docs, etc.)
 */
export interface TaskLink {
  url: string;
  title?: string; // Optional user-provided title/description
  type: LinkType; // Type of link for icon/display purposes
  addedAt: string;
}

/**
 * A task representing a unit of work
 */
export interface Task {
  id: string;
  title: string;
  jiraUrl?: string;
  jiraTickets: string[];
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  projects: TaskProject[];
  workspaceFile: string;
  notes: string;
  slackThreads: SlackThread[]; // Slack threads associated with this task
  links: TaskLink[]; // Generic links (Confluence, Notion, etc.) associated with this task
}

/**
 * VS Code workspace file structure
 */
export interface WorkspaceFile {
  folders: WorkspaceFolder[];
  settings: Record<string, unknown>;
}

export interface WorkspaceFolder {
  name: string;
  path: string;
}

/**
 * Jira ticket information
 */
export interface JiraTicket {
  id: string;
  key: string;
  summary: string;
  status: string;
  url: string;
}

/**
 * Result types for operations
 */
export interface OperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Worktree creation options
 */
export interface WorktreeCreateOptions {
  repoPath: string;
  worktreePath: string;
  branch: string;
  baseBranch: string;
  createBranch?: boolean;
}

/**
 * PR creation options
 */
export interface PRCreateOptions {
  owner: string;
  repo: string;
  title: string;
  body: string;
  head: string;
  base: string;
  draft?: boolean;
}

/**
 * Branch template variables
 */
export interface BranchTemplateVars {
  ticketId: string;
  slug: string;
  title: string;
}

/**
 * Secret storage keys
 */
export const SECRET_KEYS = {
  JIRA_API_TOKEN: 'grove.jira.apiToken',
  GIT_API_TOKEN: 'grove.git.apiToken',
} as const;

/**
 * File paths for Grove data
 */
export const GROVE_PATHS = {
  CONFIG_DIR: '.grove',
  CONFIG_FILE: 'config.json',
  PROJECTS_FILE: 'projects.json',
  TASKS_FILE: 'tasks.json',
  CONTEXT_FILE: '.grove-context.md',
} as const;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: GroveConfig = {
  workspaceDir: '~/grove-workspaces',
  branchPrefix: '',
  branchTemplate: '{ticketId}-{slug}',
  defaultBaseBranch: 'main',
  pollingInterval: 300,
};
