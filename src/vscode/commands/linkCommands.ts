import * as vscode from 'vscode';
import { addLinkToTask, removeLinkFromTask, loadTasks } from '../../core/tasks.js';
import { createLink } from '../../core/links.js';
import type { TaskTreeProvider, TaskItem, LinkItem } from '../providers/TaskTreeProvider.js';
import type { TaskDetectionService } from '../services/TaskDetectionService.js';

export function registerLinkCommands(
  context: vscode.ExtensionContext,
  taskTree: TaskTreeProvider,
  taskDetection: TaskDetectionService,
): void {
  // --- grove.link.add ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.link.add', async (arg?: TaskItem) => {
      const task = arg instanceof vscode.TreeItem ? (arg as TaskItem).task : await resolveTask(taskDetection);
      if (!task) return;

      const url = await vscode.window.showInputBox({
        prompt: 'Enter URL',
        placeHolder: 'https://...',
        validateInput: (v) => {
          try {
            new URL(v);
            return null;
          } catch {
            return 'Please enter a valid URL';
          }
        },
      });
      if (!url) return;

      const label = await vscode.window.showInputBox({
        prompt: 'Label for this link',
        placeHolder: 'e.g. Design discussion',
      });
      if (!label) return;

      const link = createLink(url, label);
      const result = await addLinkToTask(task.id, link);

      if (result.success) {
        vscode.window.showInformationMessage(`Link added to ${task.id}.`);
        taskTree.refresh();
      } else {
        vscode.window.showErrorMessage(`Failed: ${result.error}`);
      }
    }),
  );

  // --- grove.link.open ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.link.open', async (arg?: LinkItem) => {
      if (arg && 'link' in arg) {
        vscode.env.openExternal(vscode.Uri.parse(arg.link.url));
        return;
      }

      const task = await resolveTask(taskDetection);
      if (!task || task.links.length === 0) {
        vscode.window.showInformationMessage('No links found.');
        return;
      }

      if (task.links.length === 1) {
        vscode.env.openExternal(vscode.Uri.parse(task.links[0]!.url));
        return;
      }

      const picked = await vscode.window.showQuickPick(
        task.links.map((l, i) => ({ label: l.label, description: l.category, url: l.url, index: i })),
        { placeHolder: 'Select link to open' },
      );
      if (picked) {
        vscode.env.openExternal(vscode.Uri.parse(picked.url));
      }
    }),
  );

  // --- grove.link.remove ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.link.remove', async (arg?: LinkItem) => {
      let taskId: string;
      let linkIndex: number;

      if (arg && 'link' in arg) {
        taskId = arg.task.id;
        linkIndex = arg.linkIndex;
      } else {
        const task = await resolveTask(taskDetection);
        if (!task || task.links.length === 0) return;
        taskId = task.id;

        const picked = await vscode.window.showQuickPick(
          task.links.map((l, i) => ({ label: l.label, description: l.url, index: i })),
          { placeHolder: 'Select link to remove' },
        );
        if (!picked) return;
        linkIndex = picked.index;
      }

      const confirm = await vscode.window.showWarningMessage('Remove this link?', { modal: true }, 'Remove');
      if (confirm !== 'Remove') return;

      const result = await removeLinkFromTask(taskId, linkIndex);
      if (result.success) {
        taskTree.refresh();
      } else {
        vscode.window.showErrorMessage(`Failed: ${result.error}`);
      }
    }),
  );
}

async function resolveTask(
  taskDetection: TaskDetectionService,
): Promise<import('../../core/types.js').Task | undefined> {
  const current = await taskDetection.getCurrentTask();
  if (current) return current;

  const tasks = await loadTasks();
  const items = tasks.map((t) => ({ label: t.id, description: t.title, task: t }));
  const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Select a task' });
  return picked?.task;
}
