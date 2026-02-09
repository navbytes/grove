import * as vscode from 'vscode';
import { loadConfig, getWorkspaceDir } from '../../core/config.js';
import { findTask } from '../../core/tasks.js';
import { expandPath } from '../../core/store.js';
import type { Task } from '../../core/types.js';

export class TaskDetectionService {
  private currentTaskId: string | null = null;

  register(context: vscode.ExtensionContext): void {
    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.detect()),
      vscode.window.onDidChangeActiveTextEditor(() => this.detect()),
    );
    this.detect();
  }

  async detect(): Promise<void> {
    const taskId = await this.resolveTaskId();
    const changed = taskId !== this.currentTaskId;
    this.currentTaskId = taskId;

    if (changed) {
      await vscode.commands.executeCommand('setContext', 'grove.taskDetected', !!taskId);
    }
  }

  async getCurrentTaskId(): Promise<string | null> {
    if (this.currentTaskId === null) {
      await this.detect();
    }
    return this.currentTaskId;
  }

  async getCurrentTask(): Promise<Task | null> {
    const id = await this.getCurrentTaskId();
    if (!id) return null;
    return (await findTask(id)) ?? null;
  }

  private async resolveTaskId(): Promise<string | null> {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) return null;

    try {
      const config = await loadConfig();
      const workspaceDir = expandPath(getWorkspaceDir(config));

      for (const folder of folders) {
        const fsPath = folder.uri.fsPath;
        if (fsPath.startsWith(workspaceDir)) {
          const relative = fsPath.slice(workspaceDir.length + 1);
          const taskId = relative.split('/')[0];
          if (taskId) return taskId;
        }
      }
    } catch {
      // Config not initialized yet
    }

    return null;
  }
}
