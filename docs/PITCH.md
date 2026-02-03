# Grove: Stop Context-Switching, Start Shipping

**The multi-repo task management extension for VS Code**

---

## The Problem

You're working on a feature that touches three repositories. You've got branches in each, PRs open, a Jira ticket somewhere, and a Slack thread with important decisions buried in it.

Then someone asks you to review something urgent.

Now you're stashing changes, switching branches, losing your place. When you come back to your feature, you spend 15 minutes just remembering where you were.

**Sound familiar?**

## The Solution

Grove creates isolated workspaces for each task using git worktrees. Switch between tasks instantly. Never stash again. Never lose context.

```
Task: PROJ-123 - Add user authentication
├── backend/          (feature branch)
├── frontend/         (feature branch)
├── shared-lib/       (feature branch)
└── .grove-context.md (your notes, PR links, everything)
```

## Why Grove?

### 🌲 Instant Context Switching
Each task lives in its own workspace. Jump between tasks without touching git. Your work stays exactly where you left it.

### 🔗 Everything Connected
- Jira ticket? One click away.
- PR status? Right in your sidebar.
- CI failing? Get notified immediately.
- Slack thread with that important decision? Linked and accessible.

### 📁 Multi-Repo Made Simple
Working across repositories shouldn't be painful. Grove creates coordinated branches across all your projects and opens them in a single VS Code window.

### 📝 Context That Persists
Every task gets a `.grove-context.md` file with:
- Links to Jira, PRs, and Slack threads
- Your notes (preserved across updates)
- Project status at a glance

### 🔔 Stay Informed
Background polling keeps you updated:
- PR approved? You'll know.
- CI failed? You'll know.
- PR merged? Time to archive that task.

## How It Works

1. **Register your repositories once**
2. **Create a task** — Grove sets up worktrees and branches
3. **Work normally** — it's just VS Code
4. **Switch tasks instantly** — no stashing, no branch switching
5. **Archive when done** — clean up with one command

## Built for Real Workflows

- **Branch templates**: `{ticketId}-{slug}` becomes `PROJ-123-add-user-auth`
- **Jira integration**: Pull ticket info, open tickets from VS Code
- **GitHub integration**: Create PRs, track reviews, monitor CI
- **Slack integration**: Link discussion threads to tasks

## The Bottom Line

Every context switch costs you 23 minutes of focus time.*

Grove eliminates context switches between tasks. You stay in flow. You ship faster.

**Stop juggling branches. Start using Grove.**

---

*University of California, Irvine study on workplace interruptions

## Get Started

1. Install Grove from the VS Code marketplace
2. Run `Grove: Setup` from the command palette
3. Register your first project
4. Create your first task

That's it. You're ready to work smarter.

---

**Grove** — Because your brain has better things to do than remember which branch you were on.
