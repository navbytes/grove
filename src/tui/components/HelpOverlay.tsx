import { Box, Text } from 'ink';
import type React from 'react';

export function HelpOverlay(): React.ReactElement {
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Box marginBottom={1} justifyContent="center">
        <Text bold color="cyan">
          Grove Dashboard — Keyboard Shortcuts
        </Text>
      </Box>

      <Box flexDirection="column" gap={0}>
        <Box>
          <Box width={20}>
            <Text bold>Up / Down</Text>
          </Box>
          <Text>Navigate task list</Text>
        </Box>
        <Box>
          <Box width={20}>
            <Text bold>r</Text>
          </Box>
          <Text>Refresh PR/CI status</Text>
        </Box>
        <Box>
          <Box width={20}>
            <Text bold>o / Enter</Text>
          </Box>
          <Text>Open task worktree in shell</Text>
        </Box>
        <Box>
          <Box width={20}>
            <Text bold>j</Text>
          </Box>
          <Text>Open Jira ticket in browser</Text>
        </Box>
        <Box>
          <Box width={20}>
            <Text bold>p</Text>
          </Box>
          <Text>Open PR in browser</Text>
        </Box>
        <Box>
          <Box width={20}>
            <Text bold>a</Text>
          </Box>
          <Text>Toggle archived tasks</Text>
        </Box>
        <Box>
          <Box width={20}>
            <Text bold>?</Text>
          </Box>
          <Text>Toggle this help</Text>
        </Box>
        <Box>
          <Box width={20}>
            <Text bold>q / Ctrl+C</Text>
          </Box>
          <Text>Quit dashboard</Text>
        </Box>
      </Box>

      <Box marginTop={1} justifyContent="center">
        <Text dimColor>Press ? to close</Text>
      </Box>
    </Box>
  );
}
