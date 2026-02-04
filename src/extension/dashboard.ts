import * as vscode from 'vscode';
import { Task } from '../core/types';
import { archiveTask, deleteTaskCompletely } from '../core/tasks';
import { readTasks, getTask } from '../core/store';

interface DashboardData {
  tasks: Task[];
  currentTaskId?: string;
}

type MessageToExtension =
  | { type: 'openTask'; taskId: string }
  | { type: 'archiveTask'; taskId: string }
  | { type: 'deleteTask'; taskId: string }
  | { type: 'newTask' }
  | { type: 'openJira'; taskId: string }
  | { type: 'openPR'; taskId: string; projectName: string }
  | { type: 'openCI'; taskId: string; projectName: string }
  | { type: 'openSlack'; url: string }
  | { type: 'openLink'; url: string }
  | { type: 'createPR'; taskId: string; projectName: string }
  | { type: 'linkPR'; taskId: string; projectName: string }
  | { type: 'refresh' }
  | { type: 'ready' };

export class GroveDashboardPanel {
  public static currentPanel: GroveDashboardPanel | undefined;
  private static readonly viewType = 'groveDashboard';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (GroveDashboardPanel.currentPanel) {
      GroveDashboardPanel.currentPanel._panel.reveal(column);
      GroveDashboardPanel.currentPanel._update();
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      GroveDashboardPanel.viewType,
      'Grove Dashboard',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'webview-ui', 'build'),
        ],
      }
    );

    GroveDashboardPanel.currentPanel = new GroveDashboardPanel(
      panel,
      extensionUri
    );
  }

  public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    GroveDashboardPanel.currentPanel = new GroveDashboardPanel(
      panel,
      extensionUri
    );
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message: MessageToExtension) => this._handleMessage(message),
      null,
      this._disposables
    );
  }

  public dispose() {
    GroveDashboardPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  public refresh() {
    this._update();
  }

  private async _handleMessage(message: MessageToExtension) {
    switch (message.type) {
      case 'ready':
        this._sendData();
        break;

      case 'refresh':
        this._sendData();
        break;

      case 'newTask':
        await vscode.commands.executeCommand('grove.newTask');
        this._sendData();
        break;

      case 'openTask':
        await vscode.commands.executeCommand('grove.openTask', message.taskId);
        this._sendData();
        break;

      case 'archiveTask': {
        const confirmArchive = await vscode.window.showWarningMessage(
          'Archive this task?',
          { modal: true },
          'Archive'
        );
        if (confirmArchive === 'Archive') {
          await archiveTask(message.taskId);
          this._sendData();
          vscode.window.showInformationMessage('Task archived');
        }
        break;
      }

      case 'deleteTask': {
        const confirmDelete = await vscode.window.showWarningMessage(
          'Delete this task permanently? This cannot be undone.',
          { modal: true },
          'Delete'
        );
        if (confirmDelete === 'Delete') {
          await deleteTaskCompletely(message.taskId);
          this._sendData();
          vscode.window.showInformationMessage('Task deleted');
        }
        break;
      }

      case 'openJira': {
        const taskResult = getTask(message.taskId);
        if (taskResult.success && taskResult.data?.jiraUrl) {
          vscode.env.openExternal(vscode.Uri.parse(taskResult.data.jiraUrl));
        }
        break;
      }

      case 'openPR': {
        const taskResult = getTask(message.taskId);
        if (taskResult.success && taskResult.data) {
          const project = taskResult.data.projects.find(
            (p) => p.name === message.projectName
          );
          if (project?.prs.length) {
            // Open primary PR
            vscode.env.openExternal(vscode.Uri.parse(project.prs[0].url));
          }
        }
        break;
      }

      case 'openCI': {
        // Open GitHub Actions page for the branch
        const taskResult = getTask(message.taskId);
        if (taskResult.success && taskResult.data) {
          const project = taskResult.data.projects.find(
            (p) => p.name === message.projectName
          );
          // For now, just open the PR page which has CI status
          if (project?.prs.length) {
            vscode.env.openExternal(vscode.Uri.parse(project.prs[0].url));
          }
        }
        break;
      }

      case 'openSlack':
        vscode.env.openExternal(vscode.Uri.parse(message.url));
        break;

      case 'openLink':
        vscode.env.openExternal(vscode.Uri.parse(message.url));
        break;

      case 'createPR':
        await vscode.commands.executeCommand(
          'grove.createPR',
          message.taskId,
          message.projectName
        );
        this._sendData();
        break;

      case 'linkPR':
        await vscode.commands.executeCommand('grove.linkPR');
        this._sendData();
        break;
    }
  }

  private _sendData() {
    const tasksResult = readTasks();
    const tasks = tasksResult.success && tasksResult.data ? tasksResult.data : [];
    const currentTaskId = this._getCurrentTaskId(tasks);

    const data: DashboardData = {
      tasks,
      currentTaskId,
    };

    this._panel.webview.postMessage({ type: 'update', data });
  }

  private _getCurrentTaskId(tasks: Task[]): string | undefined {
    // Try to determine current task from workspace folders
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return undefined;
    }

    const firstFolder = workspaceFolders[0].uri.fsPath;

    // Check if any task's workspace matches current workspace
    for (const task of tasks) {
      if (task.status === 'active') {
        for (const project of task.projects) {
          if (firstFolder.includes(project.worktreePath)) {
            return task.id;
          }
        }
      }
    }

    return undefined;
  }

  private _update() {
    this._panel.webview.html = this._getHtmlForWebview();
  }

  private _getHtmlForWebview() {
    const webview = this._panel.webview;

    // Get URIs for webview resources
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        'webview-ui',
        'build',
        'assets',
        'index.js'
      )
    );

    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        'webview-ui',
        'build',
        'assets',
        'index.css'
      )
    );

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} https: data:;">
          <link rel="stylesheet" type="text/css" href="${styleUri}">
          <title>Grove Dashboard</title>
        </head>
        <body>
          <div id="app"></div>
          <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>`;
  }
}

function getNonce() {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
