import * as vscode from 'vscode';
import { loadConfig, getWorkspaceDir } from '../../core/config.js';
import { findTask, saveTasks, loadTasks } from '../../core/tasks.js';
import { writeContextFile } from '../../core/context.js';
import { createPR, fetchFullPRStatus, getGitHubAuth, isGitHubConfigured } from '../../core/github.js';
import { expandPath } from '../../core/store.js';
import type { TaskTreeProvider, TaskItem, TaskProjectItem } from '../providers/TaskTreeProvider.js';
import type { TaskDetectionService } from '../services/TaskDetectionService.js';

export function registerPrCommands(
  context: vscode.ExtensionContext,
  taskTree: TaskTreeProvider,
  taskDetection: TaskDetectionService,
): void {
  // --- grove.pr.create ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.pr.create', async (arg?: TaskProjectItem | TaskItem) => {
      if (!(await isGitHubConfigured())) {
        vscode.window.showErrorMessage('GitHub is not configured. Run "Grove: Initialize" first.');
        return;
      }

      let taskId: string;
      let projectName: string | undefined;

      if (arg && 'project' in arg) {
        taskId = (arg as TaskProjectItem).task.id;
        projectName = (arg as TaskProjectItem).project.name;
      } else if (arg && 'task' in arg) {
        taskId = (arg as TaskItem).task.id;
      } else {
        const task = await resolveTask(taskDetection);
        if (!task) return;
        taskId = task.id;
      }

      const task = await findTask(taskId);
      if (!task) {
        vscode.window.showErrorMessage(`Task ${taskId} not found.`);
        return;
      }

      // Select project if not specified
      if (!projectName) {
        const withoutPR = task.projects.filter((p) => !p.pr);
        if (withoutPR.length === 0) {
          vscode.window.showInformationMessage('All projects already have PRs.');
          return;
        }
        if (withoutPR.length === 1) {
          projectName = withoutPR[0]!.name;
        } else {
          const picked = await vscode.window.showQuickPick(
            withoutPR.map((p) => ({ label: p.name, description: `branch: ${p.branch}` })),
            { placeHolder: 'Select project to create PR for' },
          );
          if (!picked) return;
          projectName = picked.label;
        }
      }

      const project = task.projects.find((p) => p.name === projectName);
      if (!project) return;

      if (project.pr) {
        const action = await vscode.window.showInformationMessage(
          `${project.name} already has PR #${project.pr.number}`,
          'Open in Browser',
        );
        if (action === 'Open in Browser') {
          vscode.env.openExternal(vscode.Uri.parse(project.pr.url));
        }
        return;
      }

      // PR title and body
      const defaultTitle = task.jiraTickets.length > 0
        ? `${task.jiraTickets[0]}: ${task.title}`
        : task.title;

      const title = await vscode.window.showInputBox({
        prompt: 'PR title',
        value: defaultTitle,
      });
      if (!title) return;

      const defaultBody = task.jiraUrl ? `Jira: ${task.jiraUrl}` : '';
      const body = await vscode.window.showInputBox({
        prompt: 'PR body (optional)',
        value: defaultBody,
      });

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Creating PR for ${project.name}...` },
        async () => {
          const auth = await getGitHubAuth();
          if (!auth) {
            vscode.window.showErrorMessage('GitHub authentication not available.');
            return;
          }

          const result = await createPR(project.name, {
            title,
            body: body ?? '',
            head: project.branch,
            base: project.baseBranch,
          }, auth);

          if (!result.success || !result.data) {
            vscode.window.showErrorMessage(`Failed to create PR: ${result.error}`);
            return;
          }

          // Update task with PR info
          const tasks = await loadTasks();
          const updatedTask = tasks.find((t) => t.id === taskId);
          const updatedProject = updatedTask?.projects.find((p) => p.name === projectName);
          if (updatedProject) {
            updatedProject.pr = {
              number: result.data.number,
              url: result.data.url,
              status: 'open',
              reviewStatus: 'none',
              ciStatus: 'none',
            };
            if (updatedTask) {
              updatedTask.updatedAt = new Date().toISOString();
            }
            await saveTasks(tasks);

            const config = await loadConfig();
            if (updatedTask) {
              await writeContextFile(updatedTask, expandPath(getWorkspaceDir(config)));
            }
          }

          taskTree.refresh();

          const action = await vscode.window.showInformationMessage(
            `PR #${result.data.number} created for ${project.name}`,
            'Open in Browser',
          );
          if (action === 'Open in Browser') {
            vscode.env.openExternal(vscode.Uri.parse(result.data.url));
          }
        },
      );
    }),
  );

  // --- grove.pr.open ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.pr.open', async (arg?: TaskProjectItem) => {
      if (arg && 'project' in arg && arg.project.pr) {
        vscode.env.openExternal(vscode.Uri.parse(arg.project.pr.url));
        return;
      }

      const task = await resolveTask(taskDetection);
      if (!task) return;

      const withPR = task.projects.filter((p) => p.pr);
      if (withPR.length === 0) {
        vscode.window.showInformationMessage('No PRs found for this task.');
        return;
      }

      if (withPR.length === 1) {
        vscode.env.openExternal(vscode.Uri.parse(withPR[0]!.pr!.url));
        return;
      }

      const picked = await vscode.window.showQuickPick(
        withPR.map((p) => ({ label: p.name, description: `PR #${p.pr!.number}`, url: p.pr!.url })),
        { placeHolder: 'Select PR to open' },
      );
      if (picked) {
        vscode.env.openExternal(vscode.Uri.parse(picked.url));
      }
    }),
  );

  // --- grove.pr.status ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.pr.status', async () => {
      if (!(await isGitHubConfigured())) {
        vscode.window.showWarningMessage('GitHub is not configured.');
        return;
      }

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Refreshing PR status...' },
        async () => {
          const tasks = await loadTasks();
          const active = tasks.filter((t) => t.status === 'active');
          let changed = false;

          const auth = await getGitHubAuth();
          if (!auth) return;

          for (const task of active) {
            for (const project of task.projects) {
              const result = await fetchFullPRStatus(project.name, project.branch, auth);
              if (result.success && result.data) {
                project.pr = result.data;
                changed = true;
              }
            }
          }

          if (changed) {
            await saveTasks(tasks);
            taskTree.refresh();
          }

          vscode.window.showInformationMessage('PR status refreshed.');
        },
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
