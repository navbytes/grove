import { Box, Text } from 'ink';
import type React from 'react';
import { categoryDisplayName, groupLinksByCategory } from '../../core/links.js';
import type { Task, TaskProjectPR } from '../../core/types.js';

function reviewIcon(status: TaskProjectPR['reviewStatus']): string {
  switch (status) {
    case 'approved':
      return 'OK';
    case 'changes_requested':
      return '!!';
    case 'pending':
      return '..';
    case 'none':
      return '--';
  }
}

function reviewColor(status: TaskProjectPR['reviewStatus']): string | undefined {
  switch (status) {
    case 'approved':
      return 'green';
    case 'changes_requested':
      return 'red';
    case 'pending':
      return 'yellow';
    default:
      return undefined;
  }
}

function ciIcon(status: TaskProjectPR['ciStatus']): string {
  switch (status) {
    case 'passed':
      return 'OK';
    case 'failed':
      return 'XX';
    case 'pending':
      return '..';
    case 'none':
      return '--';
  }
}

function ciColor(status: TaskProjectPR['ciStatus']): string | undefined {
  switch (status) {
    case 'passed':
      return 'green';
    case 'failed':
      return 'red';
    case 'pending':
      return 'yellow';
    default:
      return undefined;
  }
}

interface TaskDetailProps {
  task: Task | null;
}

export function TaskDetail({ task }: TaskDetailProps): React.ReactElement {
  if (!task) {
    return (
      <Box flexDirection="column" flexGrow={1} paddingLeft={1}>
        <Text dimColor>No task selected</Text>
      </Box>
    );
  }

  const grouped = groupLinksByCategory(task.links);
  const linkCategories = Array.from(grouped.keys()).map((k) => categoryDisplayName(k));

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      paddingLeft={1}
      borderStyle="single"
      borderLeft
      borderTop={false}
      borderRight={false}
      borderBottom={false}
    >
      <Box marginBottom={1} paddingLeft={1}>
        <Text bold color="cyan">
          {task.id}
        </Text>
        <Text> </Text>
        <Text>{task.title}</Text>
      </Box>

      {task.jiraUrl && (
        <Box paddingLeft={1} marginBottom={1}>
          <Text dimColor>Jira: </Text>
          <Text color="blue">{task.jiraTickets.join(', ') || task.id}</Text>
        </Box>
      )}

      <Box paddingLeft={1} marginBottom={1}>
        <Text dimColor>Status: </Text>
        <Text color={task.status === 'active' ? 'green' : 'yellow'}>{task.status}</Text>
        <Text dimColor> | Created: </Text>
        <Text dimColor>{new Date(task.createdAt).toLocaleDateString()}</Text>
      </Box>

      {task.projects.length > 0 && (
        <Box flexDirection="column" paddingLeft={1} marginBottom={1}>
          <Text bold underline>
            Projects
          </Text>
          <Box marginTop={1}>
            <Box width={16}>
              <Text dimColor>Repo</Text>
            </Box>
            <Box width={8}>
              <Text dimColor>PR</Text>
            </Box>
            <Box width={8}>
              <Text dimColor>Review</Text>
            </Box>
            <Box width={8}>
              <Text dimColor>CI</Text>
            </Box>
          </Box>
          {task.projects.map((p) => (
            <Box key={p.name}>
              <Box width={16}>
                <Text color="magenta">{p.name.length > 14 ? `${p.name.slice(0, 11)}...` : p.name}</Text>
              </Box>
              <Box width={8}>
                <Text>{p.pr ? `#${p.pr.number}` : '--'}</Text>
              </Box>
              <Box width={8}>
                <Text color={p.pr ? reviewColor(p.pr.reviewStatus) : undefined}>
                  {p.pr ? reviewIcon(p.pr.reviewStatus) : '--'}
                </Text>
              </Box>
              <Box width={8}>
                <Text color={p.pr ? ciColor(p.pr.ciStatus) : undefined}>{p.pr ? ciIcon(p.pr.ciStatus) : '--'}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {task.links.length > 0 && (
        <Box paddingLeft={1} marginBottom={1}>
          <Text dimColor>Links: </Text>
          <Text>
            {task.links.length} ({linkCategories.join(', ')})
          </Text>
        </Box>
      )}

      {task.notes && (
        <Box paddingLeft={1}>
          <Text dimColor>Notes: </Text>
          <Text>{task.notes.split('\n')[0]?.slice(0, 50) ?? ''}</Text>
        </Box>
      )}
    </Box>
  );
}
