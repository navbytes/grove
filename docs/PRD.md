# Grove — CLI Tool Specification

## What is Grove?

Grove is a terminal-based CLI tool that manages cross-repository task workspaces. A developer working on a single task (e.g., a Jira ticket) that touches multiple repositories can use Grove to create isolated git worktrees in each repo, group them into a workspace, track PR and CI status, and switch between tasks instantly — all from the terminal.

The name "Grove" comes from the concept of grouping worktrees together, like a grove of trees.

---

## Target User & Environment

- A single developer (the author) working at a company
- Multiple git repositories: web-ui, backend API, shared libraries, infra config, etc.
- Tasks (Jira tickets) frequently span multiple repos
- Uses `git worktree` to work on multiple tasks in parallel
- Uses Claude AI via VS Code extension and via terminal (Claude Code CLI)
- Primary OS: macOS (Linux support is a bonus, Windows not required initially)

---

## Core Concepts

### Task

A unit of work tied to one or more Jira tickets. A task groups multiple repo worktrees into a single workspace.

### Project

A registered git repository that the developer works with. Projects are configured once and reused across tasks.

### Task Workspace

A directory containing all the worktrees for a given task, plus a `.grove-context.md` file for AI context and notes. Opening a task means entering this workspace (via spawning a shell, cd, or opening in an editor).

---

## CLI Interface

### Installation

```bash
npm install -g grove-cli
```

### Command Structure

```
grove <command> [subcommand] [options]
```

### Setup & Configuration

| Command                          | What it does                                                                                                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `grove init`                     | Interactive setup wizard. Prompts for workspace directory, Jira credentials, GitHub token. Stores in `~/.grove/config.json` with restricted file permissions for secrets. |
| `grove config set <key> <value>` | Set a config value (e.g., `grove config set branchTemplate "{ticketId}-{slug}"`)                                                                                          |
| `grove config get <key>`         | Get a config value                                                                                                                                                        |
| `grove config edit`              | Open config in `$EDITOR`                                                                                                                                                  |

### Project Management

| Command                       | What it does                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------- |
| `grove project add [path]`    | Register a project. If path omitted, uses current directory. Auto-detects repo name and default branch. |
| `grove project list`          | List all registered projects in a table.                                                                |
| `grove project remove <name>` | Remove a registered project. Does not affect existing tasks.                                            |

### Task Management

| Command                | What it does                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- |
| `grove new [title]`    | Create a new task. Interactive flow described below.                                                       |
| `grove list`           | List all tasks with status, PR info, and CI status in a table.                                             |
| `grove status [task]`  | Show detailed status for a task (or current task if in a task workspace).                                  |
| `grove open <task>`    | Open a task workspace. Default: spawn a new shell. Flags: `--cd` (print path), `--code` (open in VS Code). |
| `grove archive <task>` | Archive a task. Options: keep worktrees or clean up.                                                       |
| `grove delete <task>`  | Permanently delete a task, worktrees, and workspace files. Requires confirmation.                          |

### Within a Task (commands that auto-detect current task from cwd)

| Command                               | What it does                                                                                               |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `grove task add-project [project]`    | Add a project to the current task. Interactive project picker if not specified.                            |
| `grove task remove-project <project>` | Remove a project from the current task. Removes worktree. Requires confirmation.                           |
| `grove pr create [project]`           | Create a PR for a project. Auto-detects project from cwd if not specified. Pre-fills from Jira.            |
| `grove pr status`                     | Show PR and CI status for all projects in the current task.                                                |
| `grove pr open [project]`             | Open PR URL in browser.                                                                                    |
| `grove jira open`                     | Open linked Jira ticket in browser.                                                                        |
| `grove ci open [project]`             | Open CI status page in browser.                                                                            |
| `grove notes`                         | Open `.grove-context.md` in `$EDITOR` for editing.                                                         |
| `grove context`                       | Regenerate the `.grove-context.md` file.                                                                   |
| `grove link add <url>`                | Add a link to the task. Auto-categorized by URL (Slack, Buildkite, GitHub, Confluence, Figma, Misc, etc.). |
| `grove link list`                     | List all links, grouped by category.                                                                       |
| `grove link open [index]`             | Open a link in browser.                                                                                    |
| `grove link remove <index>`           | Remove a link.                                                                                             |

