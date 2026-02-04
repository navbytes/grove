/**
 * Status bar management for Grove
 */

import * as vscode from 'vscode';
import { Task, TaskProject } from '../core/types';
import { getTask } from '../core/store';
import { getTaskIdFromWorkspace } from '../core/workspace';

/**
 * Grove status bar manager
 */
export class GroveStatusBar {
  private statusBarItem: vscode.StatusBarItem;
  private currentTaskId: string | null = null;

  constructor(private context: vscode.ExtensionContext) {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'grove.showStatusMenu';

    // Register the status menu command
    context.subscriptions.push(
      vscode.commands.registerCommand('grove.showStatusMenu', () => this.showStatusMenu())
    );

    // Update on workspace change
    context.subscriptions.push(
      vscode.workspace.onDidChangeWorkspaceFolders(() => this.update())
    );

    // Initial update
    this.update();
    context.subscriptions.push(this.statusBarItem);
  }

  /**
   * Update the status bar based on current workspace
   */
  update(): void {
    const task = this.getCurrentTask();

    if (!task) {
      this.statusBarItem.hide();
      this.currentTaskId = null;
      return;
    }

    this.currentTaskId = task.id;
    this.statusBarItem.text = this.formatStatusText(task);
    this.statusBarItem.tooltip = this.formatTooltip(task);
    this.statusBarItem.show();
  }

  /**
   * Update with specific task data
   */
  updateWithTask(task: Task): void {
    if (this.currentTaskId !== task.id) {
      return;
    }

    this.statusBarItem.text = this.formatStatusText(task);
    this.statusBarItem.tooltip = this.formatTooltip(task);
  }

  /**
   * Dispose the status bar
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }

  /**
   * Get the current task from workspace
   */
  private getCurrentTask(): Task | null {
    const workspaceFile = vscode.workspace.workspaceFile;
    if (!workspaceFile) {
      return null;
    }

    const taskId = getTaskIdFromWorkspace(workspaceFile.fsPath);
    if (!taskId) {
      return null;
    }

    const result = getTask(taskId);
    return result.data || null;
  }

  /**
   * Format the status bar text
   */
  private formatStatusText(task: Task): string {
    const parts: string[] = [`$(tasklist) ${task.id}`];

    // Add project summaries (max 2)
    const projectSummaries = task.projects.slice(0, 2).map((p) => {
      if (p.prs.length > 0) {
        const prIcon = this.getPRStatusIcon(p);
        const ciIcon = this.getCIStatusIcon(p);
        const prCount = p.prs.length > 1 ? ` (+${p.prs.length - 1})` : '';
        return `${p.name}: PR #${p.prs[0].number}${prCount} ${prIcon}${ciIcon}`;
      }
      return `${p.name}: No PR`;
    });

    if (projectSummaries.length > 0) {
      parts.push(projectSummaries.join(' | '));
    }

    if (task.projects.length > 2) {
      parts.push(`+${task.projects.length - 2} more`);
    }

    return parts.join(' | ');
  }

  /**
   * Format the tooltip
   */
  private formatTooltip(task: Task): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`### ${task.id}: ${task.title}\n\n`);

    if (task.jiraTickets.length > 0) {
      md.appendMarkdown(`**Jira:** ${task.jiraTickets.join(', ')}\n\n`);
    }

    md.appendMarkdown('**Projects:**\n');
    for (const project of task.projects) {
      if (project.prs.length > 0) {
        const prList = project.prs.map((pr) =>
          `PR #${pr.number} (${pr.reviewStatus}, CI: ${pr.ciStatus})`
        ).join(', ');
        md.appendMarkdown(`- ${project.name}: ${prList}\n`);
      } else {
        md.appendMarkdown(`- ${project.name}: No PR\n`);
      }
    }

    if (task.slackThreads.length > 0) {
      md.appendMarkdown(`\n**Slack Threads:** ${task.slackThreads.length}\n`);
    }

    md.appendMarkdown('\n*Click for actions*');
    return md;
  }

  /**
   * Get PR status icon (based on primary PR)
   */
  private getPRStatusIcon(project: TaskProject): string {
    if (project.prs.length === 0) {
      return '';
    }

    switch (project.prs[0].reviewStatus) {
      case 'approved':
        return '$(check)';
      case 'changes_requested':
        return '$(warning)';
      default:
        return '$(git-pull-request)';
    }
  }

  /**
   * Get CI status icon (based on primary PR)
   */
  private getCIStatusIcon(project: TaskProject): string {
    if (project.prs.length === 0) {
      return '';
    }

    switch (project.prs[0].ciStatus) {
      case 'passed':
        return '$(pass)';
      case 'failed':
        return '$(error)';
      case 'running':
        return '$(sync~spin)';
      default:
        return '';
    }
  }

  /**
   * Show the status menu
   */
  private async showStatusMenu(): Promise<void> {
    const task = this.getCurrentTask();
    if (!task) {
      return;
    }

    const items: vscode.QuickPickItem[] = [
      {
        label: '$(link-external) Open Jira',
        description: task.jiraTickets.join(', '),
      },
      {
        label: '$(refresh) Refresh Status',
        description: 'Update PR and CI status',
      },
      {
        label: '$(git-pull-request) Open All PRs',
        description: 'Open all project PRs in browser',
      },
    ];

    if (task.slackThreads.length > 0) {
      items.push({
        label: '$(comment-discussion) Open Slack Threads',
        description: `${task.slackThreads.length} thread(s)`,
      });
    }

    items.push({
      label: '$(notebook) Open Task Notes',
      description: '.grove-context.md',
    });

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: `${task.id}: ${task.title}`,
    });

    if (!selected) {
      return;
    }

    switch (selected.label) {
      case '$(link-external) Open Jira':
        vscode.commands.executeCommand('grove.openJira');
        break;
      case '$(refresh) Refresh Status':
        vscode.commands.executeCommand('grove.refreshStatus');
        break;
      case '$(git-pull-request) Open All PRs':
        this.openAllPRs(task);
        break;
      case '$(comment-discussion) Open Slack Threads':
        vscode.commands.executeCommand('grove.openSlackThread');
        break;
      case '$(notebook) Open Task Notes':
        vscode.commands.executeCommand('grove.taskNotes');
        break;
    }
  }

  /**
   * Open all PRs for a task
   */
  private openAllPRs(task: Task): void {
    for (const project of task.projects) {
      for (const pr of project.prs) {
        vscode.env.openExternal(vscode.Uri.parse(pr.url));
      }
    }
  }
}
