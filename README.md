# Grove

**Manage cross-repository task workspaces with git worktrees**

Grove is a VS Code extension that helps developers work on tasks that span multiple repositories. It creates isolated workspaces using git worktrees, tracks PR and CI status, and integrates with Jira for ticket management.

## Features

- **Task-based Workspaces**: Create isolated workspaces for each task using git worktrees
- **Multi-repository Support**: Work across multiple repositories in a single task
- **Jira Integration**: Link tasks to Jira tickets and open them directly from VS Code
- **GitHub Integration**: Track PR status, reviews, and CI checks
- **Status Polling**: Get notified when PRs are approved, CI fails, or PRs are merged
- **Slack Integration**: Link Slack threads to tasks for easy reference
- **Context Files**: Auto-generated `.grove-context.md` files with task details and notes

## Getting Started

1. **Setup Grove**: Run `Grove: Setup` from the command palette to configure:
   - Workspace directory (where task workspaces are created)
   - Jira credentials (optional)
   - GitHub token (optional, for PR tracking)

2. **Register Projects**: Run `Grove: Register Project` to add repositories you work with

3. **Create a Task**: Run `Grove: New Task` to start working on something new:
   - Enter a task title
   - Optionally link a Jira ticket
   - Select which projects to include

4. **Work on Your Task**: Grove creates a VS Code workspace with:
   - Git worktrees for each project (isolated from your main branches)
   - A `.grove-context.md` file with task details
   - Automatic branch creation based on your template

## Commands

| Command | Description |
|---------|-------------|
| `Grove: Setup` | Configure Grove settings and credentials |
| `Grove: Register Project` | Add a project to Grove |
| `Grove: Remove Project` | Remove a registered project |
| `Grove: List Projects` | View all registered projects |
| `Grove: New Task` | Create a new task workspace |
| `Grove: Open Task` | Open an existing task |
| `Grove: List Tasks` | View all tasks |
| `Grove: Archive Task` | Archive a completed task |
| `Grove: Delete Task` | Permanently delete a task |
| `Grove: Add Project to Task` | Add a project to the current task |
| `Grove: Remove Project from Task` | Remove a project from the current task |
| `Grove: Create PR` | Create a pull request for a project |
| `Grove: Open PR` | Open the PR in your browser |
| `Grove: Open Jira` | Open the linked Jira ticket |
| `Grove: Open CI` | Open the CI status page |
| `Grove: Task Notes` | Edit task notes |
| `Grove: Add Slack Thread` | Link a Slack thread to the task |
| `Grove: Remove Slack Thread` | Remove a linked Slack thread |
| `Grove: Open Slack Thread` | Open a Slack thread in your browser |
| `Grove: Refresh Status` | Manually refresh PR/CI status |
| `Grove: Update Context File` | Regenerate the context file |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `grove.workspaceDir` | `~/grove-workspaces` | Directory where task workspaces are created |
| `grove.branchTemplate` | `{ticketId}-{slug}` | Branch naming template |
| `grove.pollingInterval` | `300` | Status polling interval in seconds (60-3600) |
| `grove.notifications.prApproved` | `true` | Notify when a PR is approved |
| `grove.notifications.ciFailed` | `true` | Notify when CI fails |
| `grove.notifications.prMerged` | `true` | Notify when a PR is merged |

### Branch Template Variables

- `{ticketId}` - The Jira ticket ID (e.g., `PROJ-123`)
- `{slug}` - A URL-friendly version of the task title
- `{title}` - The full task title

## How It Works

1. **Git Worktrees**: Grove uses git worktrees to create isolated working directories. This means you can have multiple branches checked out simultaneously without stashing or committing work-in-progress.

2. **Task Storage**: Tasks are stored as JSON files in `~/.grove/tasks/`. Each task tracks its projects, Jira tickets, PRs, and notes.

3. **Multi-root Workspaces**: When you open a task, Grove creates a VS Code multi-root workspace containing all the project worktrees.

4. **Status Polling**: Grove periodically checks GitHub for PR status updates and notifies you of important changes.

## Requirements

- Git 2.5+ (for worktree support)
- VS Code 1.85.0+

## License

MIT License - see [LICENSE](LICENSE) for details.
