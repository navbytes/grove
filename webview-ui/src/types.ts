// Types shared between extension and webview
// These must match the types in src/core/types.ts

export type TaskStatus = 'active' | 'archived' | 'completed';
export type PRStatus = 'open' | 'closed' | 'merged' | 'draft';
export type ReviewStatus = 'pending' | 'approved' | 'changes_requested' | 'commented';
export type CIStatus = 'pending' | 'running' | 'passed' | 'failed' | 'cancelled';

export interface SlackThread {
  url: string;
  title?: string;
  addedAt: string;
}

export type LinkType = 'confluence' | 'notion' | 'google-docs' | 'figma' | 'other';

export interface TaskLink {
  url: string;
  title?: string;
  type: LinkType;
  addedAt: string;
}

export interface PRInfo {
  number: number;
  url: string;
  status: PRStatus;
  reviewStatus: ReviewStatus;
  ciStatus: CIStatus;
  title?: string;
  updatedAt?: string;
}

export interface TaskProject {
  name: string;
  repoPath: string;
  worktreePath: string;
  branch: string;
  baseBranch: string;
  prs: PRInfo[];
}

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
  slackThreads: SlackThread[];
  links?: TaskLink[]; // Optional for backward compatibility
}

export interface DashboardData {
  tasks: Task[];
  currentTaskId?: string;
}

// Message types for extension <-> webview communication
export type MessageToWebview =
  | { type: 'update'; data: DashboardData }
  | { type: 'loading'; loading: boolean };

export type MessageToExtension =
  | { type: 'openTask'; taskId: string }
  | { type: 'archiveTask'; taskId: string }
  | { type: 'deleteTask'; taskId: string }
  | { type: 'newTask' }
  | { type: 'openJira'; taskId: string }
  | { type: 'openPR'; taskId: string; projectName: string }
  | { type: 'openCI'; taskId: string; projectName: string }
  | { type: 'openSlack'; url: string }
  | { type: 'openLink'; url: string }
  | { type: 'createPR'; taskId: string; projectName: string }
  | { type: 'linkPR'; taskId: string; projectName: string }
  | { type: 'refresh' }
  | { type: 'ready' };

// ============================================
// Setup Types
// ============================================

export type GitProvider = 'github' | 'gitlab' | 'bitbucket';

export interface SetupConfig {
  workspaceDir: string;
  branchTemplate: string;
  jira?: {
    baseUrl: string;
    email: string;
  };
  git?: {
    provider: GitProvider;
    baseUrl: string;
    org: string;
  };
}

export interface SetupData {
  config: SetupConfig;
  gitToken?: string;
  jiraToken?: string;
}

export interface ConnectionTestResult {
  success: boolean;
  error?: string;
}

// Messages from webview to extension (Setup)
export type SetupMessageToExtension =
  | { type: 'ready' }
  | { type: 'save'; data: SetupData }
  | { type: 'testJira'; baseUrl: string; email: string; token: string }
  | { type: 'testGit'; provider: GitProvider; baseUrl: string; org: string; token: string }
  | { type: 'skip' }
  | { type: 'openExternal'; url: string }
  | { type: 'browseFolder' };

// Messages from extension to webview (Setup)
export type SetupMessageToWebview =
  | { type: 'init'; config?: SetupConfig }
  | { type: 'jiraTestResult'; result: ConnectionTestResult }
  | { type: 'gitTestResult'; result: ConnectionTestResult }
  | { type: 'folderSelected'; path: string }
  | { type: 'saved' }
  | { type: 'error'; message: string };

// Combined state for webview
export interface WebviewState {
  mode: 'dashboard' | 'setup';
  dashboardData?: DashboardData;
  setupConfig?: SetupConfig;
}

// VS Code API type
declare global {
  function acquireVsCodeApi(): {
    postMessage(message: MessageToExtension | SetupMessageToExtension): void;
    getState(): WebviewState | undefined;
    setState(state: WebviewState): void;
  };
}
