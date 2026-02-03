# Extension Module Knowledge

> **Auto-update trigger**: Update this file when modifying `src/extension/extension.ts`, `src/extension/sidebar.ts`, `src/extension/statusbar.ts`, `src/extension/polling.ts`, `src/extension/setup.ts`, or `src/extension/dashboard.ts`.

## Overview

The `src/extension/` directory contains VS Code-specific integration. These files depend on the `vscode` API and orchestrate the user interface.

## Module Map

| File | Purpose | Key Exports |
|------|---------|-------------|
| `extension.ts` | Entry point, activation/deactivation | `activate`, `deactivate` |
| `commands.ts` | All command handlers | `registerCommands` |
| `sidebar.ts` | Tree view provider | `GroveSidebarProvider` |
| `statusbar.ts` | Status bar widget | `GroveStatusBar` |
| `polling.ts` | Background PR/CI polling | `GrovePolling` |
| `setup.ts` | Setup wizard flows | `showSetupWizard`, `registerProjectWizard` |
| `dashboard.ts` | Webview dashboard panel | `GroveDashboardPanel` |

## Extension Lifecycle (extension.ts)

```typescript
// Activation flow:
activate(context: ExtensionContext) {
  1. Create GroveSidebarProvider → register tree view
  2. registerCommands() → register all command handlers
  3. Create GroveStatusBar
  4. Create GrovePolling
  5. Check isGroveSetup() → show setup wizard if needed
  6. Start polling if setup complete
  7. Listen for window focus → refresh on focus
}

// Deactivation:
deactivate() {
  1. Stop polling
  2. Dispose status bar
}
```

## Sidebar (sidebar.ts)

Implements `TreeDataProvider<GroveTreeItem>` for the explorer view.

### Tree Structure

```
Grove Explorer
├── Active Tasks (expanded)
│   ├── PROJ-123: Add login feature
│   │   ├── backend (PR #45 ✓ | CI ✓)
│   │   ├── frontend (No PR)
│   │   └── Slack: API Discussion
│   └── PROJ-456: Fix bug
├── Archived Tasks (collapsed)
│   └── PROJ-100: Old feature
└── Projects (collapsed)
    ├── backend ~/code/backend
    └── frontend ~/code/frontend
```

### Tree Item Types

```typescript
type TreeItemType = 'section' | 'task' | 'taskProject' | 'project' | 'slackThread';

interface GroveTreeItemData {
  type: TreeItemType;
  task?: Task;
  taskProject?: TaskProject;
  project?: Project;
  slackThread?: { url: string; title?: string };
  sectionName?: string;
}
```

### Context Values (for menus)

| Context Value | Used For |
|---------------|----------|
| `section` | Section headers |
| `activeTask` | Active task items |
| `archivedTask` | Archived task items |
| `taskProject` | Project within task |
| `registeredProject` | Registered project |
| `slackThread` | Slack thread link |

### Icons

- Task: `tasklist` (active) or `archive` (archived)
- Project in task: `git-pull-request` with color based on PR status
- No PR: `git-branch`
- Registered project: `repo`
- Slack thread: `comment-discussion`

### Refresh Pattern

```typescript
// Trigger refresh from anywhere:
sidebarProvider.refresh();

// Internally fires event:
this._onDidChangeTreeData.fire();
```

## Polling (polling.ts)

Background polling for PR/CI status updates.

### Behavior

- Polls every `config.pollingInterval` seconds (default 300)
- Only polls when window is focused
- Skips if another poll is in progress
- Updates task PR info from GitHub API
- Sends VS Code notifications on status changes:
  - PR approved
  - CI failed
  - PR merged

### Notification Configuration

```typescript
// Settings in package.json:
"grove.notifications.prApproved": true
"grove.notifications.ciFailed": true
"grove.notifications.prMerged": true
```

### Usage

```typescript
const polling = new GrovePolling(context, sidebarProvider, statusBar);
polling.start();    // Start interval polling
polling.stop();     // Stop polling
polling.refreshNow(); // Manual immediate refresh
```

## Status Bar (statusbar.ts)

Shows current task status in the VS Code status bar.

### Display Format

```
$(tasklist) PROJ-123 | 2 PRs | CI: ✓
```

### Update Triggers

- Task changes
- PR status changes
- Manual refresh

## Dashboard (dashboard.ts)

Webview panel showing visual task dashboard.

### Features

- Visual task cards
- PR/CI status overview
- Quick actions

### Webview Communication

```typescript
// Extension → Webview:
panel.webview.postMessage({ type: 'update', tasks: [...] });

// Webview → Extension:
panel.webview.onDidReceiveMessage(message => {
  if (message.type === 'openTask') { ... }
});
```

## Common Modifications

### Adding a new tree item type

1. Add to `TreeItemType` union in `sidebar.ts`
2. Add to `GroveTreeItemData` interface
3. Add `setupXxx()` method in `GroveTreeItem` class
4. Handle in `switch` statement in `setupItem()`
5. Add to `getTaskChildren()` or appropriate parent method

### Adding a notification type

1. Add setting in `package.json` contributes.configuration
2. Add check in `sendNotifications()` in `polling.ts`

### Adding a status bar element

1. Modify `GroveStatusBar` in `statusbar.ts`
2. Update display in `update()` method

---
*Last updated: 2026-02-03*
