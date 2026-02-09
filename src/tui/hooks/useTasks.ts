import { useCallback, useEffect, useState } from 'react';
import { loadTasks } from '../../core/tasks.js';
import type { Task } from '../../core/types.js';

interface UseTasksReturn {
  tasks: Task[];
  activeTasks: Task[];
  archivedTasks: Task[];
  loading: boolean;
  reload: () => Promise<void>;
}

export function useTasks(): UseTasksReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const loaded = await loadTasks();
    setTasks(loaded);
    setLoading(false);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const activeTasks = tasks.filter((t) => t.status === 'active');
  const archivedTasks = tasks.filter((t) => t.status === 'archived');

  return { tasks, activeTasks, archivedTasks, loading, reload };
}
