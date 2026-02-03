# Grove — VS Code Extension Specification

## What is Grove?

Grove is a VS Code extension that manages cross-repository task workspaces. A developer working on a single task (e.g., a Jira ticket) that touches multiple repositories can use Grove to create isolated git worktrees in each repo, group them into a single VS Code multi-root workspace, and track the status of PRs and CI pipelines — all from within VS Code.

The name "Grove" comes from the concept of grouping worktrees together, like a grove of trees.

---

## Target User & Environment

- A single developer (the author) working at a company
- Multiple git repositories: web-ui, backend API, shared libraries, infra config, etc.
- Tasks (Jira tickets) frequently span multiple repos
- Uses `git worktree` to work on multiple tasks in parallel
- Uses Claude AI via VS Code extension (Anthropic Claude extension) and via terminal (Claude Code CLI)
- Primary OS: macOS (Linux support is a bonus, Windows not required initially)

---

## Core Concepts

### Task
A unit of work tied to one or more Jira tickets. A task groups multiple repo worktrees into a single workspace.

### Project
A registered git repository that the developer works with. Projects are configured once and reused across tasks.

### Task Workspace
A VS Code multi-root `.code-workspace` file that contains all the worktrees for a given task. Opening this workspace gives the developer a dedicated VS Code window scoped to that task. The Claude VS Code extension chat/session in this workspace window is naturally dedicated to the task.

---

## Data Model

### Global Configuration

Stored at `~/.grove/config.json`:

```json
{
  "workspaceDir": "~/grove-workspaces",
  "jira": {
    "baseUrl": "https://company.atlassian.net",
    "email": "naveen@company.com",
    "apiToken": "<stored-securely-via-vscode-secret-storage>"
  },
  "git": {
    "provider": "github",
    "baseUrl": "https://github.com",
    "org": "company-org",
    "apiToken": "<stored-securely-via-vscode-secret-storage>"
  },
  "ci": {
    "provider": "github-actions"
  },
  "branchPrefix": "",
  "branchTemplate": "{ticketId}-{slug}",
  "defaultBaseBranch": "main"
}
```

Note: API tokens and secrets must be stored using VS Code's `SecretStorage` API, not in plain text config files. The config.json only stores non-sensitive settings.

### Registered Projects

Stored at `~/.grove/projects.json`:

```json
[
  {
    "name": "web-ui",
    "path": "/Users/naveen/repos/web-ui",
    "defaultBaseBranch": "main"
  },
  {
    "name": "backend-api",
    "path": "/Users/naveen/repos/backend-api",
    "defaultBaseBranch": "main"
  },
  {
    "name": "shared-types",
    "path": "/Users/naveen/repos/shared-types",
    "defaultBaseBranch": "develop"
  },
  {
    "name": "infra-config",
    "path": "/Users/naveen/repos/infra-config",
    "defaultBaseBranch": "main"
  }
]
```

### Task Data

Stored at `~/.grove/tasks.json`:

```json
[
  {
    "id": "TASK-200",
    "title": "Add user preferences API and integrate in frontend",
    "jiraUrl": "https://company.atlassian.net/browse/TASK-200",
    "jiraTickets": ["TASK-200"],
    "status": "active",
    "createdAt": "2026-02-03T10:00:00Z",
    "updatedAt": "2026-02-03T14:30:00Z",
    "projects": [
      {
        "name": "backend-api",
        "repoPath": "/Users/naveen/repos/backend-api",
        "worktreePath": "/Users/naveen/grove-workspaces/TASK-200/backend-api",
        "branch": "TASK-200-user-preferences",
        "baseBranch": "main",
        "pr": {
          "number": 145,
          "url": "https://github.com/company-org/backend-api/pull/145",
          "status": "open",
          "reviewStatus": "changes_requested",
          "ciStatus": "passed"
        }
      },
      {
        "name": "web-ui",
        "repoPath": "/Users/naveen/repos/web-ui",
        "worktreePath": "/Users/naveen/grove-workspaces/TASK-200/web-ui",
        "branch": "TASK-200-user-preferences",
        "baseBranch": "main",
        "pr": null
      }
    ],
    "workspaceFile": "/Users/naveen/grove-workspaces/TASK-200/TASK-200.code-workspace",
    "notes": ""
  }
]
```

### Generated Workspace File

