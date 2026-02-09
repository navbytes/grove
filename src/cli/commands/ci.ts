import type { Command } from 'commander';
import _open from 'open';
import { loadConfig } from '../../core/config.js';
import { GitHubNotConfiguredError, GroveError, NotInTaskError } from '../../core/errors.js';
import { detectCurrentTask, findTask } from '../../core/tasks.js';
import type { TaskProject } from '../../core/types.js';
import { success, warn } from '../ui/colors.js';
import { promptSelect } from '../ui/prompts.js';

function detectProjectFromCwd(task: import('../../core/types.js').Task): TaskProject | null {
  const cwd = process.cwd();
  for (const project of task.projects) {
    if (cwd.startsWith(project.worktreePath)) {
      return project;
    }
  }
  return null;
}

export function registerCiCommand(program: Command): void {
  program
    .command('ci')
    .description('Open CI status page in browser for a project')
    .argument('[project]', 'Project name (auto-detects from cwd)')
    .option('-t, --task <id>', 'Specify task ID instead of auto-detecting')
    .action(async (projectArg: string | undefined, opts: { task?: string }) => {
      const task = opts.task ? await findTask(opts.task) : await detectCurrentTask();
      if (!task) {
        throw new NotInTaskError();
      }

      const config = await loadConfig();
      if (!config.git?.org) {
        throw new GitHubNotConfiguredError();
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
          project = await promptSelect(
            'Which project?',
            task.projects.map((p) => ({ name: p.name, value: p })),
          );
        }
      }

      if (project.pr) {
        // Open the PR's checks tab on GitHub
        const checksUrl = `${project.pr.url}/checks`;
        console.log(success(`Opening ${checksUrl}...`));
        await _open(checksUrl);
      } else {
        // Open the branch's commit status page
        const baseUrl = config.git.baseUrl || 'https://github.com';
        const actionsUrl = `${baseUrl}/${config.git.org}/${project.name}/actions?query=branch%3A${encodeURIComponent(project.branch)}`;
        console.log(warn('No PR found — opening GitHub Actions for this branch.'));
        console.log(success(`Opening ${actionsUrl}...`));
        await _open(actionsUrl);
      }
    });
}
