<script lang="ts">
  import { vscode } from '../vscode';

  interface Props {
    taskCount: number;
    loading: boolean;
  }

  let { taskCount, loading }: Props = $props();

  const handleNewTask = () => {
    vscode.postMessage({ type: 'newTask' });
  };

  const handleRefresh = () => {
    vscode.postMessage({ type: 'refresh' });
  };
</script>

<header class="header">
  <div class="header-left">
    <div class="logo">
      <svg width="24" height="24" viewBox="0 0 128 128" fill="none">
        <defs>
          <linearGradient id="tree-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stop-color="#4ade80" />
            <stop offset="100%" stop-color="#16a34a" />
          </linearGradient>
        </defs>
        <path
          fill="url(#tree-gradient)"
          d="M 46 83 L 58 48 L 52 48 L 64 20 L 76 48 L 70 48 L 82 83 Z"
        />
        <rect x="58" y="83" width="12" height="16" fill="#854d0e" />
      </svg>
      <span class="logo-text">Grove</span>
    </div>
    <span class="task-count">{taskCount} task{taskCount !== 1 ? 's' : ''}</span>
  </div>

  <div class="header-actions">
    <button
      class="btn-icon"
      onclick={handleRefresh}
      title="Refresh"
      disabled={loading}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        class:spinning={loading}
      >
        <path d="M23 4v6h-6M1 20v-6h6" />
        <path
          d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"
        />
      </svg>
    </button>
    <button class="btn-primary" onclick={handleNewTask}>
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
      >
        <path d="M12 5v14M5 12h14" />
      </svg>
      New Task
    </button>
  </div>
</header>

<style>
  .header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 16px;
    margin-bottom: 16px;
    border-bottom: 1px solid var(--vscode-panel-border);
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .logo-text {
    font-size: 18px;
    font-weight: 600;
    color: var(--vscode-foreground);
  }

  .task-count {
    font-size: 13px;
    color: var(--vscode-descriptionForeground);
    padding: 4px 10px;
    background-color: var(--vscode-badge-background);
    border-radius: 12px;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-icon {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: var(--vscode-foreground);
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .btn-icon:hover:not(:disabled) {
    background-color: var(--vscode-toolbar-hoverBackground);
  }

  .btn-icon:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-primary {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    background: linear-gradient(135deg, #4ade80, #16a34a);
    color: #000;
    border: none;
    border-radius: 6px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s ease, transform 0.15s ease;
  }

  .btn-primary:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  .btn-primary:active {
    transform: translateY(0);
  }

  .spinning {
    animation: spin 1s linear infinite;
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
