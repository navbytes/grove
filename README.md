# Grove

**Manage cross-repository task workspaces with git worktrees — from the terminal.**

Grove is a CLI tool that helps developers work on tasks spanning multiple repositories. It creates isolated workspaces using git worktrees, tracks PR and CI status, and integrates with Jira for ticket management.

## Installation

```bash
npm install -g grove-cli
```

## Features

- **Task-based Workspaces**: Create isolated workspaces for each task using git worktrees
- **Multi-repository Support**: Work across multiple repositories in a single task
- **Interactive TUI Dashboard**: Full-screen terminal UI with live status updates
- **Jira Integration**: Link tasks to Jira tickets, auto-fetch ticket titles
- **GitHub Integration**: Track PR status, reviews, and CI checks
- **Smart Links**: Add any URL — auto-categorized as Slack, Buildkite, GitHub, Confluence, Figma, etc.
- **Context Files**: Auto-generated `.grove-context.md` files for AI tools (Claude Code, Cursor, etc.)
- **Shell Integration**: Environment variables for prompt customization

## Quick Start

```bash
# 1. Setup Grove
grove init

# 2. Register your repositories
grove project add ~/repos/backend-api
grove project add ~/repos/web-ui

# 3. Create a task
grove new

# 4. Open a task workspace
grove open TASK-200

# 5. Check status
grove status
```

## Commands

### Setup & Configuration

| Command | Description |
|---------|-------------|
| `grove init` | Interactive setup wizard |
| `grove config set <key> <value>` | Set a configuration value |
| `grove config get <key>` | Get a configuration value |
| `grove config edit` | Open config in `$EDITOR` |

### Project Management

| Command | Description |
|---------|-------------|
| `grove project add [path]` | Register a project (defaults to cwd) |
| `grove project list` | List all registered projects |
| `grove project remove <name>` | Remove a registered project |

### Task Management

| Command | Description |
|---------|-------------|
| `grove new [title]` | Create a new task workspace |
| `grove list` | List all tasks with status |
| `grove status [task]` | Show detailed task status |
| `grove open <task>` | Open a task workspace (spawns shell) |
| `grove archive <task>` | Archive a completed task |
| `grove delete <task>` | Permanently delete a task |

### Within a Task

| Command | Description |
|---------|-------------|
| `grove task add-project [project]` | Add a project to the current task |
| `grove task remove-project <project>` | Remove a project from the current task |
| `grove pr create [project]` | Create a pull request |
| `grove pr status` | Show PR and CI status |
| `grove pr open [project]` | Open PR in browser |
| `grove jira open` | Open linked Jira ticket |
| `grove ci open [project]` | Open CI status page |
| `grove notes` | Edit task notes in `$EDITOR` |
| `grove context` | Regenerate the context file |
| `grove link add <url>` | Add a link (auto-categorized: Slack, Buildkite, GitHub, etc.) |
| `grove link list` | List all links grouped by category |
| `grove link open [index]` | Open a link in browser |
| `grove link remove <index>` | Remove a link |

### Dashboard & Monitoring

| Command | Description |
|---------|-------------|
| `grove dashboard` | Launch interactive TUI dashboard |
| `grove refresh` | Manually refresh PR/CI status |
| `grove watch` | Watch mode with desktop notifications |

## Opening Tasks

```bash
grove open TASK-200                        # Spawn shell in task workspace
grove open TASK-200 --cd                   # Print path (for eval)
grove open TASK-200 --code                 # Open in VS Code
grove open TASK-200 --project backend-api  # Open specific project
```

The spawned shell sets `GROVE_TASK`, `GROVE_TASK_DIR`, and `GROVE_PROJECTS` environment variables for prompt customization.

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `workspaceDir` | `~/grove-workspaces` | Where task workspaces are created |
| `branchTemplate` | `{ticketId}-{slug}` | Branch naming template |
| `defaultBaseBranch` | `main` | Default base branch for new worktrees |
| `pollingInterval` | `300` | Status refresh interval in seconds |

### Branch Template Variables

- `{ticketId}` — Jira ticket ID (e.g., `PROJ-123`)
- `{slug}` — URL-friendly version of the task title
- `{title}` — Full task title

## How It Works

1. **Git Worktrees**: Grove uses git worktrees to create isolated working directories. Multiple branches checked out simultaneously, no stashing needed.

2. **Task Storage**: Tasks stored as JSON in `~/.grove/tasks.json`. Each task tracks its projects, Jira tickets, PRs, and notes.

3. **Context Files**: Every task gets a `.grove-context.md` with Jira links, PR status, branch info, and your notes — perfect for feeding to AI coding tools.

4. **Status Tracking**: Grove polls GitHub for PR and CI status updates and shows them in the dashboard or via `grove status`.

## Requirements

- Node.js 18+
- Git 2.5+ (for worktree support)
- macOS (primary), Linux (supported)

## License

MIT License — see [LICENSE](LICENSE) for details.
