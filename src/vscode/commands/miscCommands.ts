import * as vscode from 'vscode';
import { loadConfig } from '../../core/config.js';
import { loadTasks } from '../../core/tasks.js';
import { writeContextFile } from '../../core/context.js';
import { getWorkspaceDir } from '../../core/config.js';
import { expandPath } from '../../core/store.js';
import { CONFIG_FILE, CONTEXT_FILENAME } from '../../core/types.js';
import { join } from 'node:path';
import type { TaskTreeProvider, TaskItem, TaskProjectItem, JiraTicketItem } from '../providers/TaskTreeProvider.js';
import type { TaskDetectionService } from '../services/TaskDetectionService.js';

export function registerMiscCommands(
  context: vscode.ExtensionContext,
  _taskTree: TaskTreeProvider,
  taskDetection: TaskDetectionService,
  refreshAll: () => void,
): void {
  // --- grove.jira.open ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.jira.open', async (arg?: TaskItem | JiraTicketItem) => {
      let jiraUrl: string | undefined;

      if (arg && 'ticketId' in arg) {
        jiraUrl = (arg as JiraTicketItem).task.jiraUrl;
      } else if (arg && 'task' in arg) {
        jiraUrl = (arg as TaskItem).task.jiraUrl;
      } else {
        const task = await resolveTask(taskDetection);
        jiraUrl = task?.jiraUrl;
      }

      if (jiraUrl) {
        vscode.env.openExternal(vscode.Uri.parse(jiraUrl));
      } else {
        vscode.window.showInformationMessage('No Jira URL found for this task.');
      }
    }),
  );

  // --- grove.ci.open ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.ci.open', async (arg?: TaskProjectItem) => {
      if (arg && 'project' in arg) {
        const project = arg.project;
        const config = await loadConfig();
        const org = config.git?.org;

        if (project.pr) {
          vscode.env.openExternal(vscode.Uri.parse(`${project.pr.url}/checks`));
        } else if (org) {
          const url = `https://github.com/${org}/${project.name}/actions?query=branch:${project.branch}`;
          vscode.env.openExternal(vscode.Uri.parse(url));
        }
        return;
      }

      const task = await resolveTask(taskDetection);
      if (!task) return;

      const withPR = task.projects.filter((p) => p.pr);
      if (withPR.length === 0) {
        vscode.window.showInformationMessage('No PRs with CI status found.');
        return;
      }

      const picked = await vscode.window.showQuickPick(
        withPR.map((p) => ({
          label: p.name,
          description: `CI: ${p.pr!.ciStatus}`,
          url: `${p.pr!.url}/checks`,
        })),
        { placeHolder: 'Select project to view CI' },
      );
      if (picked) {
        vscode.env.openExternal(vscode.Uri.parse(picked.url));
      }
    }),
  );

  // --- grove.notes.open ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.notes.open', async (arg?: TaskItem) => {
      const task = arg instanceof vscode.TreeItem ? (arg as TaskItem).task : await resolveTask(taskDetection);
      if (!task) return;

      const config = await loadConfig();
      const workspaceDir = expandPath(getWorkspaceDir(config));
      const contextPath = join(workspaceDir, task.id, CONTEXT_FILENAME);

      try {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(contextPath));
        await vscode.window.showTextDocument(doc);
      } catch {
        vscode.window.showErrorMessage(`Context file not found: ${contextPath}`);
      }
    }),
  );

  // --- grove.context.regenerate ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.context.regenerate', async (arg?: TaskItem) => {
      const task = arg instanceof vscode.TreeItem ? (arg as TaskItem).task : await resolveTask(taskDetection);
      if (!task) return;

      const config = await loadConfig();
      await writeContextFile(task, expandPath(getWorkspaceDir(config)));
      vscode.window.showInformationMessage(`Context file regenerated for ${task.id}.`);
    }),
  );

  // --- grove.config.edit ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.config.edit', async () => {
      try {
        const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(CONFIG_FILE));
        await vscode.window.showTextDocument(doc);
      } catch {
        vscode.window.showErrorMessage('Config file not found. Run "Grove: Initialize" first.');
      }
    }),
  );

  // --- grove.setToken ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.setToken', async () => {
      const service = await vscode.window.showQuickPick(
        [
          { label: 'GitHub API Token', key: 'github-api-token' },
          { label: 'Jira API Token', key: 'jira-api-token' },
        ],
        { placeHolder: 'Select token to configure' },
      );
      if (!service) return;

      const token = await vscode.window.showInputBox({
        prompt: `Enter your ${service.label}`,
        password: true,
      });
      if (!token) return;

      await context.secrets.store(service.key, token);
      vscode.window.showInformationMessage(`${service.label} stored securely.`);
    }),
  );

  // --- grove.project.add ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.project.add', async () => {
      const { addProject } = await import('../../core/projects.js');

      const uris = await vscode.window.showOpenDialog({
        canSelectFolders: true,
        canSelectFiles: false,
        canSelectMany: false,
        openLabel: 'Register Project',
        title: 'Select a git repository to register as a project',
      });
      if (!uris || uris.length === 0) return;

      const result = await addProject(uris[0]!.fsPath);
      if (result.success) {
        vscode.window.showInformationMessage(`Project "${result.data?.name}" registered.`);
        refreshAll();
      } else {
        vscode.window.showErrorMessage(`Failed: ${result.error}`);
      }
    }),
  );

  // --- grove.project.remove ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.project.remove', async (arg?: { project: { name: string } }) => {
      const { removeProject, loadProjects } = await import('../../core/projects.js');

      let name: string;
      if (arg && 'project' in arg) {
        name = arg.project.name;
      } else {
        const projects = await loadProjects();
        const picked = await vscode.window.showQuickPick(
          projects.map((p) => ({ label: p.name, description: p.path })),
          { placeHolder: 'Select project to remove' },
        );
        if (!picked) return;
        name = picked.label;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Remove project "${name}"? This does not affect existing tasks.`,
        { modal: true },
        'Remove',
      );
      if (confirm !== 'Remove') return;

      const result = await removeProject(name);
      if (result.success) {
        vscode.window.showInformationMessage(`Project "${name}" removed.`);
        refreshAll();
      } else {
        vscode.window.showErrorMessage(`Failed: ${result.error}`);
      }
    }),
  );

  // --- grove.project.setup ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.project.setup', async () => {
      vscode.window.showInformationMessage(
        'Worktree setup configuration is available via the CLI: grove project setup <name>',
      );
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