At `~/grove-workspaces/TASK-200/TASK-200.code-workspace`:

```json
{
  "folders": [
    {
      "name": "backend-api (TASK-200)",
      "path": "/Users/naveen/grove-workspaces/TASK-200/backend-api"
    },
    {
      "name": "web-ui (TASK-200)",
      "path": "/Users/naveen/grove-workspaces/TASK-200/web-ui"
    }
  ],
  "settings": {
    "grove.taskId": "TASK-200"
  }
}
```

### AI Context File

Generated at `~/grove-workspaces/TASK-200/.grove-context.md`:

```markdown
# Task: TASK-200 — Add user preferences API and integrate in frontend

## Jira
- https://company.atlassian.net/browse/TASK-200

## Repositories
- backend-api (branch: TASK-200-user-preferences)
- web-ui (branch: TASK-200-user-preferences)

## PRs
- backend-api: PR #145 — https://github.com/company-org/backend-api/pull/145
- web-ui: No PR yet

## Notes
(user can add notes here)
```

This file is useful for Claude Code CLI — the developer can reference it or feed it as context when working from the terminal.

---

## Directory Structure

```
~/grove-workspaces/
├── TASK-200/
│   ├── TASK-200.code-workspace
│   ├── .grove-context.md
│   ├── backend-api/          ← git worktree
│   └── web-ui/               ← git worktree
│
├── TASK-195/
│   ├── TASK-195.code-workspace
│   ├── .grove-context.md
│   └── backend-api/          ← git worktree
│
└── TASK-210/
    ├── TASK-210.code-workspace
    ├── .grove-context.md
    └── web-ui/               ← git worktree
```

---

## Extension Architecture

### Project Structure

```
grove/
├── src/
│   ├── core/                  ← Pure TypeScript, no VS Code dependencies
│   │   ├── types.ts               (all interfaces and types)
│   │   ├── config.ts              (read/write global config)
│   │   ├── projects.ts            (manage registered projects)
│   │   ├── tasks.ts               (create, update, archive, delete tasks)
│   │   ├── worktree.ts            (git worktree create/remove operations)
│   │   ├── workspace.ts           (generate .code-workspace files)
│   │   ├── context.ts             (generate .grove-context.md files)
│   │   ├── jira.ts                (Jira REST API client)
│   │   ├── github.ts              (GitHub API client — PRs, CI status)
│   │   └── store.ts               (read/write tasks.json)
│   │
│   ├── extension/             ← VS Code specific
│   │   ├── extension.ts           (activation, command registration)
│   │   ├── commands.ts            (all command palette command handlers)
│   │   ├── sidebar.ts             (TreeDataProvider for sidebar view)
│   │   ├── statusbar.ts           (status bar item management)
│   │   ├── setup.ts               (first-run setup wizard)
│   │   └── polling.ts             (background polling for PR/CI updates)
│   │
│   └── test/                  ← Tests
│
├── package.json               (extension manifest, commands, views, config)
├── tsconfig.json
└── README.md
```

The separation of `core/` from `extension/` is intentional. The core module has zero VS Code dependencies so it can later be reused by a CLI tool or shared with other editors.

---

## Commands

All commands are available via the Command Palette (`Cmd+Shift+P`) and prefixed with `Grove:`.

### Setup & Configuration

| Command | What it does |
|---|---|
| `Grove: Setup` | First-run wizard. Prompts for Jira base URL, email, API token, GitHub org, API token, workspace directory. Stores secrets in VS Code SecretStorage, rest in config.json. |
| `Grove: Register Project` | Prompts for project name and local repo path (with folder picker). Optionally detect the default branch. Adds to projects.json. |
| `Grove: Remove Project` | Shows list of registered projects, removes selected one from projects.json. Does not affect existing tasks using this project. |
| `Grove: List Projects` | Shows all registered projects in a quick pick or in the sidebar. |
| `Grove: Edit Settings` | Opens the config.json in the editor for manual tweaking. |

### Task Management

| Command | What it does |
|---|---|
| `Grove: New Task` | Creates a new task. Flow described in detail below. |
| `Grove: Open Task` | Shows a quick pick of all active tasks. Opens the selected task's .code-workspace file in a new VS Code window. |
| `Grove: List Tasks` | Shows all tasks (active, completed) in the sidebar or as a quick pick. |
| `Grove: Archive Task` | Marks a task as archived. Optionally removes worktrees and workspace files. Prompts for confirmation. |
| `Grove: Delete Task` | Permanently removes a task, its worktrees, and workspace files. Prompts for confirmation with a warning. |

