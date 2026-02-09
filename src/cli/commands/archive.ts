import type { Command } from 'commander';
import { GroveError, TaskNotFoundError } from '../../core/errors.js';
import { archiveTask, findTask } from '../../core/tasks.js';
import { label, taskId as taskIdColor } from '../ui/colors.js';
import { clack, promptSelect } from '../ui/prompts.js';

export function registerArchiveCommand(program: Command): void {
  program
    .command('archive <task>')
    .description('Archive a completed task')
    .action(async (taskArg: string) => {
      const task = await findTask(taskArg);
      if (!task) {
        throw new TaskNotFoundError(taskArg);
      }

      if (task.status === 'archived') {
        throw new GroveError(`Task "${taskArg}" is already archived.`, {
          suggestion: 'Run `grove list` to see active tasks.',
        });
      }

      console.log();
      console.log(`  ${label('Task:')} ${taskIdColor(task.id)} — ${task.title}`);
      console.log(`  ${label('Projects:')} ${task.projects.map((p) => p.name).join(', ')}`);
      console.log();

      const cleanup = await promptSelect(`Archive ${task.id}? Choose cleanup option:`, [
        { name: 'Archive only (keep worktrees)', value: false },
        { name: 'Archive and clean up (remove worktrees and workspace)', value: true },
      ]);

      const s = clack.spinner();
      s.start('Archiving task...');

      const result = await archiveTask(task.id, cleanup);
      if (result.success) {
        s.stop('Task archived.');
      } else {
        s.stop('Archive failed.');
        throw new GroveError(result.error || 'Failed to archive task.');
      }
    });
}