### TUI Dashboard

| Command           | What it does                                                                                         |
| ----------------- | ---------------------------------------------------------------------------------------------------- |
| `grove dashboard` | Launch interactive TUI dashboard. Shows all tasks, PR/CI status, keyboard navigation. Live-updating. |

### Utility

| Command            | What it does                                                             |
| ------------------ | ------------------------------------------------------------------------ |
| `grove refresh`    | Manually refresh PR/CI status for all active tasks.                      |
| `grove watch`      | Watch mode — periodically refresh status and show desktop notifications. |
| `grove completion` | Generate shell completions (bash, zsh, fish).                            |

---

## Data Model

### Global Configuration

Stored at `~/.grove/config.json` (file permissions: `0600`):

```json
{
  "workspaceDir": "~/grove-workspaces",
  "jira": {
    "baseUrl": "https://company.atlassian.net",
    "email": "naveen@company.com",
    "apiToken": "<encrypted-or-keychain>"
  },
  "git": {
    "provider": "github",
    "baseUrl": "https://github.com",
    "org": "company-org",
    "apiToken": "<encrypted-or-keychain>"
  },
  "ci": {
    "provider": "github-actions"
  },
  "branchPrefix": "",
  "branchTemplate": "{ticketId}-{slug}",
  "defaultBaseBranch": "main"
}
```

Secret storage strategy:

1. **Primary**: macOS Keychain via `security` CLI commands (no dependency needed)
2. **Fallback**: Config file with `0600` permissions and a warning on first setup
3. **Environment variables**: `GROVE_JIRA_TOKEN`, `GROVE_GITHUB_TOKEN` override config (useful for CI or scripting)

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
    "links": [
      {
        "label": "Design discussion",
        "url": "https://company.slack.com/archives/C01234/p1234567890",
        "category": "slack"
      },
      {
        "label": "Deploy pipeline",
        "url": "https://buildkite.com/company/pipeline/builds/456",
        "category": "buildkite"
      }
    ],
    "notes": ""
  }
]
```

---

## Directory Structure

```
~/grove-workspaces/
├── TASK-200/
│   ├── .grove-context.md
│   ├── backend-api/          ← git worktree
│   └── web-ui/               ← git worktree
│
├── TASK-195/
│   ├── .grove-context.md
│   └── backend-api/          ← git worktree
│
└── TASK-210/
    ├── .grove-context.md
    └── web-ui/               ← git worktree