### Within a Task Workspace (available when inside a task workspace)

| Command | What it does |
|---|---|
| `Grove: Add Project` | Adds another repo to the current task. Shows unselected registered projects. Creates worktree, updates .code-workspace, updates task data. |
| `Grove: Remove Project` | Removes a repo from the current task. Removes worktree, updates .code-workspace, updates task data. Prompts for confirmation. |
| `Grove: Create PR` | Creates a PR for the currently focused project in the workspace. Pre-fills title from Jira ticket, adds Jira link to description body. Opens the PR URL in browser after creation. |
| `Grove: Open PR` | Opens the PR URL for the currently focused project in the default browser. |
| `Grove: Open Jira` | Opens the Jira ticket(s) in the default browser. |
| `Grove: Open CI` | Opens the CI pipeline/checks URL for the currently focused project. |
| `Grove: Refresh Status` | Manually triggers a refresh of PR and CI status for all projects in the task. |
| `Grove: Update Context File` | Regenerates the .grove-context.md file with current PR/CI info. |
| `Grove: Task Notes` | Opens or focuses the .grove-context.md file for editing (developer can add notes here). |

---

## Detailed Flows

### Flow: New Task

1. Prompt: "Enter Jira ticket ID(s)" — text input, supports comma-separated (e.g., `TASK-200` or `TASK-200, TASK-201`)
2. For each ticket, call Jira REST API to fetch ticket summary/title
3. Show fetched title(s) for confirmation
4. Prompt: "Select projects for this task" — multi-select checklist showing all registered projects
5. For each selected project:
   a. Determine branch name using the branch template from config (e.g., `TASK-200-add-user-preferences`)
   b. Run `git worktree add` in the project's repo, creating the worktree under `~/grove-workspaces/TASK-200/{project-name}/`
   c. The base branch is the project's configured default base branch
6. Generate the `.code-workspace` file
7. Generate the `.grove-context.md` file
8. Save task data to tasks.json
9. Open the workspace in a new VS Code window

Error handling:
- If Jira API fails, allow manual title entry
- If worktree creation fails for a project (e.g., branch already exists), show error and ask whether to skip that project or use the existing branch
- If workspace directory already exists, warn and ask to overwrite or pick a different name

### Flow: Add Project to Existing Task

1. Show quick pick of registered projects not already in the current task
2. User selects one or more
3. For each selected project:
   a. Create worktree with the task's branch naming convention
   b. Add to the .code-workspace file (VS Code picks up the change live)
   c. Update task data
   d. Regenerate .grove-context.md

### Flow: Remove Project from Existing Task

1. Show quick pick of projects currently in the task
2. User selects one
3. Confirm: "Remove {project} from this task? This will delete the worktree and any uncommitted changes."
4. If confirmed:
   a. Remove worktree (`git worktree remove`)
   b. Remove from .code-workspace
   c. Update task data
   d. Regenerate .grove-context.md

### Flow: Archive Task

1. Show quick pick of active tasks
2. User selects one
3. Prompt: "Archive TASK-200? Choose cleanup option:"
   - "Archive only" — marks as archived, keeps worktrees and workspace
   - "Archive and clean up" — marks as archived, removes worktrees (only if branches are merged or user confirms), removes workspace file
4. Update task status to "archived"

### Flow: Create PR

1. Determine which project root is currently focused (active editor file belongs to which workspace folder)
2. If the project already has a PR, show message and offer to open it
3. If no PR exists:
   a. Push the branch to remote if not already pushed
   b. Use GitHub API to create a PR
   c. Title: Jira ticket ID + Jira title (e.g., "TASK-200: Add user preferences API")
   d. Body: Link to Jira ticket + auto-generated description template
   e. Base branch: the project's configured base branch
4. Update task data with PR info
5. Open PR URL in browser
6. Regenerate .grove-context.md

---

## Sidebar (Tree View)

The extension contributes a sidebar view in the Explorer or its own Activity Bar icon.

### Structure

