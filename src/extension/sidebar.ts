/**
 * Sidebar tree view for Grove
 */

import * as vscode from 'vscode';
import {
  Task,
  Project,
  TaskProject,
  PRStatus,
  ReviewStatus,
  CIStatus,
} from '../core/types';
import { readTasks, getActiveTasks, getArchivedTasks } from '../core/store';
import { readProjects } from '../core/projects';

/**
 * Tree item types
 */
type TreeItemType =
  | 'section'
  | 'task'
  | 'taskProject'
  | 'project'
  | 'slackThread';

/**
 * Tree item data
 */
interface GroveTreeItemData {
  type: TreeItemType;
  task?: Task;
  taskProject?: TaskProject;
  project?: Project;
  slackThread?: { url: string; title?: string };
  sectionName?: string;
}

/**
 * Grove tree item
 */
class GroveTreeItem extends vscode.TreeItem {
  constructor(
    public readonly data: GroveTreeItemData,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState
  ) {
    super('', collapsibleState);
    this.setupItem();
  }

  private setupItem(): void {
    switch (this.data.type) {
      case 'section':
        this.setupSection();
        break;
      case 'task':
        this.setupTask();
        break;
      case 'taskProject':
        this.setupTaskProject();
        break;
      case 'project':
        this.setupProject();
        break;
      case 'slackThread':
        this.setupSlackThread();
        break;
    }
  }

  private setupSection(): void {
    this.label = this.data.sectionName || '';
    this.contextValue = 'section';
  }

  private setupTask(): void {
    const task = this.data.task!;
    this.label = task.id;
    this.description = task.title;
    this.tooltip = `${task.id}: ${task.title}\n${task.projects.length} project(s)`;
    this.contextValue = task.status === 'archived' ? 'archivedTask' : 'activeTask';
    this.iconPath = new vscode.ThemeIcon(
      task.status === 'archived' ? 'archive' : 'tasklist'
    );

    // Click to open
    this.command = {
      command: 'grove.openTaskFromSidebar',
      title: 'Open Task',
      arguments: [task.id],
    };
  }

  private setupTaskProject(): void {
    const project = this.data.taskProject!;
    this.label = project.name;
    this.contextValue = 'taskProject';

    // Build description with PR and CI status
    const parts: string[] = [];
    if (project.pr) {
      parts.push(`PR #${project.pr.number} ${this.getPRIcon(project.pr.status, project.pr.reviewStatus)}`);
      parts.push(`CI ${this.getCIIcon(project.pr.ciStatus)}`);
    } else {
      parts.push('No PR');
    }
    this.description = parts.join(' | ');

    // Tooltip with more details
    const tooltipParts = [
      `Branch: ${project.branch}`,
      `Base: ${project.baseBranch}`,
    ];
    if (project.pr) {
      tooltipParts.push(`PR: #${project.pr.number} (${project.pr.status})`);
      tooltipParts.push(`Review: ${project.pr.reviewStatus}`);
      tooltipParts.push(`CI: ${project.pr.ciStatus}`);
    }
    this.tooltip = tooltipParts.join('\n');

    // Icon based on PR status
    if (project.pr) {
      this.iconPath = this.getPRThemeIcon(project.pr.status, project.pr.reviewStatus);
    } else {
      this.iconPath = new vscode.ThemeIcon('git-branch');
    }
  }

  private setupProject(): void {
    const project = this.data.project!;
    this.label = project.name;
    this.description = project.path;
    this.tooltip = `${project.name}\n${project.path}\nDefault branch: ${project.defaultBaseBranch}`;
    this.contextValue = 'registeredProject';
    this.iconPath = new vscode.ThemeIcon('repo');
  }

  private setupSlackThread(): void {
    const thread = this.data.slackThread!;
    this.label = thread.title || 'Slack Thread';
    this.description = thread.title ? undefined : thread.url;
    this.tooltip = thread.url;
    this.contextValue = 'slackThread';
    this.iconPath = new vscode.ThemeIcon('comment-discussion');

    this.command = {
      command: 'vscode.open',
      title: 'Open Slack Thread',
      arguments: [vscode.Uri.parse(thread.url)],
    };
  }

  private getPRIcon(status: PRStatus, reviewStatus: ReviewStatus): string {
    if (status === 'merged') {
      return '✓';
    }
    if (status === 'closed') {
      return '✗';
    }
    if (status === 'draft') {
      return '◐';
    }
    // Open PR
    switch (reviewStatus) {
      case 'approved':
        return '✓';
      case 'changes_requested':
        return '!';
      default:
        return '○';
    }
  }

