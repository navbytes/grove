import type { Command } from 'commander';
import { loadConfig } from '../../core/config.js';

export function registerDashboardCommand(program: Command): void {
  program
    .command('dashboard')
    .alias('dash')
    .description('Open the interactive TUI dashboard')
    .option('-i, --interval <seconds>', 'Polling interval in seconds (0 to disable)')
    .action(async (opts: { interval?: string }) => {
      const config = await loadConfig();
      const interval =
        opts.interval !== undefined ? Math.max(0, Number.parseInt(opts.interval, 10)) : config.pollingInterval;

      // Dynamic imports to avoid loading React/Ink for non-dashboard commands
      const { withFullScreen } = await import('fullscreen-ink');
      const React = await import('react');
      const { App } = await import('../../tui/App.js');

      const app = withFullScreen(React.createElement(App, { pollingInterval: interval }));
      await app.start();
      await app.waitUntilExit();
    });
}
