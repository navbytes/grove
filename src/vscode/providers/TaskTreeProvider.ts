import * as vscode from 'vscode';
import { loadTasks } from '../../core/tasks.js';
import { categoryDisplayName } from '../../core/links.js';
import type { Task, TaskProject, TaskLink } from '../../core/types.js';

// --- Tree item types ---

export class TaskSectionItem extends vscode.TreeItem {
  constructor(
    public readonly section: 'active' | 'archived',
    count: number,
  ) {
    super(
      section === 'active' ? 'Active Tasks' : 'Archived',
      count > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None,
    );
    this.contextValue = `groveSection-${section}`;
    this.description = `${count}`;
    this.iconPath = new vscode.ThemeIcon(section === 'active' ? 'folder-opened' : 'archive');
  }
}

export class TaskItem extends vscode.TreeItem {
  constructor(public readonly task: Task) {
    super(task.id, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = truncate(task.title, 40);
    this.tooltip = new vscode.MarkdownString(
      `**${task.id}** — ${task.title}\n\n` +
        `Status: ${task.status}\n\n` +
        `Projects: ${task.projects.map((p) => p.name).join(', ')}\n\n` +
        `Created: ${task.createdAt.split('T')[0] ?? task.createdAt}`,
    );
    this.contextValue = task.status === 'active' ? 'groveTask' : 'groveTaskArchived';
    this.iconPath = this.getIcon();
  }

  private getIcon(): vscode.ThemeIcon {
    if (this.task.status === 'archived') {
      return new vscode.ThemeIcon('archive', new vscode.ThemeColor('disabledForeground'));
    }

    const hasFailed = this.task.projects.some((p) => p.pr?.ciStatus === 'failed');
    if (hasFailed) {
      return new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
    }

    const hasChangesRequested = this.task.projects.some((p) => p.pr?.reviewStatus === 'changes_requested');
    if (hasChangesRequested) {
      return new vscode.ThemeIcon('warning', new vscode.ThemeColor('editorWarning.foreground'));
    }

    const allApproved =
      this.task.projects.length > 0 &&
      this.task.projects.every((p) => !p.pr || p.pr.reviewStatus === 'approved');
    const hasPRs = this.task.projects.some((p) => p.pr);
    if (hasPRs && allApproved) {
      return new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
    }

    return new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.blue'));
  }
}

export class TaskGroupItem extends vscode.TreeItem {
  constructor(
    label: string,
    public readonly groupType: 'projects' | 'links' | 'jira',
    public readonly task: Task,
    count: number,
  ) {
    super(label, count > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
    this.description = `${count}`;
    this.contextValue = `groveGroup-${groupType}`;
    this.iconPath = new vscode.ThemeIcon(
      groupType === 'projects' ? 'repo' : groupType === 'links' ? 'link' : 'issues',
    );
  }
}

export class TaskProjectItem extends vscode.TreeItem {
  constructor(
    public readonly task: Task,
    public readonly project: TaskProject,
  ) {
    super(project.name, vscode.TreeItemCollapsibleState.None);
    this.description = this.buildDescription();
    this.tooltip = this.buildTooltip();
    this.contextValue = project.pr ? 'groveTaskProjectWithPR' : 'groveTaskProjectNoPR';
    this.iconPath = this.getIcon();
  }

  private buildDescription(): string {
    const parts: string[] = [];
    if (this.project.pr) {
      parts.push(`PR #${this.project.pr.number}`);
      if (this.project.pr.reviewStatus !== 'none') {
        const reviewMap: Record<string, string> = {
          approved: 'approved',
          changes_requested: 'changes requested',
          pending: 'review pending',
        };
        parts.push(reviewMap[this.project.pr.reviewStatus] ?? '');
      }
      if (this.project.pr.ciStatus !== 'none') {
        const ciMap: Record<string, string> = {
          passed: 'CI passed',
          failed: 'CI failed',
          pending: 'CI pending',
        };
        parts.push(ciMap[this.project.pr.ciStatus] ?? '');
      }
    } else {
      parts.push('no PR');
    }
    return parts.filter(Boolean).join(' | ');
  }

  private buildTooltip(): vscode.MarkdownString {
    const lines = [
      `**${this.project.name}**`,
      `Branch: \`${this.project.branch}\``,
      `Base: \`${this.project.baseBranch}\``,
    ];
    if (this.project.pr) {
      lines.push(
        `PR: [#${this.project.pr.number}](${this.project.pr.url})`,
        `Review: ${this.project.pr.reviewStatus}`,
        `CI: ${this.project.pr.ciStatus}`,
      );
    }
    const md = new vscode.MarkdownString(lines.join('\n\n'));
    md.isTrusted = true;
    return md;
  }

