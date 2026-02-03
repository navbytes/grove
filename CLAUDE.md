# Claude Knowledge Base

> **Always read this file first.** Read other files lazily when working on those specific areas.

## Quick Start

**Grove** is a VS Code extension for managing cross-repository task workspaces using git worktrees.

See [.claude/README.md](.claude/README.md) for the full knowledge base index.

## Knowledge Base Structure

```
.claude/
├── README.md           # Main index (always read this)
└── docs/
    ├── core.md         # Core business logic
    ├── extension.md    # VS Code extension layer
    ├── commands.md     # Command handlers
    ├── integrations.md # GitHub & Jira APIs
    ├── types.md        # Data models
    ├── webview.md      # Svelte dashboard
    └── build.md        # Build & CI/CD
```

## When to Read Each File

| Working On | Read First |
|------------|------------|
| Task/project/worktree logic | `.claude/docs/core.md` |
| Sidebar, status bar, polling | `.claude/docs/extension.md` |
| Adding/modifying commands | `.claude/docs/commands.md` |
| GitHub or Jira API | `.claude/docs/integrations.md` |
| Type definitions | `.claude/docs/types.md` |
| Dashboard UI | `.claude/docs/webview.md` |
| Build or CI issues | `.claude/docs/build.md` |

## Auto-Update Protocol

**IMPORTANT: After modifying code, update the corresponding knowledge file.**

### Update Rules

When you modify these files, update the corresponding knowledge document:

| Files Modified | Update This Knowledge File |
|----------------|----------------------------|
| `src/core/types.ts` | `.claude/docs/types.md` |
| `src/core/*.ts` (except types, github, jira) | `.claude/docs/core.md` |
| `src/core/github.ts`, `src/core/jira.ts`, `src/core/git-provider.ts` | `.claude/docs/integrations.md` |
| `src/extension/commands.ts` | `.claude/docs/commands.md` |
| `src/extension/*.ts` (except commands) | `.claude/docs/extension.md` |
| `webview-ui/**` | `.claude/docs/webview.md` |
| `package.json`, `tsconfig.json`, `.github/workflows/*` | `.claude/docs/build.md` |

### What to Update

When updating a knowledge file:

1. **Add** new functions, types, or patterns you introduced
2. **Modify** existing documentation if behavior changed
3. **Remove** documentation for deleted features
4. **Update** the "Last updated" date at the bottom

### Update Template

At the top of each knowledge file:

```markdown
> **Auto-update trigger**: Update this file when modifying [list of source files].
```

This reminds you when to update.

## Quick Reference

### Directory Structure

```
src/
├── core/           # Business logic (no VS Code deps)
│   ├── types.ts    # Data models
│   ├── config.ts   # Config management
│   ├── store.ts    # Task persistence
│   ├── tasks.ts    # Task operations
│   ├── worktree.ts # Git operations
│   ├── github.ts   # GitHub API
│   └── jira.ts     # Jira API
├── extension/      # VS Code layer
│   ├── extension.ts # Entry point
│   ├── commands.ts  # Command handlers
│   ├── sidebar.ts   # Tree view
│   └── polling.ts   # Background updates
└── test/           # Unit tests
webview-ui/         # Svelte dashboard
```

### Key Patterns

1. **Layered architecture**: `extension/` → `core/`, never reverse
2. **Result types**: `OperationResult<T>` with `success`, `data`, `error`
3. **File storage**: All data in `~/.grove/`
4. **Secrets**: Tokens in VS Code SecretStorage

### Common Commands

```bash
npm run watch        # Dev mode
npm run compile      # Build
npm run test:unit    # Tests
npm run package      # Create VSIX
```

---

*This knowledge base is self-updating. Claude should update relevant docs when modifying code.*
