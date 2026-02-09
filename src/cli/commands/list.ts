import type { Command } from 'commander';
import { getActiveTasks, getArchivedTasks, loadTasks } from '../../core/tasks.js';
import { dim, warn } from '../ui/colors.js';
import { renderTaskListTable } from '../ui/table.js';

export function registerListCommand(program: Command): void {
  program
    .command('list')
    .description('List all tasks')
    .option('-a, --all', 'Include archived tasks')
    .option('--archived', 'Show only archived tasks')
    .option('--json', 'Output as JSON')
    .action(async (opts: { all?: boolean; archived?: boolean; json?: boolean }) => {
      let tasks: import('../../core/types.js').Task[];
      if (opts.archived) {
        tasks = await getArchivedTasks();
      } else if (opts.all) {
        tasks = await loadTasks();
      } else {
        tasks = await getActiveTasks();
      }

      if (opts.json) {
        console.log(JSON.stringify(tasks, null, 2));
        return;
      }

      if (tasks.length === 0) {
        console.log(warn('No tasks found. Run `grove new` to create one.'));
        return;
      }

      console.log();
      console.log(renderTaskListTable(tasks));
      console.log();

      const activeCount = tasks.filter((t) => t.status === 'active').length;
      const archivedCount = tasks.filter((t) => t.status === 'archived').length;

      const parts: string[] = [];
      if (activeCount > 0) parts.push(`${activeCount} active`);
      if (archivedCount > 0) parts.push(`${archivedCount} archived`);
      console.log(dim(`  ${parts.join(', ')}`));
      console.log();
    });
}
