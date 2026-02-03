<script lang="ts">
  import { vscode } from '../vscode';

  const handleNewTask = () => {
    vscode.postMessage({ type: 'newTask' });
  };
</script>

<div class="empty-state">
  <div class="illustration">
    <svg width="120" height="120" viewBox="0 0 128 128" fill="none">
      <defs>
        <linearGradient id="tree1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#4ade80" stop-opacity="0.6" />
          <stop offset="100%" stop-color="#16a34a" stop-opacity="0.6" />
        </linearGradient>
        <linearGradient id="tree2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#4ade80" stop-opacity="0.8" />
          <stop offset="100%" stop-color="#16a34a" stop-opacity="0.8" />
        </linearGradient>
        <linearGradient id="tree3" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#4ade80" />
          <stop offset="100%" stop-color="#16a34a" />
        </linearGradient>
      </defs>
      <!-- Left tree -->
      <path
        fill="url(#tree1)"
        d="M 26 83 L 38 53 L 32 53 L 44 28 L 56 53 L 50 53 L 62 83 Z"
        opacity="0.6"
      />
      <!-- Center tree -->
      <path
        fill="url(#tree2)"
        d="M 46 83 L 58 48 L 52 48 L 64 20 L 76 48 L 70 48 L 82 83 Z"
        opacity="0.8"
      />
      <!-- Right tree -->
      <path
        fill="url(#tree3)"
        d="M 66 83 L 78 53 L 72 53 L 84 28 L 96 53 L 90 53 L 102 83 Z"
      />
      <!-- Ground -->
      <rect x="14" y="83" width="100" height="8" rx="4" fill="#16a34a" />
      <!-- Trunks -->
      <rect x="40" y="83" width="8" height="12" fill="#854d0e" />
      <rect x="60" y="83" width="8" height="12" fill="#854d0e" />
      <rect x="80" y="83" width="8" height="12" fill="#854d0e" />
    </svg>
  </div>

  <h2>No tasks yet</h2>
  <p>
    Create your first task to start managing your multi-repo workflow with
    isolated git worktrees.
  </p>

  <button class="btn-cta" onclick={handleNewTask}>
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
    Create Your First Task
  </button>

  <div class="features">
    <div class="feature">
      <div class="feature-icon">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M6 3v12M18 9a3 3 0 100-6 3 3 0 000 6z" />
          <path d="M6 21a3 3 0 100-6 3 3 0 000 6z" />
          <path d="M18 9a9 9 0 01-9 9" />
        </svg>
      </div>
      <div class="feature-text">
        <strong>Isolated Worktrees</strong>
        <span>Work on multiple tasks without stashing</span>
      </div>
    </div>

    <div class="feature">
      <div class="feature-icon">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          <path d="M15 3h6v6" />
          <path d="M10 14L21 3" />
        </svg>
      </div>
      <div class="feature-text">
        <strong>PR & CI Tracking</strong>
        <span>Monitor status across all your repos</span>
      </div>
    </div>

    <div class="feature">
      <div class="feature-icon">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <path d="M3 9h18M9 21V9" />
        </svg>
      </div>
      <div class="feature-text">
        <strong>Jira Integration</strong>
        <span>Link tickets and track progress</span>
      </div>
    </div>
  </div>
</div>

<style>
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 48px 24px;
    min-height: 400px;
  }

  .illustration {
    margin-bottom: 24px;
    opacity: 0.9;
  }

  h2 {
    font-size: 20px;
    font-weight: 600;
    color: var(--vscode-foreground);
    margin-bottom: 8px;
  }

  p {
    font-size: 14px;
    color: var(--vscode-descriptionForeground);
    max-width: 360px;
    margin-bottom: 24px;
    line-height: 1.6;
  }

  .btn-cta {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 24px;
    background: linear-gradient(135deg, #4ade80, #16a34a);
    color: #000;
    border: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: 600;
    cursor: pointer;
    transition: opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
    box-shadow: 0 4px 12px rgba(74, 222, 128, 0.3);
  }

  .btn-cta:hover {
    opacity: 0.95;
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(74, 222, 128, 0.4);
  }

  .btn-cta:active {
    transform: translateY(0);
  }

  .features {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin-top: 48px;
    width: 100%;
    max-width: 320px;
  }

  .feature {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    text-align: left;
  }

  .feature-icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(74, 222, 128, 0.1);
    border-radius: 8px;
    color: var(--grove-green);
  }

  .feature-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .feature-text strong {
    font-size: 13px;
    font-weight: 600;
    color: var(--vscode-foreground);
  }

  .feature-text span {
    font-size: 12px;
    color: var(--vscode-descriptionForeground);
  }
</style>
