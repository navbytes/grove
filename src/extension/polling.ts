/**
 * Background polling for Grove
 * Periodically updates PR and CI status for active tasks
 */

import * as vscode from 'vscode';
import { Task, SECRET_KEYS } from '../core/types';
import { readConfig } from '../core/config';
import { getActiveTasks, updateTask } from '../core/store';
import { generateContextFile } from '../core/context';
import { createGitHubClient } from '../core/github';
import { prDetailsToInfo } from '../core/git-provider';
import { extractRepoOwner, extractRepoName, getRemoteUrl } from '../core/projects';
import { GroveSidebarProvider } from './sidebar';
import { GroveStatusBar } from './statusbar';

/**
 * Background polling manager
 */
export class GrovePolling {
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor(
    private context: vscode.ExtensionContext,
    private sidebarProvider: GroveSidebarProvider,
    private statusBar: GroveStatusBar
  ) {}

  /**
   * Start background polling
   */
  start(): void {
    if (this.pollingInterval) {
      return;
    }

    const config = readConfig();
    const intervalSeconds = config.data?.pollingInterval || 300;

    this.pollingInterval = setInterval(
      () => this.poll(),
      intervalSeconds * 1000
    );

    // Initial poll
    this.poll();
  }

  /**
   * Stop background polling
   */
  stop(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /**
   * Manually trigger a refresh
   */
  refreshNow(): void {
    this.poll();
  }

  /**
   * Poll for updates
   */
  private async poll(): Promise<void> {
    // Don't poll if another poll is in progress
    if (this.isPolling) {
      return;
    }

    // Don't poll if window is not focused
    if (!vscode.window.state.focused) {
      return;
    }

    this.isPolling = true;

    try {
      await this.updateAllTasks();
    } catch (error) {
      console.error('Grove polling error:', error);
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Update all active tasks
   */
  private async updateAllTasks(): Promise<void> {
    const config = readConfig();
    if (!config.success || !config.data?.git) {
      return;
    }

    const token = await this.context.secrets.get(SECRET_KEYS.GIT_API_TOKEN);
    if (!token) {
      return;
    }

    const tasksResult = getActiveTasks();
    if (!tasksResult.success || !tasksResult.data || tasksResult.data.length === 0) {
      return;
    }

    const client = createGitHubClient();
    client.setToken(token);

    let hasUpdates = false;

    for (const task of tasksResult.data) {
      const taskUpdated = await this.updateTask(task, client);
      if (taskUpdated) {
        hasUpdates = true;
      }
    }

    if (hasUpdates) {
      this.sidebarProvider.refresh();
      this.statusBar.update();
    }
  }

  /**
   * Update a single task
   */
  private async updateTask(
    task: Task,
    client: ReturnType<typeof createGitHubClient>
  ): Promise<boolean> {
    let hasChanges = false;
    const previousStates = new Map<string, { reviewStatus: string; ciStatus: string; prStatus: string }>();

    // Store previous states for notifications
    for (const project of task.projects) {
      if (project.pr) {
        previousStates.set(project.name, {
          reviewStatus: project.pr.reviewStatus,
          ciStatus: project.pr.ciStatus,
          prStatus: project.pr.status,
        });
      }
    }

    // Update each project
    for (const project of task.projects) {
      if (!project.pr) {
        continue;
      }

      const remoteResult = await getRemoteUrl(project.repoPath);
      if (!remoteResult.success || !remoteResult.data) {
        continue;
      }

      const owner = extractRepoOwner(remoteResult.data);
      const repo = extractRepoName(remoteResult.data);

      if (!owner || repo) {
        continue;
      }

      const prResult = await client.getPR(owner, repo!, project.pr.number);
      if (!prResult.success || !prResult.data) {
        continue;
      }

      const newInfo = prDetailsToInfo(prResult.data);
      const previousState = previousStates.get(project.name);

      // Check for changes
      if (
        project.pr.reviewStatus !== newInfo.reviewStatus ||
        project.pr.ciStatus !== newInfo.ciStatus ||
        project.pr.status !== newInfo.status
      ) {
        hasChanges = true;
        project.pr = newInfo;

        // Send notifications
        if (previousState) {
          await this.sendNotifications(task, project.name, previousState, newInfo);
        }
      }
    }

    if (hasChanges) {
      await updateTask(task.id, { projects: task.projects });
      generateContextFile(task);
    }

    return hasChanges;
  }

  /**
   * Send notifications for status changes
   */
  private async sendNotifications(
    task: Task,
    projectName: string,
    previousState: { reviewStatus: string; ciStatus: string; prStatus: string },
    newState: { reviewStatus: string; ciStatus: string; status: string }
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration('grove.notifications');

    // PR Approved
    if (
      config.get('prApproved', true) &&
      previousState.reviewStatus !== 'approved' &&
      newState.reviewStatus === 'approved'
    ) {
      const action = await vscode.window.showInformationMessage(
        `PR approved: ${task.id} / ${projectName}`,
        'Open PR'
      );
      if (action === 'Open PR') {
        const project = task.projects.find((p) => p.name === projectName);
        if (project?.pr) {
          vscode.env.openExternal(vscode.Uri.parse(project.pr.url));
        }
      }
    }

    // CI Failed
    if (
      config.get('ciFailed', true) &&
      previousState.ciStatus !== 'failed' &&
      newState.ciStatus === 'failed'
    ) {
      const action = await vscode.window.showWarningMessage(
        `CI failed: ${task.id} / ${projectName}`,
        'Open CI'
      );
      if (action === 'Open CI') {
        vscode.commands.executeCommand('grove.openCI');
      }
    }

    // PR Merged
    if (
      config.get('prMerged', true) &&
      previousState.prStatus !== 'merged' &&
      newState.status === 'merged'
    ) {
      vscode.window.showInformationMessage(
        `PR merged: ${task.id} / ${projectName}`
      );
    }
  }
}
