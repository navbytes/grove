import * as vscode from 'vscode';
import { loadTasks, saveTasks } from '../../core/tasks.js';
import { fetchFullPRStatus, getGitHubAuth, isGitHubConfigured } from '../../core/github.js';
import type { Task, TaskProjectPR } from '../../core/types.js';
import type { TaskTreeProvider } from '../providers/TaskTreeProvider.js';

export class PollingService {
  private timer: ReturnType<typeof setInterval> | undefined;
  private refreshing = false;

  constructor(private readonly taskTree: TaskTreeProvider) {}

  register(context: vscode.ExtensionContext): void {
    const config = vscode.workspace.getConfiguration('grove');
    const autoRefresh = config.get<boolean>('autoRefresh', true);

    if (autoRefresh) {
      this.startPolling(config.get<number>('pollingInterval', 300));
    }

    context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration((e) => {
        if (e.affectsConfiguration('grove.pollingInterval') || e.affectsConfiguration('grove.autoRefresh')) {
          this.restartPolling();
        }
      }),
      { dispose: () => this.stopPolling() },
    );
  }

  async refreshNow(): Promise<void> {
    if (this.refreshing) return;
    this.refreshing = true;

    try {
      if (!(await isGitHubConfigured())) return;

      const auth = await getGitHubAuth();
      if (!auth) return;

      const tasks = await loadTasks();
      const activeTasks = tasks.filter((t) => t.status === 'active');
      let changed = false;

      for (const task of activeTasks) {
        for (const project of task.projects) {
          try {
            const result = await fetchFullPRStatus(project.name, project.branch, auth);
            if (!result.success || !result.data) continue;

            const newPR = result.data;
            const oldPR = project.pr;

            // Detect changes for notifications
            if (oldPR && newPR) {
              this.notifyChanges(task, project.name, oldPR, newPR);
            } else if (!oldPR && newPR) {
              vscode.window.showInformationMessage(
                `Grove: Discovered PR #${newPR.number} for ${project.name} in ${task.id}`,
              );
            }

            project.pr = newPR;
            changed = true;
          } catch {
            // Skip individual project failures
          }
        }
      }

      if (changed) {
        await saveTasks(tasks);
        this.taskTree.refresh();
      }
    } finally {
      this.refreshing = false;
    }
  }

  private notifyChanges(task: Task, projectName: string, oldPR: TaskProjectPR, newPR: TaskProjectPR): void {
    const config = vscode.workspace.getConfiguration('grove');

    if (config.get('notifications.prApproved') && oldPR.reviewStatus !== 'approved' && newPR.reviewStatus === 'approved') {
      vscode.window
        .showInformationMessage(`Grove: PR #${newPR.number} approved for ${projectName} (${task.id})`, 'Open PR')
        .then((action) => {
          if (action === 'Open PR') {
            vscode.env.openExternal(vscode.Uri.parse(newPR.url));
          }
        });
    }

    if (config.get('notifications.ciFailed') && oldPR.ciStatus !== 'failed' && newPR.ciStatus === 'failed') {
      vscode.window
        .showWarningMessage(`Grove: CI failed for ${projectName} PR #${newPR.number} (${task.id})`, 'Open PR')
        .then((action) => {
          if (action === 'Open PR') {
            vscode.env.openExternal(vscode.Uri.parse(`${newPR.url}/checks`));
          }
        });
    }

    if (config.get('notifications.prMerged') && oldPR.status !== 'merged' && newPR.status === 'merged') {
      vscode.window.showInformationMessage(`Grove: PR #${newPR.number} merged for ${projectName} (${task.id})`);
    }
  }

  private startPolling(intervalSeconds: number): void {
    this.stopPolling();
    this.timer = setInterval(() => this.refreshNow(), intervalSeconds * 1000);
  }

  private stopPolling(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  private restartPolling(): void {
    const config = vscode.workspace.getConfiguration('grove');
    const autoRefresh = config.get<boolean>('autoRefresh', true);

    if (autoRefresh) {
      this.startPolling(config.get<number>('pollingInterval', 300));
    } else {
      this.stopPolling();
    }
  }
}
