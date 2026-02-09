import { Box, Text } from 'ink';
import type React from 'react';

interface StatusBarProps {
  refreshing: boolean;
  lastRefresh: Date | null;
  showArchived: boolean;
  taskCount: number;
}

function Shortcut({ shortcut, label }: { shortcut: string; label: string }): React.ReactElement {
  return (
    <Box marginRight={2}>
      <Text bold color="cyan">
        {shortcut}
      </Text>
      <Text dimColor> {label}</Text>
    </Box>
  );
}

export function StatusBar({ refreshing, lastRefresh, showArchived, taskCount }: StatusBarProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderLeft={false}
      borderRight={false}
      borderBottom={false}
      paddingX={1}
    >
      <Box>
        <Shortcut shortcut="up/dn" label="navigate" />
        <Shortcut shortcut="r" label="refresh" />
        <Shortcut shortcut="o" label="open" />
        <Shortcut shortcut="j" label="jira" />
        <Shortcut shortcut="a" label={showArchived ? 'hide archived' : 'show archived'} />
        <Shortcut shortcut="?" label="help" />
        <Shortcut shortcut="q" label="quit" />
      </Box>
      <Box marginTop={0}>
        <Text dimColor>
          {taskCount} task(s)
          {refreshing ? ' | Refreshing...' : ''}
          {lastRefresh && !refreshing ? ` | Last refresh: ${lastRefresh.toLocaleTimeString()}` : ''}
        </Text>
      </Box>
    </Box>
  );
}
