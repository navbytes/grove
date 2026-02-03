<script lang="ts">
  import type { PRStatus, ReviewStatus, CIStatus } from '../types';

  interface Props {
    type: 'pr' | 'review' | 'ci';
    status: PRStatus | ReviewStatus | CIStatus | undefined;
  }

  let { type, status }: Props = $props();

  const getIcon = () => {
    if (type === 'pr') {
      switch (status) {
        case 'merged':
          return '⬤';
        case 'closed':
          return '✕';
        case 'draft':
          return '◯';
        default:
          return '◉';
      }
    }
    if (type === 'review') {
      switch (status) {
        case 'approved':
          return '✓';
        case 'changes_requested':
          return '✗';
        case 'pending':
          return '○';
        default:
          return '';
      }
    }
    if (type === 'ci') {
      switch (status) {
        case 'passed':
          return '✓';
        case 'failed':
          return '✗';
        case 'running':
          return '◐';
        case 'pending':
          return '○';
        default:
          return '';
      }
    }
    return '';
  };

  const getClass = () => {
    if (type === 'pr') {
      switch (status) {
        case 'merged':
          return 'badge-purple';
        case 'closed':
          return 'badge-red';
        case 'draft':
          return 'badge-gray';
        default:
          return 'badge-green';
      }
    }
    if (type === 'review') {
      switch (status) {
        case 'approved':
          return 'badge-green';
        case 'changes_requested':
          return 'badge-red';
        default:
          return 'badge-yellow';
      }
    }
    if (type === 'ci') {
      switch (status) {
        case 'passed':
          return 'badge-green';
        case 'failed':
          return 'badge-red';
        case 'running':
          return 'badge-blue spinning';
        default:
          return 'badge-yellow';
      }
    }
    return '';
  };

  const getLabel = () => {
    if (!status) return '';
    if (type === 'pr') return status.toUpperCase();
    if (type === 'review') {
      switch (status) {
        case 'approved':
          return 'Approved';
        case 'changes_requested':
          return 'Changes';
        case 'pending':
          return 'Pending';
        default:
          return '';
      }
    }
    if (type === 'ci') {
      switch (status) {
        case 'passed':
          return 'Passed';
        case 'failed':
          return 'Failed';
        case 'running':
          return 'Running';
        case 'pending':
          return 'Pending';
        default:
          return '';
      }
    }
    return '';
  };
</script>

{#if status}
  <span class="badge {getClass()}">
    <span class="icon">{getIcon()}</span>
    <span class="label">{getLabel()}</span>
  </span>
{/if}

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.025em;
  }

  .icon {
    font-size: 10px;
  }

  .badge-green {
    background-color: rgba(34, 197, 94, 0.2);
    color: #22c55e;
  }

  .badge-red {
    background-color: rgba(239, 68, 68, 0.2);
    color: #ef4444;
  }

  .badge-yellow {
    background-color: rgba(234, 179, 8, 0.2);
    color: #eab308;
  }

  .badge-purple {
    background-color: rgba(168, 85, 247, 0.2);
    color: #a855f7;
  }

  .badge-blue {
    background-color: rgba(59, 130, 246, 0.2);
    color: #3b82f6;
  }

  .badge-gray {
    background-color: rgba(107, 114, 128, 0.2);
    color: #6b7280;
  }

  .spinning .icon {
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
