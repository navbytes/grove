<script lang="ts">
  import type { TaskProject } from '../types';
  import { vscode } from '../vscode';
  import StatusBadge from './StatusBadge.svelte';

  interface Props {
    project: TaskProject;
    taskId: string;
  }

  let { project, taskId }: Props = $props();

  const handleOpenPR = () => {
    if (project.pr) {
      vscode.postMessage({
        type: 'openPR',
        taskId,
        projectName: project.name,
      });
    }
  };

  const handleCreatePR = () => {
    vscode.postMessage({
      type: 'createPR',
      taskId,
      projectName: project.name,
    });
  };

  const handleLinkPR = () => {
    vscode.postMessage({
      type: 'linkPR',
      taskId,
      projectName: project.name,
    });
  };

  const handleOpenCI = () => {
    if (project.pr) {
      vscode.postMessage({
        type: 'openCI',
        taskId,
        projectName: project.name,
      });
    }
  };
</script>

<div class="project-row">
  <div class="project-info">
    <div class="project-name">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path
          d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"
        />
      </svg>
      <span>{project.name}</span>
    </div>
    <div class="branch-name">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6zM6 21a3 3 0 100-6 3 3 0 000 6zM18 9a9 9 0 01-9 9" />
      </svg>
      <code>{project.branch}</code>
    </div>
  </div>

  <div class="project-status">
    {#if project.pr}
      <button class="status-btn" onclick={handleOpenPR} title="Open PR #{project.pr.number}">
        <span class="pr-number">#{project.pr.number}</span>
        <StatusBadge type="pr" status={project.pr.status} />
      </button>

      <StatusBadge type="review" status={project.pr.reviewStatus} />

      <button
        class="status-btn"
        onclick={handleOpenCI}
        title="Open CI"
      >
        <StatusBadge type="ci" status={project.pr.ciStatus} />
      </button>
    {:else}
      <button class="btn-link-pr" onclick={handleLinkPR} title="Link existing PR by branch">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
        Link PR
      </button>
      <button class="btn-create-pr" onclick={handleCreatePR} title="Create new PR">
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Create PR
      </button>
    {/if}
  </div>
</div>

<style>
  .project-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    background-color: var(--vscode-list-hoverBackground);
    border-radius: 6px;
    transition: background-color 0.15s ease;
  }

  .project-row:hover {
    background-color: var(--vscode-list-activeSelectionBackground);
  }

  .project-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
    flex: 1;
  }

  .project-name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 500;
    color: var(--vscode-foreground);
  }

  .project-name svg {
    flex-shrink: 0;
    color: var(--vscode-descriptionForeground);
  }

  .project-name span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .branch-name {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
  }

  .branch-name svg {
    flex-shrink: 0;
  }

  .branch-name code {
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .project-status {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .status-btn {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .status-btn:hover:not(:disabled) {
    background-color: var(--vscode-toolbar-hoverBackground);
  }

  .status-btn:disabled {
    cursor: default;
  }

  .pr-number {
    font-family: var(--vscode-editor-font-family);
    font-size: 12px;
    font-weight: 500;
    color: var(--vscode-textLink-foreground);
  }

  .btn-create-pr,
  .btn-link-pr {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background-color: var(--vscode-button-secondaryBackground);
    color: var(--vscode-button-secondaryForeground);
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .btn-create-pr:hover,
  .btn-link-pr:hover {
    background-color: var(--vscode-button-secondaryHoverBackground);
  }

  .btn-create-pr svg,
  .btn-link-pr svg {
    flex-shrink: 0;
  }
</style>
