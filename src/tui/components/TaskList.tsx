import { Box, Text } from 'ink';
import type React from 'react';
import type { Task } from '../../core/types.js';

interface TaskListProps {
  activeTasks: Task[];
  archivedTasks: Task[];
  selectedIndex: number;
  showArchived: boolean;
}

function prIndicator(task: Task): string {
  const withPr = task.projects.filter((p) => p.pr !== null);
  if (withPr.length === 0) return '';

  const allApproved = withPr.every((p) => p.pr?.reviewStatus === 'approved');
  const anyFailed = withPr.some((p) => p.pr?.ciStatus === 'failed');
  const anyChangesRequested = withPr.some((p) => p.pr?.reviewStatus === 'changes_requested');

  if (anyFailed) return ' !';
  if (anyChangesRequested) return ' ~';
  if (allApproved) return ' *';
  return '';
}

function TaskRow({ task, isSelected }: { task: Task; isSelected: boolean }): React.ReactElement {
  const prefix = isSelected ? '>' : ' ';
  const indicator = prIndicator(task);
  const projectCount = task.projects.length;
  const prCount = task.projects.filter((p) => p.pr !== null).length;
  const truncatedTitle = task.title.length > 28 ? `${task.title.slice(0, 25)}...` : task.title;

  return (
    <Box>
      <Text bold={isSelected} color={isSelected ? 'cyan' : undefined}>
        {prefix} {task.id}
      </Text>
      <Text dimColor> {truncatedTitle}</Text>
      <Text dimColor>
        {' '}
        {prCount}/{projectCount}
      </Text>
      <Text color={indicator === ' !' ? 'red' : indicator === ' *' ? 'green' : 'yellow'}>{indicator}</Text>
    </Box>
  );
}

export function TaskList({
  activeTasks,
  archivedTasks,
  selectedIndex,
  showArchived,
}: TaskListProps): React.ReactElement {
  const allTasks = showArchived ? [...activeTasks, ...archivedTasks] : activeTasks;

  return (
    <Box flexDirection="column" width="40%" paddingRight={1}>
      <Box marginBottom={1}>
        <Text bold underline>
          Active Tasks ({activeTasks.length})
        </Text>
      </Box>

      {activeTasks.length === 0 ? (
        <Text dimColor> No active tasks</Text>
      ) : (
        activeTasks.map((task, i) => <TaskRow key={task.id} task={task} isSelected={selectedIndex === i} />)
      )}

      {showArchived && archivedTasks.length > 0 && (
        <>
          <Box marginTop={1} marginBottom={1}>
            <Text bold underline dimColor>
              Archived ({archivedTasks.length})
            </Text>
          </Box>
          {archivedTasks.map((task, i) => (
            <TaskRow key={task.id} task={task} isSelected={selectedIndex === activeTasks.length + i} />
          ))}
        </>
      )}

      {allTasks.length === 0 && (
        <Box marginTop={1}>
          <Text dimColor> Run `grove new` to create a task</Text>
        </Box>
      )}
    </Box>
  );
}
