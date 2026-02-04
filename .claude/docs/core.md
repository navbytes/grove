# Core Module Knowledge

> **Auto-update trigger**: Update this file when modifying any file in `src/core/` except `types.ts`, `github.ts`, `jira.ts`, or `git-provider.ts`.

## Overview

The `src/core/` directory contains pure TypeScript business logic with **zero VS Code dependencies**. This makes it testable and reusable.

## Module Map

| File | Purpose | Key Exports |
|------|---------|-------------|
| `config.ts` | Config file management (~/.grove/) | `readConfig`, `writeConfig`, `getTaskDir`, `generateBranchName` |
| `store.ts` | Task persistence (tasks.json) | `readTasks`, `getTask`, `addTask`, `updateTask`, `deleteTask` |
| `projects.ts` | Project registry management | `readProjects`, `registerProject`, `getProject`, `updateProject`, `detectDefaultBranch` |
| `tasks.ts` | High-level task operations | `createTask`, `addProjectToTask`, `archiveTask`, `addSlackThread`, `addLink` |
| `worktree.ts` | Git worktree CLI wrapper | `createWorktree`, `removeWorktree`, `pushBranch`, `execGit` |
| `worktree-setup.ts` | Worktree post-creation setup | `executeWorktreeSetup`, `readRepoSetup`, `hasWorktreeSetup` |
| `workspace.ts` | VS Code workspace file generation | `generateWorkspaceFile`, `getWorkspaceFilePath` |
| `context.ts` | .grove-context.md generation | `generateContextFile`, `preserveNotes` |

## Data Flow

```
User Action → tasks.ts → store.ts → ~/.grove/tasks.json
                ↓
           worktree.ts → git CLI
                ↓
           workspace.ts → .code-workspace file
                ↓
           context.ts → .grove-context.md file
```

## Key Functions

### config.ts (src/core/config.ts)

```typescript
// Get config directory: ~/.grove/
getGroveDir(): string

// Read config with defaults merged
readConfig(): OperationResult<GroveConfig>

// Write config
writeConfig(config: GroveConfig): OperationResult

// Get task workspace directory: ~/grove-workspaces/{taskId}/
getTaskDir(taskId: string): string

// Generate branch name from template
generateBranchName(template: string, ticketId: string, title: string): string
// Example: "{ticketId}-{slug}" + "PROJ-123" + "Add login" → "PROJ-123-add-login"

// Expand ~ to home directory
expandPath(filepath: string): string
```

### store.ts (src/core/store.ts)

Low-level CRUD for `~/.grove/tasks.json`:

```typescript
readTasks(): OperationResult<Task[]>
writeTasks(tasks: Task[]): OperationResult
getTask(taskId: string): OperationResult<Task | null>
addTask(task: Task): OperationResult
updateTask(taskId: string, updates: Partial<Task>): OperationResult<Task>
deleteTask(taskId: string): OperationResult
getTasksByStatus(status: TaskStatus): OperationResult<Task[]>
getActiveTasks(): OperationResult<Task[]>
findTaskByWorkspace(workspaceFile: string): OperationResult<Task | null>
```

### tasks.ts (src/core/tasks.ts)

High-level task operations (orchestrates store, worktree, workspace, context):

```typescript
// Create task with worktrees for selected projects
createTask(options: CreateTaskOptions): Promise<OperationResult<Task>>

// Add/remove project from existing task
addProjectToTask(options: AddProjectToTaskOptions): Promise<OperationResult<Task>>
removeProjectFromTask(options: RemoveProjectFromTaskOptions): Promise<OperationResult<Task>>

// Archive task (optionally cleanup worktrees)
archiveTask(taskId: string, cleanup?: boolean): Promise<OperationResult<Task>>

// Delete task completely
deleteTaskCompletely(taskId: string): Promise<OperationResult>

// Slack thread management
addSlackThread(taskId: string, url: string, title?: string): OperationResult<Task>
removeSlackThread(taskId: string, url: string): OperationResult<Task>

// Link management (Confluence, Notion, etc.)
addLink(taskId: string, url: string, title?: string, type?: LinkType): OperationResult<Task>
removeLink(taskId: string, url: string): OperationResult<Task>
detectLinkType(url: string): LinkType  // Auto-detect from URL
```

