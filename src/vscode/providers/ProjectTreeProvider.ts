import * as vscode from 'vscode';
import { loadProjects } from '../../core/projects.js';
import type { Project } from '../../core/types.js';

export class ProjectItem extends vscode.TreeItem {
  constructor(public readonly project: Project) {
    super(project.name, vscode.TreeItemCollapsibleState.None);
    this.description = `${project.path} (${project.defaultBaseBranch})`;
    this.tooltip = new vscode.MarkdownString(
      `**${project.name}**\n\nPath: \`${project.path}\`\n\nDefault branch: \`${project.defaultBaseBranch}\``,
    );
    this.contextValue = 'groveProject';
    this.iconPath = new vscode.ThemeIcon('repo');
  }
}

export class ProjectTreeProvider implements vscode.TreeDataProvider<ProjectItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<ProjectItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  private projects: Project[] = [];

  async refresh(): Promise<void> {
    try {
      this.projects = await loadProjects();
    } catch {
      this.projects = [];
    }
    this._onDidChangeTreeData.fire(undefined);
  }

  getTreeItem(element: ProjectItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: ProjectItem): ProjectItem[] {
    if (element) return [];
    return this.projects.map((p) => new ProjectItem(p));
  }
}
