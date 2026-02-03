<script lang="ts">
  import type { Task, LinkType } from '../types';
  import { vscode } from '../vscode';
  import StatusBadge from './StatusBadge.svelte';
  import ProjectRow from './ProjectRow.svelte';

  interface Props {
    task: Task;
    isCurrent: boolean;
  }

  let { task, isCurrent }: Props = $props();

  let expanded = $state(isCurrent);

  // Get links array with fallback for backward compatibility
  const links = $derived(task.links || []);

  // Get icon for link type
  const getLinkIcon = (type: LinkType) => {
    switch (type) {
      case 'confluence':
        return '📘';
      case 'notion':
        return '📝';
      case 'google-docs':
        return '📄';
      case 'figma':
        return '🎨';
      default:
        return '🔗';
    }
  };

  const getLinkTypeLabel = (type: LinkType) => {
    switch (type) {
      case 'confluence':
        return 'Confluence';
      case 'notion':
        return 'Notion';
      case 'google-docs':
        return 'Google Docs';
      case 'figma':
        return 'Figma';
      default:
        return 'Link';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    if (days < 7) return `${days} days ago`;
    return date.toLocaleDateString();
  };

  const handleOpen = () => {
    vscode.postMessage({ type: 'openTask', taskId: task.id });
  };

  const handleArchive = () => {
    vscode.postMessage({ type: 'archiveTask', taskId: task.id });
  };

  const handleDelete = () => {
    vscode.postMessage({ type: 'deleteTask', taskId: task.id });
  };

  const handleOpenJira = () => {
    vscode.postMessage({ type: 'openJira', taskId: task.id });
  };

  const getOverallStatus = () => {
    const projects = task.projects;
    if (projects.length === 0) return 'empty';

    const hasPR = projects.some((p) => p.pr !== null);
    if (!hasPR) return 'no-pr';

    const allMerged = projects.every(
      (p) => !p.pr || p.pr.status === 'merged'
    );
    if (allMerged) return 'merged';

    const hasCIFailure = projects.some((p) => p.pr?.ciStatus === 'failed');
    if (hasCIFailure) return 'ci-failed';

    const allApproved = projects.every(
      (p) => !p.pr || p.pr.reviewStatus === 'approved'
    );
    if (allApproved) return 'approved';

    const hasChangesRequested = projects.some(
      (p) => p.pr?.reviewStatus === 'changes_requested'
    );
    if (hasChangesRequested) return 'changes-requested';

    return 'in-progress';
  };

  const statusClass = $derived(getOverallStatus());
</script>

<div class="task-card {statusClass}" class:current={isCurrent}>
  <div class="card-header">
    <button class="expand-btn" onclick={() => (expanded = !expanded)}>
      <span class="chevron" class:expanded>{expanded ? '▼' : '▶'}</span>
    </button>

    <div class="task-info" onclick={handleOpen} role="button" tabindex="0">
      <div class="task-title-row">
        {#if task.jiraTickets.length > 0}
          <span class="ticket-id">{task.jiraTickets[0]}</span>
        {/if}
        <span class="task-title">{task.title}</span>
        {#if isCurrent}
          <span class="current-badge">Current</span>
        {/if}
      </div>
      <div class="task-meta">
        <span class="date">{formatDate(task.createdAt)}</span>
        <span class="separator">•</span>
        <span class="project-count"
          >{task.projects.length} project{task.projects.length !== 1
            ? 's'
            : ''}</span
        >
        {#if task.slackThreads.length > 0}
          <span class="separator">•</span>
          <span class="slack-count"
            >{task.slackThreads.length} thread{task.slackThreads.length !== 1
              ? 's'
              : ''}</span
          >
        {/if}
        {#if links.length > 0}
          <span class="separator">•</span>
          <span class="link-count"
            >{links.length} link{links.length !== 1 ? 's' : ''}</span
          >
        {/if}
      </div>
    </div>

    <div class="card-actions">
      {#if task.jiraUrl}
        <button class="btn-icon" onclick={handleOpenJira} title="Open Jira">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
            />
          </svg>
        </button>
      {/if}
      {#if task.status === 'active'}
        <button class="btn-icon" onclick={handleArchive} title="Archive Task">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"
            />
          </svg>
        </button>
      {/if}
      <button class="btn-icon danger" onclick={handleDelete} title="Delete Task">
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
        </svg>
      </button>
    </div>
  </div>

  {#if expanded}
    <div class="card-body animate-fade-in">
      {#if task.projects.length > 0}
        <div class="projects-list">
          {#each task.projects as project}
            <ProjectRow {project} taskId={task.id} />
          {/each}
        </div>
      {:else}
        <div class="empty-state">
          <p>No projects in this task yet.</p>
        </div>
      {/if}

      {#if task.slackThreads.length > 0}
        <div class="slack-threads">
          <div class="section-label">Slack Threads</div>
          {#each task.slackThreads as thread}
            <button
              class="slack-link"
              onclick={() =>
                vscode.postMessage({ type: 'openSlack', url: thread.url })}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M14.5 10c-.83 0-1.5-.67-1.5-1.5v-5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5z"
                />
                <path
                  d="M20.5 10H19V8.5c0-.83.67-1.5 1.5-1.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"
                />
                <path
                  d="M9.5 14c.83 0 1.5.67 1.5 1.5v5c0 .83-.67 1.5-1.5 1.5S8 21.33 8 20.5v-5c0-.83.67-1.5 1.5-1.5z"
                />
                <path
                  d="M3.5 14H5v1.5c0 .83-.67 1.5-1.5 1.5S2 16.33 2 15.5 2.67 14 3.5 14z"
                />
                <path
                  d="M14 14.5c0-.83.67-1.5 1.5-1.5h5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-5c-.83 0-1.5-.67-1.5-1.5z"
                />
                <path
                  d="M15.5 19H14v1.5c0 .83.67 1.5 1.5 1.5s1.5-.67 1.5-1.5-.67-1.5-1.5-1.5z"
                />
                <path
                  d="M10 9.5C10 8.67 9.33 8 8.5 8h-5C2.67 8 2 8.67 2 9.5S2.67 11 3.5 11h5c.83 0 1.5-.67 1.5-1.5z"
                />
                <path
                  d="M8.5 5H10V3.5C10 2.67 9.33 2 8.5 2S7 2.67 7 3.5 7.67 5 8.5 5z"
                />
              </svg>
              <span>{thread.title || thread.url}</span>
            </button>
          {/each}
        </div>
      {/if}

      {#if links.length > 0}
        <div class="task-links">
          <div class="section-label">Related Links</div>
          {#each links as link}
            <button
              class="task-link"
              onclick={() =>
                vscode.postMessage({ type: 'openLink', url: link.url })}
              title={getLinkTypeLabel(link.type)}
            >
              <span class="link-icon">{getLinkIcon(link.type)}</span>
              <span class="link-text">{link.title || link.url}</span>
              <span class="link-type">{getLinkTypeLabel(link.type)}</span>
            </button>
          {/each}
        </div>
      {/if}

      {#if task.notes}
        <div class="notes-preview">
          <div class="section-label">Notes</div>
          <p>{task.notes.slice(0, 150)}{task.notes.length > 150 ? '...' : ''}</p>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .task-card {
    background-color: var(--vscode-editor-background);
    border: 1px solid var(--vscode-panel-border);
    border-radius: 8px;
    overflow: hidden;
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .task-card:hover {
    border-color: var(--vscode-focusBorder);
  }

  .task-card.current {
    border-color: var(--grove-green);
    box-shadow: 0 0 0 1px var(--grove-green);
  }

  /* Status indicator stripe */
  .task-card::before {
    content: '';
    display: block;
    height: 3px;
    background: var(--vscode-panel-border);
  }

  .task-card.merged::before {
    background: linear-gradient(90deg, #a855f7, #8b5cf6);
  }

  .task-card.approved::before {
    background: linear-gradient(90deg, #22c55e, #16a34a);
  }

  .task-card.ci-failed::before {
    background: linear-gradient(90deg, #ef4444, #dc2626);
  }

  .task-card.changes-requested::before {
    background: linear-gradient(90deg, #f59e0b, #d97706);
  }

  .task-card.in-progress::before {
    background: linear-gradient(90deg, #3b82f6, #2563eb);
  }

  .task-card.no-pr::before {
    background: linear-gradient(90deg, #6b7280, #4b5563);
  }

  .card-header {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 12px;
  }

  .expand-btn {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    padding: 0;
    margin-top: 2px;
  }

  .expand-btn:hover {
    color: var(--vscode-foreground);
  }

  .chevron {
    font-size: 10px;
    transition: transform 0.2s ease;
  }

  .task-info {
    flex: 1;
    min-width: 0;
    cursor: pointer;
  }

  .task-title-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .ticket-id {
    font-family: var(--vscode-editor-font-family);
    font-size: 12px;
    font-weight: 600;
    color: var(--grove-green);
    background-color: rgba(74, 222, 128, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .task-title {
    font-weight: 500;
    color: var(--vscode-foreground);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .current-badge {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--grove-green);
    background-color: rgba(74, 222, 128, 0.15);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .task-meta {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
  }

  .separator {
    opacity: 0.5;
  }

  .card-actions {
    display: flex;
    gap: 4px;
    flex-shrink: 0;
  }

  .btn-icon {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--vscode-descriptionForeground);
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .btn-icon:hover {
    background-color: var(--vscode-toolbar-hoverBackground);
    color: var(--vscode-foreground);
  }

  .btn-icon.danger:hover {
    color: var(--vscode-errorForeground);
  }

  .card-body {
    padding: 0 12px 12px 40px;
  }

  .projects-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .empty-state {
    padding: 16px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
    font-style: italic;
  }

  .section-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--vscode-descriptionForeground);
    margin-bottom: 8px;
    margin-top: 16px;
  }

  .slack-threads {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .slack-link {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    font-size: 13px;
    text-align: left;
  }

  .slack-link:hover {
    background-color: var(--vscode-list-hoverBackground);
  }

  .slack-link span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .notes-preview {
    margin-top: 8px;
  }

  .notes-preview p {
    font-size: 13px;
    color: var(--vscode-descriptionForeground);
    white-space: pre-wrap;
  }

  .task-links {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .task-link {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--vscode-textLink-foreground);
    cursor: pointer;
    font-size: 13px;
    text-align: left;
  }

  .task-link:hover {
    background-color: var(--vscode-list-hoverBackground);
  }

  .link-icon {
    flex-shrink: 0;
    font-size: 14px;
  }

  .link-text {
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .link-type {
    flex-shrink: 0;
    font-size: 11px;
    color: var(--vscode-descriptionForeground);
    background-color: var(--vscode-badge-background);
    padding: 2px 6px;
    border-radius: 3px;
  }
</style>
