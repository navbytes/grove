#!/usr/bin/env bun
import { Command } from 'commander';
import pc from 'picocolors';
import { GroveError } from '../core/errors.js';
import { registerArchiveCommand } from './commands/archive.js';
import { registerCiCommand } from './commands/ci.js';
import { registerCompletionCommand } from './commands/completion.js';
import { registerConfigCommand } from './commands/config.js';
import { registerContextCommand } from './commands/context.js';
import { registerDashboardCommand } from './commands/dashboard.js';
import { registerDeleteCommand } from './commands/delete.js';
import { registerInitCommand } from './commands/init.js';
import { registerJiraCommand } from './commands/jira.js';
import { registerLinkCommand } from './commands/link.js';
import { registerListCommand } from './commands/list.js';
import { registerNewCommand } from './commands/new.js';
import { registerNotesCommand } from './commands/notes.js';
import { registerOpenCommand } from './commands/open.js';
import { registerPrCommand } from './commands/pr.js';
import { registerProjectCommand } from './commands/project.js';
import { registerRefreshCommand } from './commands/refresh.js';
import { registerStatusCommand } from './commands/status.js';
import { registerTaskCommand } from './commands/task.js';
import { registerWatchCommand } from './commands/watch.js';

const program = new Command();

program
  .name('grove')
  .version('0.1.0')
  .description('Manage cross-repository task workspaces with git worktrees')
  .option('--verbose', 'Show detailed output')
  .option('--quiet', 'Suppress non-essential output');

registerInitCommand(program);
registerConfigCommand(program);
registerProjectCommand(program);
registerNewCommand(program);
registerListCommand(program);
registerStatusCommand(program);
registerOpenCommand(program);
registerTaskCommand(program);
registerArchiveCommand(program);
registerDeleteCommand(program);
registerLinkCommand(program);
registerPrCommand(program);
registerCiCommand(program);
registerJiraCommand(program);
registerRefreshCommand(program);
registerWatchCommand(program);
registerContextCommand(program);
registerNotesCommand(program);
registerCompletionCommand(program);
registerDashboardCommand(program);

// Global error handler
function handleError(err: unknown): void {
  if (err instanceof GroveError) {
    console.error(pc.red(`  \u2717 ${err.message}`));
    if (err.suggestion) {
      console.error(pc.dim(`  ${err.suggestion}`));
    }
    process.exit(err.exitCode);
  }
  console.error(pc.red('  \u2717 An unexpected error occurred.'));
  if (program.opts().verbose) {
    console.error(err);
  } else {
    console.error(pc.dim('  Run with --verbose for details.'));
  }
  process.exit(1);
}

process.on('uncaughtException', handleError);
process.on('unhandledRejection', handleError);

program.parse();
