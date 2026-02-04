# Grove - Claude Knowledge Base

> **Read this file first.** Only read other files when working on those specific areas.

## Project Overview

**Grove** is a VS Code extension that manages cross-repository task workspaces using git worktrees. It helps developers work on features spanning multiple repositories without stashing or branch switching.

**Tech Stack:** TypeScript, VS Code Extension API, Svelte (webview), Bun

## Quick Reference

| Area | Knowledge File | Read When |
|------|---------------|-----------|
| Core logic | [docs/core.md](docs/core.md) | Modifying task/project/worktree logic |
| VS Code extension | [docs/extension.md](docs/extension.md) | Changing sidebar, status bar, polling |
| Commands | [docs/commands.md](docs/commands.md) | Adding/modifying commands |
| GitHub/Jira APIs | [docs/integrations.md](docs/integrations.md) | Working with external APIs |
| Type definitions | [docs/types.md](docs/types.md) | Changing data models |
| Webview dashboard | [docs/webview.md](docs/webview.md) | Modifying the dashboard UI |
| Build & dev | [docs/build.md](docs/build.md) | Build issues or CI/CD changes |

## Directory Structure

```
src/
├── core/           # Business logic (no VS Code deps)
│   ├── types.ts    # Data models
│   ├── config.ts   # ~/.grove config management
│   ├── store.ts    # Task persistence (tasks.json)
│   ├── projects.ts # Project registry
│   ├── tasks.ts    # Task operations
│   ├── worktree.ts # Git worktree operations
│   └── github.ts   # GitHub API client
├── extension/      # VS Code integration
│   ├── extension.ts # Entry point
│   ├── commands.ts  # Command handlers
│   ├── sidebar.ts   # Tree view
│   └── polling.ts   # Background updates
└── test/           # Unit tests
webview-ui/         # Svelte dashboard
```

## Key Patterns

1. **Layered architecture**: `extension/` depends on `core/`, never reverse
2. **Result types**: Functions return `OperationResult<T>` with `success`, `data`, `error`
3. **File-based state**: All data in `~/.grove/` (config.json, projects.json, tasks.json)
4. **No external deps in core**: Core module is pure TypeScript

## Common Tasks

- **Add a command**: Edit `src/extension/commands.ts`, update `package.json` contributes
- **Modify task structure**: Edit `src/core/types.ts`, update `src/core/tasks.ts`
- **Change sidebar display**: Edit `src/extension/sidebar.ts`
- **Add API integration**: Edit `src/core/github.ts` or `src/core/jira.ts`

## Auto-Update Rules

**When you modify code, update the corresponding knowledge file:**

| Files Changed | Update |
|--------------|--------|
| `src/core/types.ts` | [docs/types.md](docs/types.md) |
| `src/core/*.ts` (except types) | [docs/core.md](docs/core.md) |
| `src/extension/commands.ts` | [docs/commands.md](docs/commands.md) |
| `src/extension/*.ts` (except commands) | [docs/extension.md](docs/extension.md) |
| `src/core/github.ts`, `src/core/jira.ts` | [docs/integrations.md](docs/integrations.md) |
| `webview-ui/**` | [docs/webview.md](docs/webview.md) |
| `package.json`, CI/CD, build config | [docs/build.md](docs/build.md) |

---
*Last updated: 2026-02-03*
