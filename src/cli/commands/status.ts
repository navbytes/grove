import type { Command } from 'commander';
import pc from 'picocolors';
import { NotInTaskError, TaskNotFoundError } from '../../core/errors.js';
import { detectCurrentTask, findTask } from '../../core/tasks.js';
import { dim, label, taskId as taskIdColor } from '../ui/colors.js';
import { renderLinksTable, renderTaskStatusTable } from '../ui/table.js';

export function registerStatusCommand(program: Command): void {
  program
    .command('status [task]')
    .description('Show detailed status for a task (auto-detects from cwd if omitted)')
    .option('--json', 'Output as JSON')
    .action(async (taskArg: string | undefined, opts: { json?: boolean }) => {
      const task = taskArg ? await findTask(taskArg) : await detectCurrentTask();

      if (!task) {
        if (taskArg) {
          throw new TaskNotFoundError(taskArg);
        }
        throw new NotInTaskError();
      }

      if (opts.json) {
        console.log(JSON.stringify(task, null, 2));
        return;
      }

      console.log();
      console.log(`  ${label('Task:')} ${taskIdColor(task.id)} — ${task.title}`);

      if (task.jiraTickets.length > 0) {
        console.log(`  ${label('Jira:')} ${task.jiraTickets.join(', ')}`);
      }
      if (task.jiraUrl) {
        console.log(`  ${label('URL:')}  ${dim(task.jiraUrl)}`);
      }

      console.log(`  ${label('Created:')} ${task.createdAt.split('T')[0]}`);
      console.log(`  ${label('Status:')} ${task.status === 'active' ? pc.green(task.status) : pc.dim(task.status)}`);
      console.log();

      if (task.projects.length > 0) {
        console.log(renderTaskStatusTable(task));
        console.log();
      }

      if (task.links.length > 0) {
        console.log(`  ${label('Links:')}`);
        console.log(renderLinksTable(task.links));
        console.log();
      }

      if (task.notes) {
        console.log(`  ${label('Notes:')} ${task.notes}`);
      } else {
        console.log(`  ${label('Notes:')} ${dim('(none)')}`);
      }
      console.log();
    });
}