  private getCIIcon(status: CIStatus): string {
    switch (status) {
      case 'passed':
        return '✓';
      case 'failed':
        return '✗';
      case 'running':
        return '◐';
      case 'cancelled':
        return '○';
      default:
        return '○';
    }
  }

  private getPRThemeIcon(status: PRStatus, reviewStatus: ReviewStatus): vscode.ThemeIcon {
    if (status === 'merged') {
      return new vscode.ThemeIcon('git-merge', new vscode.ThemeColor('charts.green'));
    }
    if (status === 'closed') {
      return new vscode.ThemeIcon('git-pull-request-closed', new vscode.ThemeColor('charts.red'));
    }
    if (status === 'draft') {
      return new vscode.ThemeIcon('git-pull-request-draft');
    }
    // Open PR
    switch (reviewStatus) {
      case 'approved':
        return new vscode.ThemeIcon('git-pull-request', new vscode.ThemeColor('charts.green'));
      case 'changes_requested':
        return new vscode.ThemeIcon('git-pull-request', new vscode.ThemeColor('charts.yellow'));
      default:
        return new vscode.ThemeIcon('git-pull-request');
    }
  }
}

/**
 * Grove sidebar tree data provider
 */
export class GroveSidebarProvider implements vscode.TreeDataProvider<GroveTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<GroveTreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  constructor(private context: vscode.ExtensionContext) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: GroveTreeItem): vscode.TreeItem {
    return element;
  }

  async getChildren(element?: GroveTreeItem): Promise<GroveTreeItem[]> {
    if (!element) {
      // Root level: sections
      return this.getRootItems();
    }

    switch (element.data.type) {
      case 'section':
        return this.getSectionChildren(element.data.sectionName!);
      case 'task':
        return this.getTaskChildren(element.data.task!);
      default:
        return [];
    }
  }

  private getRootItems(): GroveTreeItem[] {
    return [
      new GroveTreeItem(
        { type: 'section', sectionName: 'Active Tasks' },
        vscode.TreeItemCollapsibleState.Expanded
      ),
      new GroveTreeItem(
        { type: 'section', sectionName: 'Archived Tasks' },
        vscode.TreeItemCollapsibleState.Collapsed
      ),
      new GroveTreeItem(
        { type: 'section', sectionName: 'Projects' },
        vscode.TreeItemCollapsibleState.Collapsed
      ),
    ];
  }

  private getSectionChildren(sectionName: string): GroveTreeItem[] {
    switch (sectionName) {
      case 'Active Tasks':
        return this.getActiveTasks();
      case 'Archived Tasks':
        return this.getArchivedTasks();
      case 'Projects':
        return this.getProjects();
      default:
        return [];
    }
  }

  private getActiveTasks(): GroveTreeItem[] {
    const result = getActiveTasks();
    if (!result.success || !result.data) {
      return [];
    }

    return result.data.map(
      (task) =>
        new GroveTreeItem(
          { type: 'task', task },
          vscode.TreeItemCollapsibleState.Collapsed
        )
    );
  }

  private getArchivedTasks(): GroveTreeItem[] {
    const result = getArchivedTasks();
    if (!result.success || !result.data) {
      return [];
    }

    return result.data.map(
      (task) =>
        new GroveTreeItem(
          { type: 'task', task },
          vscode.TreeItemCollapsibleState.Collapsed
        )
    );
  }

  private getProjects(): GroveTreeItem[] {
    const result = readProjects();
    if (!result.success || !result.data) {
      return [];
    }

    return result.data.map(
      (project) =>
        new GroveTreeItem(
          { type: 'project', project },
          vscode.TreeItemCollapsibleState.None
        )
    );
  }

  private getTaskChildren(task: Task): GroveTreeItem[] {
    const items: GroveTreeItem[] = [];

    // Add projects
    for (const project of task.projects) {
      items.push(
        new GroveTreeItem(
          { type: 'taskProject', taskProject: project },
          vscode.TreeItemCollapsibleState.None
        )
      );
    }

    // Add Slack threads
    for (const thread of task.slackThreads) {
      items.push(
        new GroveTreeItem(
          { type: 'slackThread', slackThread: thread },
          vscode.TreeItemCollapsibleState.None
        )
      );
    }

    return items;
  }
}
