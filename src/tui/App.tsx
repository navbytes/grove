import { Box, Text, useApp, useInput } from 'ink';
import _open from 'open';
import type React from 'react';
import { useCallback, useState } from 'react';
import type { Task } from '../core/types.js';
import { HelpOverlay } from './components/HelpOverlay.js';
import { StatusBar } from './components/StatusBar.js';
import { TaskDetail } from './components/TaskDetail.js';
import { TaskList } from './components/TaskList.js';
import { usePolling } from './hooks/usePolling.js';
import { useTasks } from './hooks/useTasks.js';

interface AppProps {
  pollingInterval: number;
}

export function App({ pollingInterval }: AppProps): React.ReactElement {
  const { exit } = useApp();
  const { activeTasks, archivedTasks, loading, reload } = useTasks();
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showArchived, setShowArchived] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const allVisibleTasks = showArchived ? [...activeTasks, ...archivedTasks] : activeTasks;
  const selectedTask: Task | null = allVisibleTasks[selectedIndex] ?? null;

  const onPollingRefresh = useCallback(async () => {
    await reload();
  }, [reload]);

  const { refreshing, lastRefresh, refresh } = usePolling(pollingInterval, onPollingRefresh);

  const showMsg = useCallback((msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(null), 3000);
  }, []);

  useInput((input, key) => {
    if (showHelp) {
      if (input === '?' || key.escape) {
        setShowHelp(false);
      }
      return;
    }

    // Navigation
    if (key.upArrow) {
      setSelectedIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((i) => Math.min(allVisibleTasks.length - 1, i + 1));
      return;
    }

    // Actions
    if (input === 'q') {
      exit();
      return;
    }

    if (input === '?') {
      setShowHelp(true);
      return;
    }

    if (input === 'r') {
      refresh();
      return;
    }

    if (input === 'a') {
      setShowArchived((v) => !v);
      // Reset selection if it would be out of bounds
      const newLength = !showArchived ? activeTasks.length + archivedTasks.length : activeTasks.length;
      setSelectedIndex((i) => Math.min(i, Math.max(0, newLength - 1)));
      return;
    }

    if (input === 'j' && selectedTask?.jiraUrl) {
      _open(selectedTask.jiraUrl);
      showMsg(`Opening Jira for ${selectedTask.id}...`);
      return;
    }

    if (input === 'p' && selectedTask) {
      const withPr = selectedTask.projects.find((p) => p.pr !== null);
      if (withPr?.pr) {
        _open(withPr.pr.url);
        showMsg(`Opening PR #${withPr.pr.number}...`);
      } else {
        showMsg('No PR found for this task.');
      }
      return;
    }

    if ((input === 'o' || key.return) && selectedTask) {
      const project = selectedTask.projects[0];
      if (project) {
        showMsg(`Worktree: ${project.worktreePath}`);
      }
    }
  });

  if (loading) {
    return (
      <Box padding={1}>
        <Text>Loading tasks...</Text>
      </Box>
    );
  }

  if (showHelp) {
    return (
      <Box flexDirection="column" flexGrow={1}>
        <Box flexGrow={1} justifyContent="center" alignItems="center">
          <HelpOverlay />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Header */}
      <Box paddingX={1} marginBottom={1}>
        <Text bold color="cyan">
          Grove Dashboard
        </Text>
        {message && (
          <>
            <Text> </Text>
            <Text color="yellow">{message}</Text>
          </>
        )}
      </Box>

      {/* Main content: two-panel layout */}
      <Box flexGrow={1}>
        <TaskList
          activeTasks={activeTasks}
          archivedTasks={archivedTasks}
          selectedIndex={selectedIndex}
          showArchived={showArchived}
        />
        <TaskDetail task={selectedTask} />
      </Box>

      {/* Status bar */}
      <StatusBar
        refreshing={refreshing}
        lastRefresh={lastRefresh}
        showArchived={showArchived}
        taskCount={allVisibleTasks.length}
      />
    </Box>
  );
}
