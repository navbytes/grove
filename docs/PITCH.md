# Grove: Stop Context-Switching, Start Shipping

**The multi-repo task management CLI for your terminal**

---

## The Problem

You're working on a feature that touches three repositories. You've got branches in each, PRs open, a Jira ticket somewhere, and a Slack thread with important decisions buried in it.

Then someone asks you to review something urgent.

Now you're stashing changes, switching branches, losing your place. When you come back to your feature, you spend 15 minutes just remembering where you were.

**Sound familiar?**

## The Solution

Grove creates isolated workspaces for each task using git worktrees. Switch between tasks instantly. Never stash again. Never lose context.

```
$ grove new
? Jira ticket: PROJ-123
? Title: Add user authentication
? Select projects: backend, frontend, shared-lib

Created task PROJ-123 in ~/grove-workspaces/PROJ-123/
  backend/      (branch: PROJ-123-add-user-auth)
  frontend/     (branch: PROJ-123-add-user-auth)
  shared-lib/   (branch: PROJ-123-add-user-auth)

$ grove open PROJ-123
Entering task workspace...
[PROJ-123] ~/grove-workspaces/PROJ-123 $
```

## Why Grove?

### Instant Context Switching
Each task lives in its own workspace. Jump between tasks without touching git. Your work stays exactly where you left it.

### Everything Connected
- Jira ticket? `grove jira open`
- PR status? `grove pr status`
- CI failing? `grove ci open`
- Slack thread? Buildkite build? `grove link open`

### Multi-Repo Made Simple
Working across repositories shouldn't be painful. Grove creates coordinated branches across all your projects and groups them in one place.

### Context That Persists
Every task gets a `.grove-context.md` file — a single file with Jira links, PR status, branch info, and your notes. Feed it to Claude Code or Cursor and your AI assistant knows exactly what you're working on.

### Stay Informed
`grove watch` keeps you updated with desktop notifications:
- PR approved? You'll know.
- CI failed? You'll know.
- PR merged? Time to archive that task.

### Interactive Dashboard
`grove dashboard` gives you a full-screen TUI with live status for all your tasks, PRs, and CI pipelines.

## How It Works

```bash
# 1. Register your repos once
grove project add ~/repos/backend
grove project add ~/repos/frontend

# 2. Create a task — Grove sets up worktrees and branches
grove new

# 3. Open the workspace — you're in a dedicated shell
grove open PROJ-123

# 4. Work normally, create PRs when ready
grove pr create

# 5. Switch to another task — no stashing
grove open PROJ-456

# 6. Archive when done
grove archive PROJ-123
```

## Built for Real Workflows

- **Branch templates**: `{ticketId}-{slug}` becomes `PROJ-123-add-user-auth`
- **Jira integration**: Pull ticket info automatically
- **GitHub integration**: Create PRs, track reviews, monitor CI
- **Smart links**: Auto-categorize any URL you add (Slack, Buildkite, Confluence, Figma, etc.)
- **AI-friendly**: `.grove-context.md` gives your AI tools full task context
- **Shell integration**: `GROVE_TASK` env var for prompt customization

## The Bottom Line

Every context switch costs you 23 minutes of focus time.*

Grove eliminates context switches between tasks. You stay in flow. You ship faster.

**Stop juggling branches. Start using Grove.**

---

*University of California, Irvine study on workplace interruptions

## Get Started

```bash
npm install -g grove-cli
grove init
```

That's it. You're ready to work smarter.

---

**Grove** — Because your brain has better things to do than remember which branch you were on.
