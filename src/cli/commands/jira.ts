import type { Command } from 'commander';
import _open from 'open';
import { loadConfig } from '../../core/config.js';
import { JiraNotConfiguredError, NotInTaskError } from '../../core/errors.js';
import { fetchJiraIssue, isJiraConfigured } from '../../core/jira.js';
import { detectCurrentTask, findTask } from '../../core/tasks.js';
import { dim, success, warn } from '../ui/colors.js';
import { clack, promptSelect } from '../ui/prompts.js';

export function registerJiraCommand(program: Command): void {
  const jiraCmd = program.command('jira').description('Jira integration commands');

  jiraCmd
    .command('open')
    .description('Open linked Jira ticket in browser')
    .option('-t, --task <id>', 'Specify task ID instead of auto-detecting')
    .action(async (opts: { task?: string }) => {
      const task = opts.task ? await findTask(opts.task) : await detectCurrentTask();

      if (!task) {
        throw new NotInTaskError();
      }

      if (task.jiraTickets.length === 0) {
        console.log(warn('No Jira tickets linked to this task.'));
        return;
      }

      let ticketId: string;
      if (task.jiraTickets.length === 1) {
        ticketId = task.jiraTickets[0] as string;
      } else {
        ticketId = await promptSelect(
          'Which ticket to open?',
          task.jiraTickets.map((t) => ({ name: t, value: t })),
        );
      }

      const config = await loadConfig();
      if (!config.jira?.baseUrl) {
        throw new JiraNotConfiguredError();
      }

      const url = `${config.jira.baseUrl}/browse/${ticketId}`;
      console.log(success(`Opening ${url}...`));
      await _open(url);
    });

  jiraCmd
    .command('status')
    .description('Show Jira ticket status for the current task')
    .option('-t, --task <id>', 'Specify task ID instead of auto-detecting')
    .action(async (opts: { task?: string }) => {
      const task = opts.task ? await findTask(opts.task) : await detectCurrentTask();

      if (!task) {
        throw new NotInTaskError();
      }

      if (task.jiraTickets.length === 0) {
        console.log(warn('No Jira tickets linked to this task.'));
        return;
      }

      if (!(await isJiraConfigured())) {
        throw new JiraNotConfiguredError();
      }

      const s = clack.spinner();
      s.start('Fetching Jira ticket status...');

      for (const ticketId of task.jiraTickets) {
        const result = await fetchJiraIssue(ticketId);
        if (result.success && result.data) {
          s.stop('');
          console.log(`  ${result.data.key}: ${result.data.summary}`);
          console.log(`  ${dim(`Type: ${result.data.issueType}  Status: ${result.data.status}`)}`);
          console.log();
        } else {
          s.stop('');
          console.log(`  ${ticketId}: ${dim(result.error || 'Failed to fetch')}`);
          console.log();
        }
      }
    });
}