### worktree.ts (src/core/worktree.ts)

Git CLI wrapper:

```typescript
// Execute git command
execGit(cwd: string, args: string[]): Promise<OperationResult<string>>

// Create worktree with new branch
createWorktree(options: WorktreeCreateOptions): Promise<OperationResult>

// Remove worktree
removeWorktree(repoPath: string, worktreePath: string, force?: boolean): Promise<OperationResult>

// Branch operations
checkBranchExists(repoPath: string, branch: string): Promise<OperationResult<boolean>>
getCurrentBranch(worktreePath: string): Promise<OperationResult<string>>
pushBranch(worktreePath: string, branch: string, setUpstream?: boolean): Promise<OperationResult>
isBranchPushed(repoPath: string, branch: string): Promise<OperationResult<boolean>>

// Status checks
hasUncommittedChanges(worktreePath: string): Promise<OperationResult<boolean>>
```

### worktree-setup.ts (src/core/worktree-setup.ts)

Post-creation setup for worktrees (copy files, run commands):

```typescript
// Read .grove/setup.json from repo root
readRepoSetup(repoPath: string): WorktreeSetup | null

// Merge repo-level and project-level setup
mergeSetups(repoSetup: WorktreeSetup | null, projectSetup: WorktreeSetup | undefined): WorktreeSetup

// Execute a single copy/symlink rule
executeCopyRule(rule: CopyRule, repoPath: string, worktreePath: string): OperationResult

// Execute a shell command in directory
executeCommand(command: string, cwd: string): Promise<OperationResult>

// Execute all setup rules for a project
executeWorktreeSetup(project: Project, worktreePath: string, onProgress?: (msg: string) => void): Promise<OperationResult>

// Check if project has any setup configured
hasWorktreeSetup(project: Project): boolean

// Get combined setup for display
getCombinedSetup(project: Project): WorktreeSetup
```

**Setup execution flow:**
1. Read `.grove/setup.json` from repo (if exists)
2. Merge with project's `worktreeSetup` config
3. Execute copy/symlink rules (warnings logged, continues on failure)
4. Execute post-create commands (warnings logged, continues on failure)

### projects.ts (src/core/projects.ts)

Project registry management (`~/.grove/projects.json`):

```typescript
readProjects(): OperationResult<Project[]>
writeProjects(projects: Project[]): OperationResult
getProject(name: string): OperationResult<Project | null>
registerProject(project: Project): OperationResult
removeProject(name: string): OperationResult

// Git detection
isGitRepository(repoPath: string): boolean
detectDefaultBranch(repoPath: string): Promise<OperationResult<string>>
getRemoteUrl(repoPath: string): Promise<OperationResult<string>>
extractRepoName(remoteUrl: string): string | null
extractRepoOwner(remoteUrl: string): string | null
```

## Storage Locations

```
~/.grove/
├── config.json      # GroveConfig (workspace dir, branch template, etc.)
├── projects.json    # Project[] (registered git repos)
└── tasks.json       # Task[] (all tasks)

~/grove-workspaces/  # Default workspace root (configurable)
├── PROJ-123/        # Task directory
│   ├── backend/     # Git worktree
│   ├── frontend/    # Git worktree
│   ├── PROJ-123.code-workspace
│   └── .grove-context.md
```

## Error Handling Pattern

All functions return `OperationResult<T>`:

```typescript
interface OperationResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

// Usage pattern:
const result = readConfig();
if (!result.success || !result.data) {
  return { success: false, error: result.error };
}
const config = result.data;
```

## Common Modifications

### Adding a new task field

1. Add field to `Task` interface in `types.ts`
2. Initialize field in `createTask()` in `tasks.ts`
3. Add management functions in `tasks.ts` if needed
4. Update `generateContextFile()` in `context.ts` if visible in context

### Adding a new config option

1. Add field to `GroveConfig` in `types.ts`
2. Add default value to `DEFAULT_CONFIG` in `types.ts`
3. Use in relevant functions via `readConfig()`

---
*Last updated: 2026-02-03*
