import type { Command } from 'commander';
import { getWorkspaceDir, loadConfig } from '../../core/config.js';
import { writeContextFile } from '../../core/context.js';
import { NotInTaskError } from '../../core/errors.js';
import { detectCurrentTask, findTask } from '../../core/tasks.js';
import { error, success } from '../ui/colors.js';

export function registerContextCommand(program: Command): void {
  program
    .command('context')
    .description('Regenerate the .grove-context.md file for the current task')
    .option('-t, --task <id>', 'Specify task ID instead of auto-detecting')
    .action(async (opts: { task?: string }) => {
      const task = opts.task ? await findTask(opts.task) : await detectCurrentTask();

      if (!task) {
        throw new NotInTaskError();
      }

      const config = await loadConfig();
      const result = await writeContextFile(task, getWorkspaceDir(config));
      if (result.success) {
        console.log(success('Regenerated .grove-context.md'));
      } else {
        console.log(error(result.error || 'Failed to regenerate context file.'));
      }
    });
}
