import type { Command } from 'commander';
import { getWorkspaceDir, loadConfig } from '../../core/config.js';
import { GroveError, TaskNotFoundError } from '../../core/errors.js';
import { deleteTask, findTask, getTaskWorkspacePath } from '../../core/tasks.js';
import { label, taskId as taskIdColor, warn } from '../ui/colors.js';
import { clack, promptText } from '../ui/prompts.js';

export function registerDeleteCommand(program: Command): void {
  program
    .command('delete <task>')
    .description('Permanently delete a task')
    .action(async (taskArg: string) => {
      const task = await findTask(taskArg);
      if (!task) {
        throw new TaskNotFoundError(taskArg);
      }

      const config = await loadConfig();
      const taskDir = getTaskWorkspacePath(getWorkspaceDir(config), task.id);

      console.log();
      console.log(`  ${label('Task:')} ${taskIdColor(task.id)} — ${task.title}`);
      console.log();
      console.log(warn('This will permanently delete:'));
      console.log(warn(`  - Task data for ${task.id}`));
      for (const p of task.projects) {
        console.log(warn(`  - Worktree at ${p.worktreePath}`));
      }
      console.log(warn(`  - Directory ${taskDir}/`));
      console.log();
      console.log(warn('WARNING: Unmerged branches will be deleted. Uncommitted changes will be lost.'));
      console.log();

      const confirmation = await promptText(`Type "${task.id}" to confirm:`);
      if (confirmation !== task.id) {
        console.log(warn('Confirmation did not match. Aborting.'));
        return;
      }

      const s = clack.spinner();
      s.start('Deleting task...');

      const result = await deleteTask(task.id);
      if (result.success) {
        s.stop('Task deleted.');
      } else {
        s.stop('Delete failed.');
        throw new GroveError(result.error || 'Failed to delete task.');
      }
    });
}
