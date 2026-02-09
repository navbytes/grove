import { spawn } from 'node:child_process';
import type { Command } from 'commander';
import { getWorkspaceDir, loadConfig } from '../../core/config.js';
import { getContextFilePath } from '../../core/context.js';
import { GroveError, NotInTaskError } from '../../core/errors.js';
import { fileExists } from '../../core/store.js';
import { detectCurrentTask, findTask } from '../../core/tasks.js';

export function registerNotesCommand(program: Command): void {
  program
    .command('notes')
    .description('Open .grove-context.md in $EDITOR for editing')
    .option('-t, --task <id>', 'Specify task ID instead of auto-detecting')
    .action(async (opts: { task?: string }) => {
      const task = opts.task ? await findTask(opts.task) : await detectCurrentTask();

      if (!task) {
        throw new NotInTaskError();
      }

      const config = await loadConfig();
      const contextPath = getContextFilePath(getWorkspaceDir(config), task.id);

      if (!(await fileExists(contextPath))) {
        throw new GroveError('Context file not found.', {
          suggestion: 'Run `grove context` to generate it.',
        });
      }

      const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
      const child = spawn(editor, [contextPath], { stdio: 'inherit' });
      await new Promise<void>((resolve) => child.on('close', () => resolve()));
    });
}
