<script lang="ts">
  import { onMount } from 'svelte';
  import type {
    DashboardData,
    MessageToWebview,
    SetupMessageToWebview,
    SetupConfig,
    Task,
    GitProvider,
  } from './types';
  import { vscode } from './vscode';
  import Header from './components/Header.svelte';
  import TaskCard from './components/TaskCard.svelte';
  import EmptyState from './components/EmptyState.svelte';
  import SetupForm from './components/SetupForm.svelte';

  // Mode detection
  let mode = $state<'dashboard' | 'setup'>('dashboard');

  // Dashboard state
  let data = $state<DashboardData>({ tasks: [] });
  let loading = $state(true);
  let filter = $state<'all' | 'active' | 'archived'>('active');

  // Setup state
  let setupConfig = $state<SetupConfig | undefined>(undefined);
  let setupFormRef: SetupForm | undefined = $state(undefined);

  // Restore state if available
  onMount(() => {
    const savedState = vscode.getState();
    if (savedState) {
      mode = savedState.mode || 'dashboard';
      if (savedState.dashboardData) {
        data = savedState.dashboardData;
        loading = false;
      }
      if (savedState.setupConfig) {
        setupConfig = savedState.setupConfig;
      }
    }

    // Listen for messages from extension
    window.addEventListener('message', handleMessage);

    // Tell extension we're ready
    vscode.postMessage({ type: 'ready' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  });

  const handleMessage = (event: MessageEvent<MessageToWebview | SetupMessageToWebview>) => {
    const message = event.data;

    // Dashboard messages
    if (message.type === 'update') {
      mode = 'dashboard';
      data = message.data;
      vscode.setState({ mode: 'dashboard', dashboardData: data });
      loading = false;
    } else if (message.type === 'loading') {
      loading = message.loading;
    }
    // Setup messages
    else if (message.type === 'init') {
      mode = 'setup';
      setupConfig = message.config;
      vscode.setState({ mode: 'setup', setupConfig });
      loading = false;
    } else if (message.type === 'jiraTestResult') {
      setupFormRef?.setJiraTestResult(message.result);
    } else if (message.type === 'gitTestResult') {
      setupFormRef?.setGitTestResult(message.result);
    } else if (message.type === 'folderSelected') {
      setupFormRef?.setWorkspaceDir(message.path);
    } else if (message.type === 'saved') {
      setupFormRef?.setSaving(false);
      // The extension will close the panel or switch to dashboard
    } else if (message.type === 'error') {
      setupFormRef?.setSaving(false);
      // Could show an error toast here
    }
  };

  // Dashboard computed values
  const filteredTasks = $derived(() => {
    if (filter === 'all') return data.tasks;
    return data.tasks.filter((t) => t.status === filter);
  });

  const activeTasks = $derived(data.tasks.filter((t) => t.status === 'active'));
  const archivedTasks = $derived(
    data.tasks.filter((t) => t.status === 'archived')
  );

  const sortedTasks = $derived(() => {
    const tasks = filteredTasks();
    // Sort: current task first, then by date
    return tasks.sort((a, b) => {
      if (a.id === data.currentTaskId) return -1;
      if (b.id === data.currentTaskId) return 1;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  });

  // Setup handlers
  function handleSetupSave(config: SetupConfig, gitToken?: string, jiraToken?: string) {
    vscode.postMessage({
      type: 'save',
      data: { config, gitToken, jiraToken },
    });
  }

  function handleSetupSkip() {
    vscode.postMessage({ type: 'skip' });
  }

  function handleTestJira(baseUrl: string, email: string, token: string) {
    vscode.postMessage({ type: 'testJira', baseUrl, email, token });
  }

  function handleTestGit(provider: GitProvider, baseUrl: string, org: string, token: string) {
    vscode.postMessage({ type: 'testGit', provider, baseUrl, org, token });
  }

  function handleOpenExternal(url: string) {
    vscode.postMessage({ type: 'openExternal', url });
  }

  function handleBrowseFolder() {
    vscode.postMessage({ type: 'browseFolder' });
  }
</script>

{#if mode === 'setup'}
  <div class="setup-container">
    <SetupForm
      bind:this={setupFormRef}
      initialConfig={setupConfig}
      onSave={handleSetupSave}
      onSkip={handleSetupSkip}
      onTestJira={handleTestJira}
      onTestGit={handleTestGit}
      onOpenExternal={handleOpenExternal}
      onBrowseFolder={handleBrowseFolder}
    />
  </div>
{:else}
  <div class="dashboard">
    <Header taskCount={activeTasks.length} {loading} />

    {#if loading && data.tasks.length === 0}
      <div class="loading-state">
        <div class="spinner"></div>
        <p>Loading tasks...</p>
      </div>
    {:else if data.tasks.length === 0}
      <EmptyState />
    {:else}
      <div class="filter-tabs">
        <button
          class="tab"
          class:active={filter === 'active'}
          onclick={() => (filter = 'active')}
        >
          Active
          <span class="count">{activeTasks.length}</span>
        </button>
        <button
          class="tab"
          class:active={filter === 'archived'}
          onclick={() => (filter = 'archived')}
        >
          Archived
          <span class="count">{archivedTasks.length}</span>
        </button>
        <button
          class="tab"
          class:active={filter === 'all'}
          onclick={() => (filter = 'all')}
        >
          All
          <span class="count">{data.tasks.length}</span>
        </button>
      </div>

      <div class="task-list">
        {#each sortedTasks() as task (task.id)}
          <TaskCard {task} isCurrent={task.id === data.currentTaskId} />
        {/each}

        {#if sortedTasks().length === 0}
          <div class="no-results">
            <p>No {filter} tasks found.</p>
          </div>
        {/if}
      </div>
    {/if}
  </div>
{/if}

<style>
  .setup-container {
    min-height: 100%;
    padding: 24px;
  }

  .dashboard {
    max-width: 800px;
    margin: 0 auto;
  }

  .loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 64px 24px;
    gap: 16px;
  }

  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid var(--vscode-panel-border);
    border-top-color: var(--grove-green);
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-state p {
    color: var(--vscode-descriptionForeground);
  }

  .filter-tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
    padding: 4px;
    background-color: var(--vscode-input-background);
    border-radius: 8px;
    width: fit-content;
  }

  .tab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--vscode-descriptionForeground);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .tab:hover {
    color: var(--vscode-foreground);
  }

  .tab.active {
    background-color: var(--vscode-editor-background);
    color: var(--vscode-foreground);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  .tab .count {
    font-size: 11px;
    padding: 2px 6px;
    background-color: var(--vscode-badge-background);
    color: var(--vscode-badge-foreground);
    border-radius: 10px;
  }

  .tab.active .count {
    background-color: rgba(74, 222, 128, 0.2);
    color: var(--grove-green);
  }

  .task-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .no-results {
    padding: 48px 24px;
    text-align: center;
    color: var(--vscode-descriptionForeground);
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
