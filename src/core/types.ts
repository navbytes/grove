import { homedir } from 'node:os';
import { join } from 'node:path';

// --- Enums / Union Types ---

export type TaskStatus = 'active' | 'archived';

export type LinkCategory =
  | 'slack'
  | 'buildkite'
  | 'github'
  | 'jira'
  | 'confluence'
  | 'figma'
  | 'notion'
  | 'google-docs'
  | 'misc';

// --- Config ---

export interface JiraConfig {
  baseUrl: string;
  email: string;
}

export interface GitConfig {
  provider: 'github';
  baseUrl: string;
  org: string;
}

export interface CiConfig {
  provider: 'github-actions';
}

export interface NotificationConfig {
  prApproved: boolean;
  ciFailed: boolean;
  prMerged: boolean;
}

export interface GroveConfig {
  workspaceDir: string;
  branchPrefix: string;
  branchTemplate: string;
  defaultBaseBranch: string;
  pollingInterval: number;
  jira?: JiraConfig;
  git?: GitConfig;
  ci?: CiConfig;
  notifications: NotificationConfig;
}

// --- Projects ---

export interface WorktreeSetupCopyEntry {
  source: string;
  destination?: string;
  mode: 'copy' | 'symlink';
}

export interface WorktreeSetup {
  copyFiles?: WorktreeSetupCopyEntry[];
  postCreateCommands?: string[];
}

export interface Project {
  name: string;
  path: string;
  defaultBaseBranch: string;
  worktreeSetup?: WorktreeSetup;
}

// --- Tasks ---

export interface TaskLink {
  label: string;
  url: string;
  category: LinkCategory;
}

export interface TaskProjectPR {
  number: number;
  url: string;
  status: 'open' | 'closed' | 'merged';
  reviewStatus: 'pending' | 'approved' | 'changes_requested' | 'none';
  ciStatus: 'pending' | 'passed' | 'failed' | 'none';
}

export interface TaskProject {
  name: string;
  repoPath: string;
  worktreePath: string;
  branch: string;
  baseBranch: string;
  pr: TaskProjectPR | null;
}

export interface Task {
  id: string;
  title: string;
  jiraUrl: string;
  jiraTickets: string[];
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
  projects: TaskProject[];
  links: TaskLink[];
  notes: string;
}

// --- Operation Results ---

export interface OperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// --- Worktree ---

export interface WorktreeInfo {
  path: string;
  branch: string;
  head: string;
}

// --- Constants ---

export const GROVE_DIR = join(homedir(), '.grove');
export const CONFIG_FILE = join(GROVE_DIR, 'config.json');
export const PROJECTS_FILE = join(GROVE_DIR, 'projects.json');
export const TASKS_FILE = join(GROVE_DIR, 'tasks.json');
export const CONTEXT_FILENAME = '.grove-context.md';

export const DEFAULT_CONFIG: GroveConfig = {
  workspaceDir: join(homedir(), 'grove-workspaces'),
  branchPrefix: '',
  branchTemplate: '{ticketId}-{slug}',
  defaultBaseBranch: 'main',
  pollingInterval: 300,
  notifications: {
    prApproved: true,
    ciFailed: true,
    prMerged: true,
  },
};