```

---

## Project Architecture

```
grove-cli/
├── src/
│   ├── core/                  ← Pure TypeScript, no CLI framework dependencies
│   │   ├── types.ts               (all interfaces and types)
│   │   ├── config.ts              (read/write global config)
│   │   ├── projects.ts            (manage registered projects)
│   │   ├── tasks.ts               (create, update, archive, delete tasks)
│   │   ├── worktree.ts            (git worktree create/remove operations)
│   │   ├── context.ts             (generate .grove-context.md files)
│   │   ├── jira.ts                (Jira REST API client)
│   │   ├── github.ts              (GitHub API client — PRs, CI status)
│   │   ├── links.ts               (link categorization by URL pattern)
│   │   ├── secrets.ts             (keychain / secret storage abstraction)
│   │   └── store.ts               (read/write JSON data files)
│   │
│   ├── cli/                   ← CLI layer (commander + inquirer)
│   │   ├── index.ts               (entry point, command registration)
│   │   ├── commands/
│   │   │   ├── init.ts            (grove init)
│   │   │   ├── config.ts          (grove config get/set/edit)
│   │   │   ├── project.ts         (grove project add/list/remove)
│   │   │   ├── new.ts             (grove new)
│   │   │   ├── list.ts            (grove list)
│   │   │   ├── status.ts          (grove status)
│   │   │   ├── open.ts            (grove open)
│   │   │   ├── archive.ts         (grove archive)
│   │   │   ├── delete.ts          (grove delete)
│   │   │   ├── task.ts            (grove task add-project/remove-project)
│   │   │   ├── pr.ts              (grove pr create/status/open)
│   │   │   ├── jira.ts            (grove jira open)
│   │   │   ├── ci.ts              (grove ci open)
│   │   │   ├── notes.ts           (grove notes)
│   │   │   ├── context.ts         (grove context)
│   │   │   ├── link.ts            (grove link add/list/open/remove)
│   │   │   ├── refresh.ts         (grove refresh)
│   │   │   └── watch.ts           (grove watch)
│   │   └── ui/
│   │       ├── table.ts           (formatted table output)
│   │       ├── prompts.ts         (interactive prompts via inquirer)
│   │       └── colors.ts          (chalk color helpers)
│   │
│   ├── tui/                   ← Interactive TUI dashboard (Ink or blessed)
│   │   ├── app.tsx                (main TUI app component)
│   │   ├── components/
│   │   │   ├── task-list.tsx      (task list panel)
│   │   │   ├── task-detail.tsx    (task detail panel)
│   │   │   ├── status-bar.tsx     (bottom status bar)
│   │   │   └── help.tsx           (keybindings help overlay)
│   │   └── hooks/
│   │       ├── use-tasks.ts       (task data hook)
│   │       └── use-polling.ts     (background refresh hook)
│   │
│   └── test/                  ← Tests
│       ├── core/
│       └── cli/
│
├── package.json
├── tsconfig.json
└── README.md
```

### Layering Rules

1. `core/` has **zero dependencies** on `cli/`, `tui/`, or any CLI framework
2. `cli/` imports from `core/` only
3. `tui/` imports from `core/` only
4. `core/` can later be imported by a VS Code extension or any other consumer

---

## Detailed Flows

### Flow: `grove init`

1. Welcome message: "Welcome to Grove! Let's set up your workspace."
2. Prompt: "Where should task workspaces be created?" (default: `~/grove-workspaces`)
3. Create workspace directory if it doesn't exist
4. Prompt: "Configure Jira integration?" (y/n)
   - If yes: prompt for base URL, email, API token
   - Store token in macOS Keychain (or config file with warning)
5. Prompt: "Configure GitHub integration?" (y/n)
   - If yes: prompt for org name, API token
   - Store token in macOS Keychain (or config file with warning)
6. Prompt: "Register a project now?" (y/n)
   - If yes: run project add flow
7. Write `~/.grove/config.json`
8. Success message with next steps

### Flow: `grove new`

1. Prompt: "Enter Jira ticket ID(s)" — text input, supports comma-separated (e.g., `TASK-200` or `TASK-200, TASK-201`)
   - If Jira is configured, fetch ticket summary/title via API
   - If Jira API fails or not configured, prompt for manual title entry
2. Show fetched title(s) for confirmation
3. Prompt: "Select projects for this task" — multi-select checklist showing all registered projects
4. For each selected project:
   a. Determine branch name using the branch template from config
   b. Run `git worktree add` in the project's repo
   c. Worktree location: `~/grove-workspaces/{TASK-ID}/{project-name}/`
5. Generate the `.grove-context.md` file
6. Save task data to `tasks.json`
7. Prompt: "Open task workspace now?" — options: "Spawn shell", "Open in VS Code", "Just print path", "No"

Error handling:

- If branch already exists: ask to use existing, pick different name, or skip
- If worktree path exists: warn and ask to reuse or recreate
- If Jira API fails: allow manual title entry with a warning

### Flow: `grove open <task>`

Default behavior (no flags): spawn a new shell in the task workspace directory with `GROVE_TASK` environment variable set.

```bash
grove open TASK-200           # Spawns $SHELL in ~/grove-workspaces/TASK-200/
grove open TASK-200 --cd      # Prints: cd ~/grove-workspaces/TASK-200
grove open TASK-200 --code    # Runs: code ~/grove-workspaces/TASK-200/
grove open TASK-200 --project backend-api  # Spawns shell in the specific project worktree
```

The spawned shell has these environment variables:

- `GROVE_TASK=TASK-200`
- `GROVE_TASK_DIR=~/grove-workspaces/TASK-200`
- `GROVE_PROJECTS=backend-api,web-ui`

This allows shell prompt customization and other tools to detect they're in a Grove task.

### Flow: `grove pr create`

1. Detect current task from cwd (or prompt if not in a task workspace)
2. Detect current project from cwd (or prompt if task has multiple projects)
3. If the project already has a PR, show it and offer to open in browser
4. If no PR:
   a. Push branch to remote if not already pushed
   b. Pre-fill title: `{TICKET-ID}: {Jira title}`
   c. Pre-fill body: Jira link + template
   d. Show preview and confirm
   e. Create PR via GitHub API
   f. Update task data
   g. Open PR URL in browser
   h. Regenerate `.grove-context.md`

### External PR Detection

PRs created outside of Grove (via GitHub UI, `gh` CLI, or any other tool) are automatically discovered. During `grove refresh`, `grove status`, or `grove watch`, Grove queries GitHub for each project's branch:

```
GET /repos/{owner}/{repo}/pulls?head={org}:{branch}&state=open
```

If a PR is found that wasn't previously tracked, Grove updates the task data and shows a message:

```
$ grove refresh
  ✓ JIRA-4200: Discovered PR #152 for web-ui (created externally)
  ✓ JIRA-4200: backend-api PR #145 — approved, CI passed
