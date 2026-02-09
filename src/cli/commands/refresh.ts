import type { Command } from 'commander';
import { getWorkspaceDir, loadConfig } from '../../core/config.js';
import { writeContextFile } from '../../core/context.js';
import { GitHubAuthError, GitHubNotConfiguredError } from '../../core/errors.js';
import { fetchFullPRStatus, getGitHubAuth, isGitHubConfigured } from '../../core/github.js';
import { getActiveTasks, saveTasks } from '../../core/tasks.js';
import { success } from '../ui/colors.js';
import { clack } from '../ui/prompts.js';

export function registerRefreshCommand(program: Command): void {
  program
    .command('refresh')
    .description('Refresh PR and CI status for all active tasks')
    .action(async () => {
      if (!(await isGitHubConfigured())) {
        throw new GitHubNotConfiguredError();
      }

      const auth = await getGitHubAuth();
      if (!auth) {
        throw new GitHubAuthError();
      }

      const tasks = await getActiveTasks();
      if (tasks.length === 0) {
        console.log(success('No active tasks to refresh.'));
        return;
      }

      const s = clack.spinner();
      s.start('Refreshing PR status...');

      const config = await loadConfig();
      const workspaceDir = getWorkspaceDir(config);
      const allTasks = await import('../../core/tasks.js').then((m) => m.loadTasks());
      let totalUpdated = 0;

      for (const task of tasks) {
        for (const project of task.projects) {
          const result = await fetchFullPRStatus(project.name, project.branch, auth);
          if (!result.success) continue;

          const previousPR = project.pr;
          const newPR = result.data;

          if (newPR && !previousPR) {
            // Discovered a PR created externally
            project.pr = newPR;
            totalUpdated++;
            s.stop(`${task.id}: Discovered PR #${newPR.number} for ${project.name} (created externally)`);
            s.start('Refreshing PR status...');
          } else if (newPR) {
            project.pr = newPR;
            totalUpdated++;
          }
        }

        // Update task in the full task list
        task.updatedAt = new Date().toISOString();
        const idx = allTasks.findIndex((t) => t.id === task.id);
        if (idx !== -1) {
          allTasks[idx] = task;
        }

        // Regenerate context file
        await writeContextFile(task, workspaceDir);
      }

      await saveTasks(allTasks);
      s.stop(`Refreshed ${totalUpdated} project(s) across ${tasks.length} task(s).`);
    });
}
