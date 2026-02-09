import type { Command } from 'commander';
import slugify from 'slugify';
import { generateBranchName, getWorkspaceDir, loadConfig } from '../../core/config.js';
import { GroveError, NotInTaskError } from '../../core/errors.js';
import { loadProjects } from '../../core/projects.js';
import { addProjectToTask, detectCurrentTask, removeProjectFromTask } from '../../core/tasks.js';
import { warn } from '../ui/colors.js';
import { clack, promptCheckbox, promptConfirm } from '../ui/prompts.js';

export function registerTaskCommand(program: Command): void {
  const taskCmd = program.command('task').description('Manage projects within the current task');

  taskCmd
    .command('add-project [project]')
    .description('Add a project to the current task')
    .action(async (projectArg?: string) => {
      const task = await detectCurrentTask();
      if (!task) {
        throw new NotInTaskError();
      }

      const config = await loadConfig();
      const workspaceDir = getWorkspaceDir(config);
      const allProjects = await loadProjects();

      // Filter out projects already in the task
      const existingNames = new Set(task.projects.map((p) => p.name));
      const available = allProjects.filter((p) => !existingNames.has(p.name));

      if (available.length === 0) {
        console.log(warn('All registered projects are already in this task.'));
        return;
      }

      let projectsToAdd: import('../../core/types.js').Project[];
      if (projectArg) {
        const project = available.find((p) => p.name === projectArg);
        if (!project) {
          throw new GroveError(`Project "${projectArg}" not found or already in task.`, {
            suggestion: 'Run `grove project list` to see registered projects.',
          });
        }
        projectsToAdd = [project];
      } else {
        projectsToAdd = await promptCheckbox(
          'Select projects to add:',
          available.map((p) => ({ name: p.name, value: p })),
        );
      }

      const slug = slugify(task.title, { lower: true, strict: true });

      const s = clack.spinner();
      for (const project of projectsToAdd) {
        s.start(`Creating worktree for ${project.name}...`);
        const branch = generateBranchName(config.branchTemplate, {
          ticketId: task.id,
          slug,
          title: task.title,
        });

        const result = await addProjectToTask(task.id, project, branch, project.defaultBaseBranch, config.workspaceDir);

        if (result.success) {
          s.stop(`${project.name} -> ${workspaceDir}/${task.id}/${project.name} (branch: ${branch})`);
        } else {
          s.stop(`${project.name} -- ${result.error}`);
        }
      }
    });

  taskCmd
    .command('remove-project <project>')
    .description('Remove a project from the current task')
    .action(async (projectName: string) => {
      const task = await detectCurrentTask();
      if (!task) {
        throw new NotInTaskError();
      }

      const project = task.projects.find((p) => p.name === projectName);
      if (!project) {
        throw new GroveError(`Project "${projectName}" not found in task "${task.id}".`, {
          suggestion: 'Run `grove status` to see projects in this task.',
        });
      }

      console.log();
      console.log(warn(`This will remove the worktree at ${project.worktreePath}`));
      console.log(warn('and delete any uncommitted changes.'));
      console.log();

      const confirmed = await promptConfirm('Are you sure?', false);
      if (!confirmed) return;

      const s = clack.spinner();
      s.start(`Removing ${projectName}...`);

      const result = await removeProjectFromTask(task.id, projectName);
      if (result.success) {
        s.stop(`Removed ${projectName} from ${task.id}`);
      } else {
        s.stop(result.error || 'Failed to remove project.');
      }
    });
}
