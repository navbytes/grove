import type { Command } from 'commander';
import slugify from 'slugify';
import { generateBranchName, getWorkspaceDir, loadConfig } from '../../core/config.js';
import { GroveError } from '../../core/errors.js';
import { fetchMultipleJiraIssues, isJiraConfigured } from '../../core/jira.js';
import { loadProjects } from '../../core/projects.js';
import { addProjectToTask, createTask } from '../../core/tasks.js';
import { error } from '../ui/colors.js';
import { clack, promptCheckbox, promptConfirm, promptSelect, promptText } from '../ui/prompts.js';

export function registerNewCommand(program: Command): void {
  program
    .command('new [title]')
    .description('Create a new task workspace')
    .action(async (titleArg?: string) => {
      const config = await loadConfig();
      const workspaceDir = getWorkspaceDir(config);

      // Load registered projects
      const projects = await loadProjects();
      if (projects.length === 0) {
        throw new GroveError('No projects registered.', {
          suggestion: 'Run `grove project add <path>` to register a project first.',
        });
      }

      clack.intro('grove new');

      // Prompt for Jira ticket ID(s)
      const ticketInput = await promptText('Enter Jira ticket ID(s) (comma-separated):');
      const jiraTickets = ticketInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      if (jiraTickets.length === 0) {
        throw new GroveError('At least one ticket ID is required.', {
          suggestion: 'Provide a comma-separated list of Jira ticket IDs.',
        });
      }

      // Safe: we've verified jiraTickets.length > 0 above
      const taskId = jiraTickets[0] as string;

      // Try to fetch title from Jira
      let title = titleArg || '';
      let jiraUrl = '';

      if (!title && (await isJiraConfigured())) {
        const jiraSpinner = clack.spinner();
        jiraSpinner.start('Fetching Jira ticket details...');

        const issues = await fetchMultipleJiraIssues(jiraTickets);

        if (issues.size > 0) {
          const firstIssue = issues.get(taskId);
          if (firstIssue) {
            jiraSpinner.stop(`${firstIssue.key}: ${firstIssue.summary} (${firstIssue.status})`);
            title = firstIssue.summary;

            const useTitle = await promptConfirm(`Use "${title}" as task title?`);
            if (!useTitle) {
              title = await promptText('Task title:', taskId);
            }
          } else {
            jiraSpinner.stop('Could not fetch primary ticket.');
            title = await promptText('Task title:', taskId);
          }
        } else {
          jiraSpinner.stop('Could not fetch ticket details from Jira.');
          clack.log.warn('Jira unavailable — enter title manually.');
          title = await promptText('Task title:', taskId);
        }
      } else if (!title) {
        title = await promptText('Task title:', taskId);
      }

      // Jira URL (construct from config if available)
      if (config.jira?.baseUrl) {
        jiraUrl = `${config.jira.baseUrl}/browse/${taskId}`;
      }

      // Select projects
      const selectedProjects = await promptCheckbox(
        'Select projects for this task:',
        projects.map((p) => ({ name: p.name, value: p })),
      );

      if (selectedProjects.length === 0) {
        clack.log.warn('No projects selected. Task not created.');
        clack.outro('Cancelled.');
        return;
      }

      // Create the task record
      const taskResult = await createTask({
        id: taskId,
        title,
        jiraTickets,
        jiraUrl,
      });

      if (!taskResult.success) {
        throw new GroveError(taskResult.error || 'Failed to create task.');
      }

      // Create worktrees for each selected project
      const s = clack.spinner();
      const slug = slugify(title, { lower: true, strict: true });
      for (const project of selectedProjects) {
        s.start(`Creating worktree for ${project.name}...`);
        const branch = generateBranchName(config.branchTemplate, {
          ticketId: taskId,
          slug,
          title,
        });

        const result = await addProjectToTask(taskId, project, branch, project.defaultBaseBranch, config.workspaceDir);

        if (result.success) {
          s.stop(`${project.name} -> ${workspaceDir}/${taskId}/${project.name} (branch: ${branch})`);

          if (result.data?.setupResult) {
            const sr = result.data.setupResult;
            if (sr.copiedFiles.length > 0) {
              clack.log.info(`  Copied: ${sr.copiedFiles.join(', ')}`);
            }
            if (sr.symlinkedFiles.length > 0) {
              clack.log.info(`  Symlinked: ${sr.symlinkedFiles.join(', ')}`);
            }
            for (const cmd of sr.commandResults) {
              if (cmd.success) {
                clack.log.success(`  Ran: ${cmd.command}`);
              } else {
                clack.log.warn(`  Failed: ${cmd.command} — ${cmd.error}`);
              }
            }
            for (const w of sr.warnings) {
              clack.log.warn(`  ${w}`);
            }
          }
        } else {
          s.stop(`${project.name} -- ${result.error}`);
        }
      }

      clack.log.success('Generated .grove-context.md');

      // Ask how to open
      const openAction = await promptSelect('Open task workspace now?', [
        { name: 'Spawn shell', value: 'shell' },
        { name: 'Open in VS Code', value: 'code' },
        { name: 'Just print path', value: 'path' },
        { name: 'No', value: 'none' },
      ]);

      const taskDir = `${workspaceDir}/${taskId}`;

      if (openAction === 'shell') {
        const { spawn } = await import('node:child_process');
        const shell = process.env.SHELL || '/bin/zsh';
        clack.outro('Entering task workspace...');
        const child = spawn(shell, [], {
          cwd: taskDir,
          stdio: 'inherit',
          env: {
            ...process.env,
            GROVE_TASK: taskId,
            GROVE_TASK_DIR: taskDir,
            GROVE_PROJECTS: selectedProjects.map((p) => p.name).join(','),
          },
        });
        await new Promise<void>((resolve) => child.on('close', () => resolve()));
      } else if (openAction === 'code') {
        const { execFile } = await import('node:child_process');
        execFile('code', [taskDir], (err) => {
          if (err) console.log(error('Failed to open VS Code.'));
        });
        clack.outro(`Opening ${taskDir} in VS Code...`);
      } else if (openAction === 'path') {
        clack.outro('');
        process.stdout.write(taskDir);
      } else {
        clack.outro(`Task ${taskId} created.`);
      }
    });
}
