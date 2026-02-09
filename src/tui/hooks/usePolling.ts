import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchFullPRStatus, getGitHubAuth, isGitHubConfigured } from '../../core/github.js';
import { getActiveTasks, loadTasks, saveTasks } from '../../core/tasks.js';

interface UsePollingReturn {
  refreshing: boolean;
  lastRefresh: Date | null;
  refresh: () => Promise<void>;
}

export function usePolling(interval: number, onRefresh: () => Promise<void>): UsePollingReturn {
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const configured = await isGitHubConfigured();
      if (!configured) {
        setRefreshing(false);
        return;
      }

      const auth = await getGitHubAuth();
      if (!auth) {
        setRefreshing(false);
        return;
      }

      const activeTasks = await getActiveTasks();
      if (activeTasks.length === 0) {
        setRefreshing(false);
        setLastRefresh(new Date());
        return;
      }

      const allTasks = await loadTasks();

      for (const task of activeTasks) {
        for (const project of task.projects) {
          const result = await fetchFullPRStatus(project.name, project.branch, auth);
          if (result.success && result.data) {
            project.pr = result.data;
          }
        }
        task.updatedAt = new Date().toISOString();
        const idx = allTasks.findIndex((t) => t.id === task.id);
        if (idx !== -1) {
          allTasks[idx] = task;
        }
      }

      await saveTasks(allTasks);
      await onRefresh();
      setLastRefresh(new Date());
    } catch {
      // Swallow errors in polling — dashboard stays up
    }
    setRefreshing(false);
  }, [onRefresh]);

  useEffect(() => {
    if (interval > 0) {
      timerRef.current = setInterval(refresh, interval * 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [interval, refresh]);

  return { refreshing, lastRefresh, refresh };
}
