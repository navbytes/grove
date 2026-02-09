import { execFile, spawn } from 'node:child_process';
import type { Command } from 'commander';
import { getWorkspaceDir, loadConfig } from '../../core/config.js';
import { GroveError, TaskNotFoundError } from '../../core/errors.js';
import { dirExists } from '../../core/store.js';
import { findTask, getTaskWorkspacePath } from '../../core/tasks.js';
import { info, success } from '../ui/colors.js';

export function registerOpenCommand(program: Command): void {
  program
    .command('open <task>')
    .description('Open a task workspace')
    .option('--cd', 'Print the workspace path instead of spawning a shell')
    .option('--code', 'Open in VS Code')
    .option('-p, --project <name>', 'Open a specific project within the task')
    .action(async (taskArg: string, opts: { cd?: boolean; code?: boolean; project?: string }) => {
      const task = await findTask(taskArg);
      if (!task) {
        throw new TaskNotFoundError(taskArg);
      }

      const config = await loadConfig();
      const workspaceDir = getWorkspaceDir(config);
      let targetDir = getTaskWorkspacePath(workspaceDir, task.id);

      // If a specific project is requested, cd into that project's worktree
      if (opts.project) {
        const project = task.projects.find((p) => p.name === opts.project);
        if (!project) {
          throw new GroveError(`Project "${opts.project}" not found in task "${task.id}".`, {
            suggestion: 'Run `grove status` to see projects in this task.',
          });
        }
        targetDir = project.worktreePath;
      }

      if (!(await dirExists(targetDir))) {
        throw new GroveError(`Workspace directory does not exist: ${targetDir}`, {
          suggestion: 'The task workspace may have been deleted. Run `grove delete` and recreate.',
        });
      }

      if (opts.cd) {
        // Output only the path — no decoration, so eval $(grove open X --cd) works
        process.stdout.write(targetDir);
        return;
      }

      if (opts.code) {
        execFile('code', [targetDir], (err) => {
          if (err) {
            console.error('Failed to open VS Code. Is `code` in your PATH?');
            process.exit(1);
          }
        });
        console.log(success(`Opening ${targetDir} in VS Code...`));
        return;
      }

      // Default: spawn shell
      const shell = process.env.SHELL || '/bin/zsh';
      const projectNames = task.projects.map((p) => p.name).join(',');

      console.log(info('Entering task workspace...'));
      const child = spawn(shell, [], {
        cwd: targetDir,
        stdio: 'inherit',
        env: {
          ...process.env,
          GROVE_TASK: task.id,
          GROVE_TASK_DIR: getTaskWorkspacePath(workspaceDir, task.id),
          GROVE_PROJECTS: projectNames,
        },
      });

      child.on('close', (code) => {
        process.exit(code || 0);
      });
    });
}
