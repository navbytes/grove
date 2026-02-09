import type { Command } from 'commander';
import _open from 'open';
import { loadConfig } from '../../core/config.js';
import { GitHubAuthError, GitHubNotConfiguredError, GroveError, NotInTaskError } from '../../core/errors.js';
import { createPR, fetchFullPRStatus, getGitHubAuth, isGitHubConfigured } from '../../core/github.js';
import { detectCurrentTask, findTask, loadTasks, saveTasks } from '../../core/tasks.js';
import type { TaskProject } from '../../core/types.js';
import { execGit } from '../../core/worktree.js';
import { success, warn } from '../ui/colors.js';
import { clack, promptConfirm, promptSelect, promptText } from '../ui/prompts.js';

function detectProjectFromCwd(task: import('../../core/types.js').Task): TaskProject | null {
  const cwd = process.cwd();
  for (const project of task.projects) {
    if (cwd.startsWith(project.worktreePath)) {
      return project;
    }
  }
  return null;
}

export function registerPrCommand(program: Command): void {
  const prCmd = program.command('pr').description('Manage pull requests for the current task');

  prCmd
    .command('create [project]')
    .description('Create a pull request for a project in the current task')
    .option('-t, --task <id>', 'Specify task ID instead of auto-detecting')
    .action(async (projectArg: string | undefined, opts: { task?: string }) => {
      const task = opts.task ? await findTask(opts.task) : await detectCurrentTask();
      if (!task) {
        throw new NotInTaskError();
      }

      if (!(await isGitHubConfigured())) {
        throw new GitHubNotConfiguredError();
      }

      const auth = await getGitHubAuth();
      if (!auth) {
        throw new GitHubAuthError();
      }

      // Resolve which project
      let project: TaskProject | undefined;
      if (projectArg) {
        project = task.projects.find((p) => p.name === projectArg);
        if (!project) {
          throw new GroveError(`Project "${projectArg}" not found in task "${task.id}".`, {
            suggestion: 'Run `grove status` to see projects in this task.',
          });
        }
      } else {
        const detected = detectProjectFromCwd(task);
        if (detected) {
          project = detected;
        } else if (task.projects.length === 1) {
          project = task.projects[0] as TaskProject;
        } else {
          const selected = await promptSelect(
            'Which project?',
            task.projects.map((p) => ({ name: p.name, value: p })),
          );
          project = selected;
        }
      }

      // Check if PR already exists
      if (project.pr) {
        console.log(success(`PR already exists: ${project.pr.url}`));
        const openIt = await promptConfirm('Open in browser?');
        if (openIt) await _open(project.pr.url);
        return;
      }

      clack.intro(`grove pr create — ${project.name}`);

      // Push branch to remote
      const s = clack.spinner();
      s.start(`Pushing ${project.branch} to origin...`);

      const pushResult = await execGit(['push', '-u', 'origin', project.branch], project.worktreePath);
      if (!pushResult.success) {
        s.stop('Push failed.');
        throw new GroveError(`Push failed: ${pushResult.error}`, {
          suggestion: 'Check your git remote configuration and branch protection rules.',
        });
      }
      s.stop('Branch pushed to origin.');

      // Pre-fill PR title and body
      const defaultTitle = `${task.id}: ${task.title}`;
      const title = await promptText('PR title:', defaultTitle);

      const bodyParts: string[] = [];
      if (task.jiraUrl) {
        bodyParts.push(`## Jira\n\n- [${task.id}](${task.jiraUrl})`);
      }
      bodyParts.push(`## Description\n\n<!-- Describe your changes -->`);

      const defaultBody = bodyParts.join('\n\n');
      const body = await promptText('PR body (or press enter for default):', defaultBody);

      // Create the PR
      s.start('Creating pull request...');

      const config = await loadConfig();
      const repoName = project.name;

      const prResult = await createPR(repoName, { title, body, head: project.branch, base: project.baseBranch }, auth);

      if (!prResult.success) {
        s.stop('PR creation failed.');
        throw new GroveError(`Failed to create PR: ${prResult.error}`);
      }

      const pr = prResult.data;
      if (!pr) {
        s.stop('PR creation failed.');
        throw new GroveError('Failed to create PR — no data returned.');
      }

      s.stop(`Created PR #${pr.number}`);

      // Update task data
      project.pr = {
        number: pr.number,
        url: pr.url,
        status: 'open',
        reviewStatus: 'none',
        ciStatus: 'none',
      };
      task.updatedAt = new Date().toISOString();

      const tasks = await loadTasks();
      const taskIndex = tasks.findIndex((t) => t.id === task.id);
      if (taskIndex !== -1) {
        tasks[taskIndex] = task;
        await saveTasks(tasks);
      }

      // Regenerate context file
      const { writeContextFile } = await import('../../core/context.js');
      const { getWorkspaceDir } = await import('../../core/config.js');
      await writeContextFile(task, getWorkspaceDir(config));

      console.log(success(pr.url));

      const openIt = await promptConfirm('Open PR in browser?');
      if (openIt) await _open(pr.url);

      clack.outro('PR created.');
    });

  prCmd
    .command('status')
    .description('Show PR and CI status for all projects in the current task')
    .option('-t, --task <id>', 'Specify task ID instead of auto-detecting')
    .action(async (opts: { task?: string }) => {
      const task = opts.task ? await findTask(opts.task) : await detectCurrentTask();
      if (!task) {
        throw new NotInTaskError();
      }

      if (!(await isGitHubConfigured())) {
        throw new GitHubNotConfiguredError();
      }

      const auth = await getGitHubAuth();
      if (!auth) {
        throw new GitHubAuthError();
      }

      const s = clack.spinner();
      s.start('Fetching PR status from GitHub...');

      let updated = false;
      for (const project of task.projects) {
        const result = await fetchFullPRStatus(project.name, project.branch, auth);
        if (result.success && result.data) {
          project.pr = result.data;
          updated = true;
        }
      }

      if (updated) {
        task.updatedAt = new Date().toISOString();
        const tasks = await loadTasks();
        const taskIndex = tasks.findIndex((t) => t.id === task.id);
        if (taskIndex !== -1) {
          tasks[taskIndex] = task;
          await saveTasks(tasks);
        }
      }

      s.stop('PR status updated.');

      // Display status table
      const { renderTaskStatusTable } = await import('../ui/table.js');
      console.log();
      console.log(renderTaskStatusTable(task));
      console.log();
    });

  prCmd
    .command('open [project]')
    .description('Open PR URL in browser')
    .option('-t, --task <id>', 'Specify task ID instead of auto-detecting')
    .action(async (projectArg: string | undefined, opts: { task?: string }) => {
      const task = opts.task ? await findTask(opts.task) : await detectCurrentTask();
      if (!task) {
        throw new NotInTaskError();
      }

      // Find the project
      let project: TaskProject | undefined;
      if (projectArg) {
        project = task.projects.find((p) => p.name === projectArg);
        if (!project) {
          throw new GroveError(`Project "${projectArg}" not found in task "${task.id}".`, {
            suggestion: 'Run `grove status` to see projects in this task.',
          });
        }
      } else {
        const detected = detectProjectFromCwd(task);
        if (detected) {
          project = detected;
        } else if (task.projects.length === 1) {
          project = task.projects[0] as TaskProject;
        } else {
          // Filter to projects with PRs
          const withPRs = task.projects.filter((p) => p.pr !== null);
          if (withPRs.length === 0) {
            console.log(warn('No PRs found. Run `grove pr create` first.'));
            return;
          }
          if (withPRs.length === 1) {
            project = withPRs[0] as TaskProject;
          } else {
            project = await promptSelect(
              'Which PR to open?',
              withPRs.map((p) => ({ name: `${p.name} — PR #${p.pr?.number}`, value: p })),
            );
          }
        }
      }

      if (!project.pr) {
        console.log(warn(`No PR found for ${project.name}. Run \`grove pr create ${project.name}\` first.`));
        return;
      }

      console.log(success(`Opening ${project.pr.url}...`));
      await _open(project.pr.url);
    });
}
