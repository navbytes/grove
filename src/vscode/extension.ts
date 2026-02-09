import * as vscode from 'vscode';
import { setSecretBackend } from '../core/secrets.js';
import { VsCodeSecretBackend } from './services/SecretService.js';
import { FileWatcherService } from './services/FileWatcherService.js';
import { TaskDetectionService } from './services/TaskDetectionService.js';
import { PollingService } from './services/PollingService.js';
import { TaskTreeProvider } from './providers/TaskTreeProvider.js';
import { ProjectTreeProvider } from './providers/ProjectTreeProvider.js';
import { registerTaskCommands } from './commands/taskCommands.js';
import { registerPrCommands } from './commands/prCommands.js';
import { registerLinkCommands } from './commands/linkCommands.js';
import { registerMiscCommands } from './commands/miscCommands.js';
import { registerInitCommand } from './commands/init.js';
import { TaskDetailPanel } from './providers/TaskDetailPanel.js';
import { findTask } from '../core/tasks.js';
import { isInitialized } from '../core/config.js';

export function activate(context: vscode.ExtensionContext): void {
  // 1. Bridge secrets to VS Code SecretStorage
  setSecretBackend(new VsCodeSecretBackend(context.secrets));

  // 2. Tree view providers
  const taskTreeProvider = new TaskTreeProvider();
  const projectTreeProvider = new ProjectTreeProvider();

  const taskTreeView = vscode.window.createTreeView('groveTasks', {
    treeDataProvider: taskTreeProvider,
    showCollapseAll: true,
  });

  const projectTreeView = vscode.window.createTreeView('groveProjects', {
    treeDataProvider: projectTreeProvider,
    showCollapseAll: true,
  });

  context.subscriptions.push(taskTreeView, projectTreeView);

  // 3. Task detection from workspace folders
  const taskDetection = new TaskDetectionService();
  taskDetection.register(context);

  // 4. Status bar
  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBarItem.command = 'grove.task.status';
  statusBarItem.name = 'Grove Task';
  context.subscriptions.push(statusBarItem);

  const updateStatusBar = async () => {
    const taskId = await taskDetection.getCurrentTaskId();
    if (taskId) {
      statusBarItem.text = `$(tasklist) ${taskId}`;
      statusBarItem.tooltip = `Grove Task: ${taskId}`;
      statusBarItem.show();
    } else {
      statusBarItem.hide();
    }
  };

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => updateStatusBar()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => updateStatusBar()),
  );

  // 5. File watcher for ~/.grove/ changes (auto-refresh from CLI)
  const fileWatcher = new FileWatcherService(() => {
    taskTreeProvider.refresh();
    projectTreeProvider.refresh();
    updateStatusBar();
  });
  fileWatcher.register(context);

  // 6. Background polling for PR/CI status
  const pollingService = new PollingService(taskTreeProvider);
  pollingService.register(context);

  // 7. Set grove.initialized context
  const updateInitializedContext = async () => {
    const initialized = await isInitialized();
    vscode.commands.executeCommand('setContext', 'grove.initialized', initialized);
  };
  updateInitializedContext();

  // 8. Register commands
  const refreshAll = () => {
    taskTreeProvider.refresh();
    projectTreeProvider.refresh();
    updateStatusBar();
    updateInitializedContext();
  };

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.refresh', async () => {
      await pollingService.refreshNow();
      refreshAll();
    }),
    vscode.commands.registerCommand('grove.dashboard', async (arg?: { id: string } | import('../core/types.js').Task) => {
      let task: import('../core/types.js').Task | undefined;
      if (arg && 'id' in arg) {
        task = (await findTask(arg.id)) ?? undefined;
      }
      if (!task) {
        task = (await taskDetection.getCurrentTask()) ?? undefined;
      }
      TaskDetailPanel.createOrShow(task);
    }),
  );

  registerInitCommand(context, refreshAll);
  registerTaskCommands(context, taskTreeProvider, taskDetection);
  registerPrCommands(context, taskTreeProvider, taskDetection);
  registerLinkCommands(context, taskTreeProvider, taskDetection);
  registerMiscCommands(context, taskTreeProvider, taskDetection, refreshAll);

  // 9. Initial load
  taskTreeProvider.refresh();
  projectTreeProvider.refresh();
  updateStatusBar();
}

export function deactivate(): void {
  // Cleanup handled by disposables
}
