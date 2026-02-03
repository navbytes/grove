# Webview Dashboard Knowledge

> **Auto-update trigger**: Update this file when modifying any file in `webview-ui/`.

## Overview

The webview dashboard is a Svelte 5 application that runs inside a VS Code webview panel. It provides a visual interface for task management.

## Directory Structure

```
webview-ui/
├── src/
│   ├── App.svelte              # Main dashboard component
│   ├── main.ts                 # Entry point
│   ├── vscode.ts               # VS Code API wrapper
│   ├── types.ts                # Type definitions
│   ├── components/
│   │   ├── Header.svelte       # Dashboard header
│   │   ├── TaskCard.svelte     # Task card component
│   │   ├── ProjectRow.svelte   # Project row in task card
│   │   ├── StatusBadge.svelte  # PR/CI status badges
│   │   └── EmptyState.svelte   # Empty state display
│   └── styles/
│       └── global.css          # Global styles
├── vite.config.ts              # Vite build config
├── tsconfig.json               # TypeScript config
└── package.json                # Dependencies
```

## Build System

- **Bundler**: Vite
- **Framework**: Svelte 5 (runes mode with `$state`, `$derived`)
- **Output**: `webview-ui/build/`

### Build Commands

```bash
# Development (watch mode)
npm run watch:webview

# Production build
npm run build:webview
```

## Component Architecture

### App.svelte (Main Component)

```svelte
<script lang="ts">
  let data = $state<DashboardData>({ tasks: [] });
  let loading = $state(true);
  let filter = $state<'all' | 'active' | 'archived'>('active');

  // Derived state
  const filteredTasks = $derived(() => {
    if (filter === 'all') return data.tasks;
    return data.tasks.filter((t) => t.status === filter);
  });
</script>
```

### Data Flow

```
Extension (dashboard.ts)
    │
    ├── postMessage({ type: 'update', data: {...} })
    │
    ↓
Webview (App.svelte)
    │
    ├── handleMessage() → updates $state
    │
    ↓
Components (TaskCard, etc.)
    │
    ├── User action → vscode.postMessage({ type: 'openTask', ... })
    │
    ↓
Extension (handles message)
```

## Message Types

### Extension → Webview

```typescript
type MessageToWebview =
  | { type: 'update'; data: DashboardData }
  | { type: 'loading'; loading: boolean };

interface DashboardData {
  tasks: Task[];
  currentTaskId?: string;  // Currently open task
}
```

### Webview → Extension

```typescript
type MessageToExtension =
  | { type: 'openTask'; taskId: string }
  | { type: 'archiveTask'; taskId: string }
  | { type: 'deleteTask'; taskId: string }
  | { type: 'newTask' }
  | { type: 'openJira'; taskId: string }
  | { type: 'openPR'; taskId: string; projectName: string }
  | { type: 'openCI'; taskId: string; projectName: string }
  | { type: 'openSlack'; url: string }
  | { type: 'openLink'; url: string }
  | { type: 'createPR'; taskId: string; projectName: string }
  | { type: 'refresh' }
  | { type: 'ready' };
```

## VS Code API Wrapper (vscode.ts)

```typescript
class VSCodeAPI {
  // Send message to extension
  postMessage(message: MessageToExtension): void

  // Get persisted state (survives webview hide/show)
  getState(): DashboardData | undefined

  // Save state
  setState(state: DashboardData): void
}

export const vscode = new VSCodeAPI();
```

## Components

### TaskCard.svelte

Displays a single task with:
- Task ID and title
- Jira link
- List of projects with PR/CI status
- Slack threads
- External links
- Action buttons

### ProjectRow.svelte

Displays a project within a task:
- Project name
- Branch name
- PR status badge
- CI status badge
- Action buttons (Open PR, Open CI, Create PR)

### StatusBadge.svelte

Status indicator with colors:
- PR Status: open (blue), merged (green), closed (red), draft (gray)
- Review Status: approved (green), changes_requested (yellow), pending (gray)
- CI Status: passed (green), failed (red), running (yellow), pending (gray)

## Styling

Uses VS Code's CSS variables for theme compatibility:

```css
/* Common variables */
--vscode-foreground
--vscode-descriptionForeground
--vscode-editor-background
--vscode-input-background
--vscode-panel-border
--vscode-badge-background
--vscode-badge-foreground

/* Custom Grove variable */
--grove-green: #4ade80;
```

## State Management

Uses Svelte 5 runes:

```svelte
<script lang="ts">
  // Reactive state
  let data = $state<DashboardData>({ tasks: [] });

  // Derived values (computed)
  const activeTasks = $derived(
    data.tasks.filter((t) => t.status === 'active')
  );

  // Derived function (when you need to call it)
  const sortedTasks = $derived(() => {
    return filteredTasks().sort(...);
  });
</script>
```

## Adding a New Component

1. Create `webview-ui/src/components/MyComponent.svelte`
2. Import in parent component
3. Add props with TypeScript

```svelte
<script lang="ts">
  interface Props {
    task: Task;
    onAction: (action: string) => void;
  }

  let { task, onAction }: Props = $props();
</script>

<div>
  {task.id}
  <button onclick={() => onAction('clicked')}>Action</button>
</div>
```

## Adding a New Message Type

1. Add to `MessageToExtension` or `MessageToWebview` in `webview-ui/src/types.ts`
2. Handle in `App.svelte` (for incoming) or `dashboard.ts` (for outgoing)
3. Keep types in sync with extension

## Important Notes

- Types in `webview-ui/src/types.ts` must match `src/core/types.ts`
- Webview state persists across hide/show but not restart
- Always use VS Code CSS variables for theming

---
*Last updated: 2026-02-03*
