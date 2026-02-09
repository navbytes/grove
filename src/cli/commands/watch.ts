import { execFile } from 'node:child_process';
import type { Command } from 'commander';
import { getWorkspaceDir, loadConfig } from '../../core/config.js';
import { writeContextFile } from '../../core/context.js';
import { GitHubAuthError, GitHubNotConfiguredError } from '../../core/errors.js';
import { fetchFullPRStatus, getGitHubAuth, isGitHubConfigured } from '../../core/github.js';
import { getActiveTasks, loadTasks, saveTasks } from '../../core/tasks.js';
import type { TaskProjectPR } from '../../core/types.js';
import { dim, success } from '../ui/colors.js';

function sendNotification(title: string, message: string): void {
  execFile('osascript', ['-e', `display notification "${message}" with title "${title}"`], () => {
    // Ignore errors — notification is best-effort
  });
}

function prStatusChanged(
  oldPR: TaskProjectPR | null,
  newPR: TaskProjectPR | null,
): { reviewChanged: boolean; ciChanged: boolean; discovered: boolean } {
  if (!newPR) return { reviewChanged: false, ciChanged: false, discovered: false };
  if (!oldPR) return { reviewChanged: false, ciChanged: false, discovered: true };

  return {
    reviewChanged: oldPR.reviewStatus !== newPR.reviewStatus,
    ciChanged: oldPR.ciStatus !== newPR.ciStatus,
    discovered: false,
  };
}

export function registerWatchCommand(program: Command): void {
  program
    .command('watch')
    .description('Watch mode — periodically refresh PR/CI status with desktop notifications')
    .option('-i, --interval <seconds>', 'Polling interval in seconds', '300')
    .action(async (opts: { interval: string }) => {
      if (!(await isGitHubConfigured())) {
        throw new GitHubNotConfiguredError();
      }

      const auth = await getGitHubAuth();
      if (!auth) {
        throw new GitHubAuthError();
      }

      const config = await loadConfig();
      const workspaceDir = getWorkspaceDir(config);
      const interval = Math.max(30, Number.parseInt(opts.interval, 10)) * 1000;

      console.log(success(`Watching active tasks (refreshing every ${interval / 1000}s). Press Ctrl+C to stop.`));
      console.log();

      const refresh = async () => {
        const tasks = await getActiveTasks();
        if (tasks.length === 0) {
          console.log(dim(`  [${new Date().toLocaleTimeString()}] No active tasks.`));
          return;
        }

        const allTasks = await loadTasks();
        let changes = 0;

        for (const task of tasks) {
          for (const project of task.projects) {
            const oldPR = project.pr ? { ...project.pr } : null;

            const result = await fetchFullPRStatus(project.name, project.branch, auth);
            if (!result.success) continue;

            const newPR = result.data ?? null;
            project.pr = newPR;

            const diff = prStatusChanged(oldPR, newPR);

            if (diff.discovered && newPR) {
              console.log(success(`${task.id}: Discovered PR #${newPR.number} for ${project.name}`));
              sendNotification('Grove', `PR #${newPR.number} discovered for ${project.name}`);
              changes++;
            }

            if (diff.reviewChanged && newPR) {
              const msg = `${project.name} PR #${newPR.number}: review ${newPR.reviewStatus}`;
              console.log(success(`${task.id}: ${msg}`));

              if (config.notifications.prApproved && newPR.reviewStatus === 'approved') {
                sendNotification('Grove — PR Approved', `${task.id}: ${project.name} PR #${newPR.number}`);
              }
              changes++;
            }

            if (diff.ciChanged && newPR) {
              const msg = `${project.name} PR #${newPR.number}: CI ${newPR.ciStatus}`;
              console.log(success(`${task.id}: ${msg}`));

              if (config.notifications.ciFailed && newPR.ciStatus === 'failed') {
                sendNotification('Grove — CI Failed', `${task.id}: ${project.name} PR #${newPR.number}`);
              }
              changes++;
            }
          }

          task.updatedAt = new Date().toISOString();
          const idx = allTasks.findIndex((t) => t.id === task.id);
          if (idx !== -1) {
            allTasks[idx] = task;
          }

          await writeContextFile(task, workspaceDir);
        }

        await saveTasks(allTasks);

        if (changes === 0) {
          console.log(dim(`  [${new Date().toLocaleTimeString()}] No changes. ${tasks.length} task(s) checked.`));
        }
      };

      // Initial refresh
      await refresh();

      // Poll on interval
      setInterval(refresh, interval);
    });
}