```
GROVE
├── Active Tasks
│   ├── TASK-200: User Preferences
│   │   ├── backend-api    PR #145 🟡  CI ✅
│   │   ├── shared-types   PR #88  ✅  CI ✅
│   │   └── web-ui         No PR
│   │
│   ├── TASK-195: Fix auth token refresh
│   │   └── backend-api    PR #143 ✅  CI ✅
│   │
│   └── TASK-210: Dashboard redesign
│       └── web-ui         No PR
│
├── Archived Tasks
│   └── TASK-180: Payment integration
│       └── ...
│
└── Projects
    ├── web-ui          ~/repos/web-ui
    ├── backend-api     ~/repos/backend-api
    ├── shared-types    ~/repos/shared-types
    └── infra-config    ~/repos/infra-config
```

### Interactions

- Click on a task → Opens that task's workspace in a new window
- Click on a project within a task → Opens that specific folder/file in the current window (if in the task workspace) or opens the task workspace
- Right-click on a task → Context menu: Open, Archive, Delete, Open Jira, Refresh Status
- Right-click on a project within a task → Context menu: Open PR, Open CI, Create PR, Remove from Task
- Inline icons/badges for PR status and CI status
- Refresh button at the top of the tree view

### Status Icons

| Icon | Meaning |
|---|---|
| ⚪ | No PR created |
| 🟡 | PR open, review pending or changes requested |
| 🟢 | PR approved / merged |
| ❌ | CI failed |
| ✅ | CI passed |
| 🔄 | CI running |

Use VS Code's ThemeIcon or codicons for actual implementation, not emoji. The above are conceptual.

---

## Status Bar

When inside a task workspace, show a status bar item on the left:

```
$(grove-icon) TASK-200 | backend-api: PR #145 🟡 | web-ui: No PR
```

Clicking the status bar item shows a quick pick with actions: Open Jira, Refresh Status, Open all PRs.

The status bar item should only appear when the current workspace is a Grove task workspace (detected via `grove.taskId` in workspace settings).

---

## Background Polling

The extension should periodically poll for updates:

- **What**: PR status (open/merged/closed, review status, comments count) and CI status for all active tasks
- **Frequency**: Every 3-5 minutes, configurable
- **When**: Only when VS Code is focused/active
- **Trigger**: Also refresh on window focus (when switching back to VS Code)
- **Update**: Refresh sidebar tree, status bar, and task data file
- **Notifications**: Show a VS Code notification when:
  - A PR is approved
  - CI fails
  - A PR is merged
  - The user can configure which notifications they want

---

## API Integrations

### Jira REST API

Used for:
- Fetching ticket summary/title by ticket ID
- Getting ticket status

Endpoints:
- `GET /rest/api/3/issue/{issueId}` — get issue details

Authentication: Basic auth with email + API token.

### GitHub REST API

Used for:
- Creating pull requests
- Fetching PR status (open/closed/merged, review status)
- Fetching CI/check run status

Endpoints:
- `POST /repos/{owner}/{repo}/pulls` — create PR
- `GET /repos/{owner}/{repo}/pulls?head={branch}` — find PR by branch
- `GET /repos/{owner}/{repo}/pulls/{number}/reviews` — get review status
- `GET /repos/{owner}/{repo}/commits/{ref}/check-runs` — get CI status

Authentication: Personal access token with `repo` scope.

---

## Configuration (package.json contribution points)

The extension should contribute these settings:

```json
{
  "grove.workspaceDir": {
    "type": "string",
    "default": "~/grove-workspaces",
    "description": "Directory where task workspaces are created"
  },
  "grove.branchTemplate": {
    "type": "string",
    "default": "{ticketId}-{slug}",
    "description": "Branch naming template. Variables: {ticketId}, {slug}, {title}"
  },
  "grove.pollingInterval": {
    "type": "number",
    "default": 300,
    "description": "Status polling interval in seconds"
  },
  "grove.notifications.prApproved": {
    "type": "boolean",
    "default": true
  },
  "grove.notifications.ciFailed": {
    "type": "boolean",
    "default": true
  },
  "grove.notifications.prMerged": {
    "type": "boolean",
    "default": true
  }
}
```

---

## .grove-context.md — AI Context File

This file is auto-generated in each task workspace root and serves as a context bridge for AI tools. It is regenerated whenever task data changes (project added/removed, PR created, status update).

Format:

```markdown
# Task: {TICKET-ID} — {Title}

## Jira Tickets
- [{TICKET-ID}]({jiraUrl})

## Repositories & Branches
| Repo | Branch | Base Branch | PR | CI |
|------|--------|-------------|----|----|
| backend-api | TASK-200-user-preferences | main | PR #145 (reviewing) | passed |
| web-ui | TASK-200-user-preferences | main | — | — |

## PR Links
- backend-api: https://github.com/company-org/backend-api/pull/145

## Notes
<!-- Add your task notes below this line -->
```

The "Notes" section is preserved across regenerations — the regeneration process should only update the sections above "Notes" and leave everything below intact.

---

## First-Run Experience

When the extension activates for the first time (no `~/.grove/config.json` exists):

1. Show a welcome notification: "Welcome to Grove! Let's set up your workspace."
2. Walk through:
   a. Set workspace directory (default `~/grove-workspaces`)
   b. Configure Jira: base URL, email, API token
   c. Configure GitHub: org, API token
   d. Register first project: pick a local repo folder
3. After setup, show the sidebar and invite the user to create their first task

If the user dismisses setup, the extension should still work for local-only features (manual task creation without Jira integration, worktree management without PR tracking).

---

## Error Handling & Edge Cases

| Scenario | Handling |
|---|---|
| Jira API unreachable | Allow manual title entry, show warning |
| GitHub API unreachable | Skip PR/CI status, show warning badge in sidebar |
| Branch already exists in a repo | Ask: use existing branch, pick a different name, or skip |
| Worktree path already exists | Ask: reuse, delete and recreate, or abort |
| Uncommitted changes when removing a project | Warn user, require force confirmation |
| Repo has diverged from remote | Show warning but don't block worktree creation |
| Multiple tasks using same repo | This is fine — each task gets its own worktree with its own branch |
| Default branch differs per repo | Use the per-project `defaultBaseBranch` setting |
| Token expired / invalid | Show error notification with a link to re-run setup |

---

## Implementation Phases

### Phase 1: Core Worktree & Workspace Management
- Global config and project registration (commands: Setup, Register Project, Remove Project, List Projects)
- Task CRUD (commands: New Task, Open Task, List Tasks, Archive Task, Delete Task)
- Git worktree creation and removal
- .code-workspace file generation
- Add/Remove project from task
- Sidebar tree view (tasks and projects, no status icons yet)
- .grove-context.md generation

At this point the extension is usable for the core workflow: create task → select projects → get workspace → work.

### Phase 2: Jira Integration
- Jira API client
- Auto-fetch ticket title during task creation
- Open Jira command
- Jira link in .grove-context.md

### Phase 3: GitHub Integration — PRs
- GitHub API client
- Create PR command with pre-filled title/body
- Fetch PR status per project
- Open PR command
- PR status icons in sidebar
- Status bar showing PR info

### Phase 4: GitHub Integration — CI & Polling
- Fetch CI/check status per PR
- CI status icons in sidebar
- Background polling
- Notifications (PR approved, CI failed, PR merged)
- Refresh on window focus

### Phase 5: Polish
- First-run setup wizard
- Error handling improvements
- Status bar refinements
- Context file preservation of notes across regeneration
- Keyboard shortcuts for common actions

---

## Tech Stack

- **Language**: TypeScript
- **Extension API**: VS Code Extension API
- **HTTP client**: VS Code's built-in fetch or `node-fetch` for API calls
- **Storage**: JSON files on disk (`~/.grove/`) + VS Code SecretStorage for tokens
- **Git operations**: Spawn `git` CLI commands (not a git library — keeps it simple and uses the user's git config/auth)
- **Testing**: VS Code extension testing framework + unit tests for core module

---

## Key Design Decisions

1. **JSON files over SQLite**: Simpler, human-readable, easy to debug. The data volume is tiny (tens of tasks, not thousands).
2. **Spawn git CLI over git library**: Uses the user's existing git configuration, SSH keys, and credential helpers. No additional auth setup needed.
3. **One workspace file per task**: Clean separation. Each task gets its own VS Code window with its own Claude session.
4. **Core module has no VS Code dependencies**: Enables future CLI tool and makes unit testing straightforward.
5. **Hardcoded to Jira + GitHub**: This is a personal tool first. Provider abstraction comes later if/when the extension goes public.
6. **Worktrees grouped under a task directory**: `~/grove-workspaces/TASK-200/backend-api/` rather than scattered next to each repo. Easier to reason about and clean up.