  private getIcon(): vscode.ThemeIcon {
    if (!this.project.pr) {
      return new vscode.ThemeIcon('git-branch');
    }
    if (this.project.pr.ciStatus === 'failed') {
      return new vscode.ThemeIcon('error', new vscode.ThemeColor('errorForeground'));
    }
    if (this.project.pr.reviewStatus === 'changes_requested') {
      return new vscode.ThemeIcon('request-changes', new vscode.ThemeColor('editorWarning.foreground'));
    }
    if (this.project.pr.reviewStatus === 'approved' && this.project.pr.ciStatus === 'passed') {
      return new vscode.ThemeIcon('pass', new vscode.ThemeColor('testing.iconPassed'));
    }
    return new vscode.ThemeIcon('git-pull-request', new vscode.ThemeColor('charts.yellow'));
  }
}

export class LinkItem extends vscode.TreeItem {
  constructor(
    public readonly task: Task,
    public readonly link: TaskLink,
    public readonly linkIndex: number,
  ) {
    super(link.label, vscode.TreeItemCollapsibleState.None);
    this.description = categoryDisplayName(link.category);
    this.tooltip = link.url;
    this.contextValue = 'groveLink';
    this.iconPath = this.getCategoryIcon();
    this.command = {
      command: 'grove.link.open',
      title: 'Open Link',
      arguments: [this],
    };
  }

  private getCategoryIcon(): vscode.ThemeIcon {
    const iconMap: Record<string, string> = {
      slack: 'comment-discussion',
      github: 'github',
      jira: 'issues',
      buildkite: 'server-process',
      confluence: 'book',
      figma: 'paintcan',
      notion: 'notebook',
      'google-docs': 'file-text',
      misc: 'link',
    };
    return new vscode.ThemeIcon(iconMap[this.link.category] ?? 'link');
  }
}

export class JiraTicketItem extends vscode.TreeItem {
  constructor(
    public readonly task: Task,
    public readonly ticketId: string,
  ) {
    super(ticketId, vscode.TreeItemCollapsibleState.None);
    this.tooltip = task.jiraUrl || `Jira: ${ticketId}`;
    this.contextValue = 'groveJiraTicket';
    this.iconPath = new vscode.ThemeIcon('issues');
    if (task.jiraUrl) {
      this.command = {
        command: 'grove.jira.open',
        title: 'Open Jira',
        arguments: [this],
      };
    }
  }
}

// --- Tree data types ---

type TreeElement = TaskSectionItem | TaskItem | TaskGroupItem | TaskProjectItem | LinkItem | JiraTicketItem;

// --- Provider ---

export class TaskTreeProvider implements vscode.TreeDataProvider<TreeElement> {
  private _onDidChangeTreeData = new vscode.EventEmitter<TreeElement | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private tasks: Task[] = [];
  private showArchived = true;

  async refresh(): Promise<void> {
    try {
      this.tasks = await loadTasks();
    } catch {
      this.tasks = [];
    }
    this._onDidChangeTreeData.fire(undefined);
  }

  toggleArchived(): void {
    this.showArchived = !this.showArchived;
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: TreeElement): vscode.TreeItem {
    return element;
  }

  getChildren(element?: TreeElement): TreeElement[] {
    if (!element) {
      return this.getRootChildren();
    }

    if (element instanceof TaskSectionItem) {
      const filtered = this.tasks.filter((t) =>
        element.section === 'active' ? t.status === 'active' : t.status === 'archived',
      );
      return filtered.map((t) => new TaskItem(t));
    }

    if (element instanceof TaskItem) {
      return this.getTaskChildren(element.task);
    }

    if (element instanceof TaskGroupItem) {
      return this.getGroupChildren(element);
    }

    return [];
  }

  private getRootChildren(): TreeElement[] {
    const active = this.tasks.filter((t) => t.status === 'active');
    const archived = this.tasks.filter((t) => t.status === 'archived');

    // If no archived tasks or archived hidden, just show active tasks directly
    if (!this.showArchived || archived.length === 0) {
      return active.map((t) => new TaskItem(t));
    }

    return [new TaskSectionItem('active', active.length), new TaskSectionItem('archived', archived.length)];
  }

  private getTaskChildren(task: Task): TreeElement[] {
    const children: TreeElement[] = [];

    if (task.projects.length > 0) {
      children.push(new TaskGroupItem('Projects', 'projects', task, task.projects.length));
    }

    if (task.links.length > 0) {
      children.push(new TaskGroupItem('Links', 'links', task, task.links.length));
    }

    if (task.jiraTickets.length > 0) {
      children.push(new TaskGroupItem('Jira', 'jira', task, task.jiraTickets.length));
    }

    return children;
  }

  private getGroupChildren(group: TaskGroupItem): TreeElement[] {
    const task = group.task;

    switch (group.groupType) {
      case 'projects':
        return task.projects.map((p) => new TaskProjectItem(task, p));
      case 'links':
        return task.links.map((l, i) => new LinkItem(task, l, i));
      case 'jira':
        return task.jiraTickets.map((t) => new JiraTicketItem(task, t));
    }
  }
}

function truncate(str: string, len: number): string {
  return str.length > len ? `${str.slice(0, len - 1)}…` : str;
}