```

This means the user can create PRs however they prefer — Grove adapts.

### Flow: `grove link add`

1. User provides a URL
2. Grove auto-categorizes by matching URL patterns:

| URL pattern                     | Category    |
| ------------------------------- | ----------- |
| `*.slack.com/*`                 | slack       |
| `*.buildkite.com/*`             | buildkite   |
| `github.com/*`                  | github      |
| `*.atlassian.net/*`, `*.jira.*` | jira        |
| `*.confluence.*`                | confluence  |
| `*.figma.com/*`                 | figma       |
| `*.notion.so/*`                 | notion      |
| `docs.google.com/*`             | google-docs |
| anything else                   | misc        |

3. Prompt for a label
4. Save to task data
5. Regenerate `.grove-context.md`

```
$ grove link add https://buildkite.com/company/backend/builds/789
? Label: Backend deploy #789
  ✓ Added link (Buildkite): Backend deploy #789

$ grove link list

  Slack:
    1. Design discussion
  Buildkite:
    2. Backend deploy #789
  Misc:
    3. Performance benchmark spreadsheet

$ grove link open 2
  Opening https://buildkite.com/company/backend/builds/789...

$ grove link remove 1
  ✓ Removed "Design discussion"
```

### Flow: `grove archive <task>`

1. Show task summary
2. Prompt: "Archive {task}? Choose cleanup option:"
   - "Archive only" — marks as archived, keeps worktrees
   - "Archive and clean up" — removes worktrees (warns if unmerged branches), removes workspace dir
3. Update task status to "archived"

### Flow: `grove dashboard` (TUI)

Full-screen interactive terminal UI:

```
┌─ Grove Dashboard ──────────────────────────────────────────────┐
│                                                                │
│  Active Tasks                          Task Detail             │
│  ─────────────                         ───────────             │
│  ▸ TASK-200  User preferences     │  TASK-200                  │
│    TASK-195  Fix auth refresh     │  User preferences API      │
│    TASK-210  Dashboard redesign   │                            │
│                                   │  Jira: TASK-200            │
│  Archived Tasks                   │                            │
│  ──────────────                   │  Projects:                 │
│    TASK-180  Payment integration  │  ┌──────────┬────┬────┐    │
│                                   │  │ Repo     │ PR │ CI │    │
│                                   │  ├──────────┼────┼────┤    │
│                                   │  │ backend  │#145│ ✓  │    │
│                                   │  │ web-ui   │ —  │ —  │    │
│                                   │  └──────────┴────┴────┘    │
│                                   │                            │
│                                   │  Links: 3 (Slack, Buildkite)│
│                                   │                            │
├────────────────────────────────────────────────────────────────┤
│ ↑↓ navigate  enter open  p create PR  j open Jira  r refresh  │
│ n new task   a archive   d delete     q quit       ? help     │
└────────────────────────────────────────────────────────────────┘
```

Features:

- Left panel: task list with status indicators
- Right panel: selected task detail with project table
- Bottom bar: keyboard shortcuts
- Live refresh every N seconds (configurable)
- Actions triggered by keyboard shortcuts
- Status indicators: ⚪ No PR, 🟡 Review pending, 🟢 Approved/Merged, ❌ CI failed, ✅ CI passed

---

## CLI Output Format

### `grove list`

```
  ID         Title                              Projects  PRs    Status
  ─────────  ─────────────────────────────────  ────────  ─────  ──────
  TASK-200   User preferences API               2         1/2    active
  TASK-195   Fix auth token refresh              1         1/1    active
  TASK-210   Dashboard redesign                  1         0/1    active
```

### `grove status TASK-200`

```
Task: TASK-200 — User preferences API and integrate in frontend
Jira: https://company.atlassian.net/browse/TASK-200
Created: 2026-02-03

  Project       Branch                        PR      Review    CI
  ────────────  ────────────────────────────  ──────  ────────  ──────
  backend-api   TASK-200-user-preferences     #145    changes   passed
  web-ui        TASK-200-user-preferences     —       —         —

Slack Threads:
  1. Design discussion

Notes: (none)
```

### `grove project list`

```
  Name            Path                              Default Branch
  ──────────────  ────────────────────────────────  ──────────────
  web-ui          ~/repos/web-ui                     main
  backend-api     ~/repos/backend-api                main
  shared-types    ~/repos/shared-types               develop
```

---

## .grove-context.md — AI Context File

Auto-generated in each task workspace root. Serves as context for AI tools (Claude Code CLI, Cursor, etc.).

```markdown
# Task: {TICKET-ID} — {Title}

## Jira Tickets

- [{TICKET-ID}]({jiraUrl})

## Repositories & Branches

| Repo        | Branch                    | Base Branch | PR                  | CI     |
| ----------- | ------------------------- | ----------- | ------------------- | ------ |
| backend-api | TASK-200-user-preferences | main        | PR #145 (reviewing) | passed |
| web-ui      | TASK-200-user-preferences | main        | —                   | —      |

## PR Links

- backend-api: https://github.com/company-org/backend-api/pull/145

## Links

### Slack

- [Design discussion](https://company.slack.com/archives/C01234/p1234567890)

### Buildkite

- [Backend deploy #789](https://buildkite.com/company/backend/builds/789)

## Notes

<!-- Add your task notes below this line -->
```

The "Notes" section is preserved across regenerations — only sections above "Notes" are updated.

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

## Configuration

### Config File (`~/.grove/config.json`)

```json
{
  "workspaceDir": "~/grove-workspaces",
  "branchTemplate": "{ticketId}-{slug}",
  "defaultBaseBranch": "main",
  "pollingInterval": 300,
  "notifications": {
    "prApproved": true,
    "ciFailed": true,
    "prMerged": true
  }
}
```

### Environment Variables

| Variable              | Description                                  |
| --------------------- | -------------------------------------------- |
| `GROVE_JIRA_TOKEN`    | Override Jira API token                      |
| `GROVE_GITHUB_TOKEN`  | Override GitHub API token                    |
| `GROVE_WORKSPACE_DIR` | Override workspace directory                 |
| `GROVE_TASK`          | Set by `grove open` — current task ID        |
| `GROVE_TASK_DIR`      | Set by `grove open` — current task directory |

### Branch Template Variables

- `{ticketId}` — Jira ticket ID (e.g., `TASK-200`)
- `{slug}` — URL-friendly version of the title
- `{title}` — Full task title

---

## Error Handling & Edge Cases

| Scenario                                           | Handling                                                   |
| -------------------------------------------------- | ---------------------------------------------------------- |
| Jira API unreachable                               | Allow manual title entry, show warning                     |
| GitHub API unreachable                             | Skip PR/CI status, show warning                            |
| Branch already exists in a repo                    | Ask: use existing branch, pick a different name, or skip   |
| Worktree path already exists                       | Ask: reuse, delete and recreate, or abort                  |
| Uncommitted changes when removing a project        | Warn user, require `--force` or confirmation               |
| Repo has diverged from remote                      | Show warning but don't block worktree creation             |
| Multiple tasks using same repo                     | Fine — each task gets its own worktree with its own branch |
| Default branch differs per repo                    | Use the per-project `defaultBaseBranch` setting            |
| Token expired / invalid                            | Show error with instructions to re-run `grove init`        |
| Not in a task workspace (for task-scoped commands) | Prompt user to select a task interactively                 |
| No projects registered                             | Prompt to register one before creating a task              |

---

## Implementation Phases

### Phase 1: Core & Basic CLI

- Project setup: TypeScript, commander, package.json with `bin` field
- Global config management (`grove init`, `grove config`)
- Project registration (`grove project add/list/remove`)
- Task CRUD (`grove new`, `grove list`, `grove open`, `grove archive`, `grove delete`)
- Git worktree creation and removal
- `.grove-context.md` generation
- `grove link add/list/open/remove` with auto-categorization
- Shell completion generation
- `grove open` with shell spawning, `--cd`, and `--code` flags

Deliverable: installable via `npm install -g`, usable for core workflow (create task → select projects → work in worktrees → switch tasks).

### Phase 2: Jira Integration

- Jira REST API client
- Auto-fetch ticket title during `grove new`
- `grove jira open`
- Jira links in `.grove-context.md`

### Phase 3: GitHub Integration — PRs

- GitHub REST API client
- `grove pr create` with pre-filled title/body
- `grove pr status` — fetch and display PR status
- `grove pr open`
- PR status in `grove list` and `grove status`
- External PR detection — auto-discover PRs created outside Grove by matching branch names

### Phase 4: GitHub Integration — CI & Polling

- Fetch CI/check status per PR
- CI status in `grove status`
- `grove ci open`
- `grove refresh` — manual status refresh
- `grove watch` — background polling with desktop notifications (via `osascript` on macOS)

### Phase 5: TUI Dashboard

- `grove dashboard` — interactive full-screen TUI
- Task list with navigation
- Task detail panel
- Keyboard shortcuts for all actions
- Live status refresh
- Built with Ink (React for CLIs) or blessed-contrib

### Phase 6: Polish & Distribution

- Error handling improvements
- Shell prompt integration guide (show task in PS1)
- Tab completion for task IDs and project names
- `npx grove-cli` support for trying without install
- Comprehensive `--help` for every command
- Extensible link category detection (user-defined URL patterns in config)

---

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Node.js (18+)
- **CLI framework**: Commander.js — command parsing and help generation
- **Interactive prompts**: Inquirer.js — multi-select, confirmations, text input
- **Terminal output**: Chalk (colors), cli-table3 (tables)
- **TUI framework**: Ink (React for CLIs) — for `grove dashboard`
- **HTTP client**: Native `fetch` (Node 18+) or `undici`
- **Storage**: JSON files on disk (`~/.grove/`) with `0600` permissions for sensitive files
- **Secrets**: macOS Keychain via `security` CLI, with env var override
- **Git operations**: Spawn `git` CLI commands — uses user's existing git config, SSH keys, credential helpers
- **Testing**: Vitest — fast, TypeScript-native
- **Package**: Published to npm as `grove-cli`

---

## Key Design Decisions

1. **CLI-first, UI-later**: Core logic is pure TypeScript with no framework dependencies. Can be consumed by a VS Code extension, macOS app, or web UI later.
2. **JSON files over SQLite**: Simpler, human-readable, easy to debug. The data volume is tiny.
3. **Spawn git CLI over git library**: Uses the user's existing git configuration, SSH keys, and credential helpers.
4. **npm distribution**: Trivial to install (`npm i -g grove-cli`), no code signing or notarization needed.
5. **Environment variables in spawned shells**: `GROVE_TASK`, `GROVE_TASK_DIR`, `GROVE_PROJECTS` enable shell prompt customization and tool integration.
6. **macOS Keychain for secrets**: Secure, no additional dependencies. Falls back to config file with restricted permissions.
7. **Ink for TUI**: React component model makes the dashboard composable and maintainable. Better than raw blessed for developer experience.
8. **Worktrees grouped under task directory**: `~/grove-workspaces/TASK-200/backend-api/` rather than scattered. Easy to reason about and clean up.

---

## Future Extensions

- **VS Code extension**: Import `core/` module, add VS Code UI layer (sidebar, commands, status bar)
- **macOS menu bar app**: Electron/Tauri wrapper around the TUI, or native Swift app reading `~/.grove/` data
- **CI/CD integration**: `grove ci` commands for triggering builds
- **Team features**: Shared task definitions, assignment tracking
- **Template system**: Pre-configured project sets for common task types
