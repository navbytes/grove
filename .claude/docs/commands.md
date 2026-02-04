# Commands Knowledge

> **Auto-update trigger**: Update this file when modifying `src/extension/commands.ts` or adding commands to `package.json`.

## Overview

All commands are registered in `src/extension/commands.ts` via `registerCommands()`. Command metadata is declared in `package.json` under `contributes.commands`.

## Command Reference

### Setup & Configuration

| Command ID | Title | Description |
|------------|-------|-------------|
| `grove.setup` | Grove: Setup | Multi-step setup wizard |
| `grove.registerProject` | Grove: Register Project | Add a git repo to Grove |
| `grove.removeProject` | Grove: Remove Project | Unregister a project |
| `grove.listProjects` | Grove: List Projects | Show all registered projects |
| `grove.editSettings` | Grove: Edit Settings | Open settings editor |
| `grove.configureWorktreeSetup` | Grove: Configure Worktree Setup | Configure files to copy/symlink and commands to run when creating worktrees |

### Task Management

| Command ID | Title | Description |
|------------|-------|-------------|
| `grove.newTask` | Grove: New Task | Create task with worktrees |
| `grove.openTask` | Grove: Open Task | Open task workspace |
| `grove.listTasks` | Grove: List Tasks | Show all tasks |
| `grove.archiveTask` | Grove: Archive Task | Archive (optionally cleanup) |
| `grove.deleteTask` | Grove: Delete Task | Permanently delete task |

### Project in Task

| Command ID | Title | Description |
|------------|-------|-------------|
| `grove.addProject` | Grove: Add Project to Task | Add project to current task |
| `grove.removeProjectFromTask` | Grove: Remove Project from Task | Remove project from task |

### PR & CI

| Command ID | Title | Description |
|------------|-------|-------------|
| `grove.createPR` | Grove: Create PR | Create GitHub PR |
| `grove.linkPR` | Grove: Link PR | Auto-detect and link existing PR by branch |
| `grove.openPR` | Grove: Open PR | Open PR in browser |
| `grove.openCI` | Grove: Open CI | Open CI status page |
| `grove.refreshStatus` | Grove: Refresh Status | Manual status refresh |

### Context & Notes

| Command ID | Title | Description |
|------------|-------|-------------|
| `grove.taskNotes` | Grove: Task Notes | Open .grove-context.md |
| `grove.updateContextFile` | Grove: Update Context File | Regenerate context file |

### Slack Threads

| Command ID | Title | Description |
|------------|-------|-------------|
| `grove.addSlackThread` | Grove: Add Slack Thread | Link Slack discussion |
| `grove.removeSlackThread` | Grove: Remove Slack Thread | Unlink Slack thread |
| `grove.openSlackThread` | Grove: Open Slack Thread | Open thread in browser |

### Links (Confluence, Notion, etc.)

| Command ID | Title | Description |
|------------|-------|-------------|
| `grove.addLink` | Grove: Add Link | Add external link |
| `grove.removeLink` | Grove: Remove Link | Remove link |
| `grove.openLink` | Grove: Open Link | Open link in browser |

### Sidebar & Dashboard

| Command ID | Title | Description |
|------------|-------|-------------|
| `grove.refreshSidebar` | Grove: Refresh Sidebar | Refresh tree view |
| `grove.openTaskFromSidebar` | - | Internal: open task by ID |
| `grove.openDashboard` | Grove: Open Dashboard | Show webview dashboard |
| `grove.openJira` | Grove: Open Jira | Open Jira ticket |

## Helper Functions

### getCurrentTask()

```typescript
function getCurrentTask(): Task | null
```
Returns the task associated with the current workspace, or `null` if not in a Grove workspace.

### getCurrentProject(task)

```typescript
function getCurrentProject(task: Task): TaskProject | null
```
Returns the project based on active editor's file path.

## Command Implementation Pattern

```typescript
// 1. Registration in registerCommands():
context.subscriptions.push(
  vscode.commands.registerCommand('grove.myCommand', () =>
    myCommandHandler().then(() => sidebarProvider.refresh())
  )
);

// 2. Handler function:
async function myCommandHandler(): Promise<void> {
  // Check context
  const task = getCurrentTask();
  if (!task) {
    vscode.window.showWarningMessage('This command is only available in a Grove task workspace.');
    return;
  }

  // Show QuickPick for selection
  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select something',
  });
  if (!selected) return;

  // Show confirmation if destructive
  const confirm = await vscode.window.showWarningMessage(
    'Are you sure?',
    { modal: true },
    'Confirm'
  );
  if (confirm !== 'Confirm') return;

  // Perform action
  const result = await coreFunction();
  if (!result.success) {
    vscode.window.showErrorMessage(`Failed: ${result.error}`);
    return;
  }

  vscode.window.showInformationMessage('Success!');
}
```

## Adding a New Command

1. **Add command metadata to `package.json`**:
   ```json
   {
     "contributes": {
       "commands": [
         {
           "command": "grove.myCommand",
           "title": "Grove: My Command"
         }
       ]
     }
   }
   ```

2. **Add handler in `commands.ts`**:
   ```typescript
   // In registerCommands():
   context.subscriptions.push(
     vscode.commands.registerCommand('grove.myCommand', () =>
       myCommandHandler().then(() => sidebarProvider.refresh())
     )
   );

   // Handler function at bottom of file:
   async function myCommandHandler(): Promise<void> {
     // Implementation
   }
   ```

3. **Add to context menu (optional)** in `package.json`:
   ```json
   {
     "contributes": {
       "menus": {
         "view/item/context": [
           {
             "command": "grove.myCommand",
             "when": "view == groveExplorer && viewItem == activeTask"
           }
         ]
       }
     }
   }
   ```

## Context Menu Bindings

Commands can appear in context menus based on `viewItem`:

| viewItem | Meaning |
|----------|---------|
| `activeTask` | Right-click on active task |
| `archivedTask` | Right-click on archived task |
| `taskProject` | Right-click on project in task |
| `registeredProject` | Right-click on registered project |
| `slackThread` | Right-click on Slack thread |

---
*Last updated: 2026-02-03*
