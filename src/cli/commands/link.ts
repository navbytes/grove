import type { Command } from 'commander';
import _open from 'open';
import { GroveError, NotInTaskError } from '../../core/errors.js';
import { categoryDisplayName, createLink } from '../../core/links.js';
import { addLinkToTask, detectCurrentTask, findTask, removeLinkFromTask } from '../../core/tasks.js';
import { error, success, warn } from '../ui/colors.js';
import { promptConfirm, promptText } from '../ui/prompts.js';
import { renderLinksTable } from '../ui/table.js';

async function resolveTask(taskArg?: string) {
  if (taskArg) {
    return findTask(taskArg);
  }
  return detectCurrentTask();
}

export function registerLinkCommand(program: Command): void {
  const linkCmd = program.command('link').description('Manage links for the current task');

  linkCmd
    .command('add <url>')
    .description('Add a link to the current task (auto-categorized)')
    .option('-t, --task <id>', 'Specify task ID instead of auto-detecting')
    .action(async (url: string, opts: { task?: string }) => {
      const task = await resolveTask(opts.task);
      if (!task) {
        throw new NotInTaskError();
      }

      const label = await promptText('Label for this link:');
      const link = createLink(url, label);

      const result = await addLinkToTask(task.id, link);
      if (result.success) {
        console.log(success(`Added link (${categoryDisplayName(link.category)}): ${label}`));
      } else {
        console.log(error(result.error || 'Failed to add link.'));
      }
    });

  linkCmd
    .command('list')
    .description('List all links for the current task')
    .option('-t, --task <id>', 'Specify task ID instead of auto-detecting')
    .action(async (opts: { task?: string }) => {
      const task = await resolveTask(opts.task);
      if (!task) {
        throw new NotInTaskError();
      }

      console.log();
      console.log(renderLinksTable(task.links));
      console.log();
    });

  linkCmd
    .command('open [index]')
    .description('Open a link in the browser (1-based index)')
    .option('-t, --task <id>', 'Specify task ID instead of auto-detecting')
    .action(async (indexArg: string | undefined, opts: { task?: string }) => {
      const task = await resolveTask(opts.task);
      if (!task) {
        throw new NotInTaskError();
      }

      if (task.links.length === 0) {
        console.log(warn('No links to open.'));
        return;
      }

      let index: number;
      if (indexArg) {
        index = parseInt(indexArg, 10);
      } else {
        // If only one link, open it directly
        if (task.links.length === 1) {
          index = 1;
        } else {
          console.log(renderLinksTable(task.links));
          const input = await promptText('Which link to open? (number):');
          index = parseInt(input, 10);
        }
      }

      const zeroIndex = index - 1;
      if (zeroIndex < 0 || zeroIndex >= task.links.length) {
        throw new GroveError(`Invalid link index: ${index}`, {
          suggestion: 'Run `grove link list` to see available links.',
        });
      }

      const link = task.links[zeroIndex];
      if (!link) {
        throw new GroveError(`Invalid link index: ${index}`, {
          suggestion: 'Run `grove link list` to see available links.',
        });
      }
      console.log(success(`Opening ${link.url}...`));
      await _open(link.url);
    });

  linkCmd
    .command('remove <index>')
    .description('Remove a link by index (1-based)')
    .option('-t, --task <id>', 'Specify task ID instead of auto-detecting')
    .action(async (indexArg: string, opts: { task?: string }) => {
      const task = await resolveTask(opts.task);
      if (!task) {
        throw new NotInTaskError();
      }

      const index = parseInt(indexArg, 10);
      const zeroIndex = index - 1;
      if (zeroIndex < 0 || zeroIndex >= task.links.length) {
        throw new GroveError(`Invalid link index: ${index}`, {
          suggestion: 'Run `grove link list` to see available links.',
        });
      }

      const link = task.links[zeroIndex];
      if (!link) {
        throw new GroveError(`Invalid link index: ${index}`, {
          suggestion: 'Run `grove link list` to see available links.',
        });
      }
      const confirmed = await promptConfirm(`Remove "${link.label}"?`, false);
      if (!confirmed) return;

      const result = await removeLinkFromTask(task.id, index);
      if (result.success) {
        console.log(success(`Removed "${link.label}"`));
      } else {
        console.log(error(result.error || 'Failed to remove link.'));
      }
    });
}
