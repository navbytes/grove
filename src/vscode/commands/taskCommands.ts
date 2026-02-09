import * as vscode from 'vscode';
import { loadConfig, getWorkspaceDir, generateBranchName } from '../../core/config.js';
import { loadProjects, findProject } from '../../core/projects.js';
import {
  createTask,
  addProjectToTask,
  removeProjectFromTask,
  archiveTask,
  deleteTask,
  findTask,
  loadTasks,
} from '../../core/tasks.js';
import { writeContextFile } from '../../core/context.js';
import { fetchJiraIssue, isJiraConfigured } from '../../core/jira.js';
import { expandPath } from '../../core/store.js';
import type { TaskTreeProvider, TaskItem, TaskProjectItem } from '../providers/TaskTreeProvider.js';
import type { TaskDetectionService } from '../services/TaskDetectionService.js';

export function registerTaskCommands(
  context: vscode.ExtensionContext,
  taskTree: TaskTreeProvider,
  taskDetection: TaskDetectionService,
): void {
  // --- grove.task.new ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.task.new', async () => {
      const config = await loadConfig();
      const projects = await loadProjects();

      if (projects.length === 0) {
        const action = await vscode.window.showWarningMessage(
          'No projects registered. Register a project first.',
          'Register Project',
        );
        if (action === 'Register Project') {
          await vscode.commands.executeCommand('grove.project.add');
        }
        return;
      }

      // Step 1: Jira ticket IDs
      const ticketInput = await vscode.window.showInputBox({
        prompt: 'Enter Jira ticket ID(s), comma-separated',
        placeHolder: 'e.g. PROJ-123 or PROJ-123, PROJ-124',
      });
      if (!ticketInput) return;

      const jiraTickets = ticketInput.split(',').map((t) => t.trim()).filter(Boolean);
      if (jiraTickets.length === 0) return;
      const primaryTicket = jiraTickets[0]!;

      // Step 2: Fetch or prompt for title
      let title = '';
      if (await isJiraConfigured()) {
        const result = await fetchJiraIssue(primaryTicket);
        if (result.success && result.data) {
          title = result.data.summary;
        }
      }

      if (!title) {
        const inputTitle = await vscode.window.showInputBox({
          prompt: 'Enter task title',
          placeHolder: 'Task title',
        });
        if (!inputTitle) return;
        title = inputTitle;
      }

      // Step 3: Select projects
      const projectItems = projects.map((p) => ({
        label: p.name,
        description: p.path,
        picked: false,
      }));

      const selected = await vscode.window.showQuickPick(projectItems, {
        canPickMany: true,
        placeHolder: 'Select projects for this task',
      });
      if (!selected || selected.length === 0) return;

      // Step 4: Create task and worktrees
      const created = await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: `Creating task ${primaryTicket}...` },
        async (progress) => {
          const jiraConfig = config.jira;
          const jiraUrl = jiraConfig?.baseUrl
            ? `${jiraConfig.baseUrl}/browse/${primaryTicket}`
            : '';

          const result = await createTask({
            id: primaryTicket,
            title,
            jiraTickets,
            jiraUrl,
          });

          if (!result.success) {
            vscode.window.showErrorMessage(`Failed to create task: ${result.error}`);
            return undefined;
          }

          const workspaceDir = getWorkspaceDir(config);

          for (const item of selected) {
            const project = await findProject(item.label);
            if (!project) continue;

            progress.report({ message: `Creating worktree for ${project.name}...` });

            const slug = title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '');
            const branch = generateBranchName(config.branchTemplate, {
              ticketId: primaryTicket,
              slug,
              title,
            });

            try {
              const addResult = await addProjectToTask(primaryTicket, project, branch, project.defaultBaseBranch, workspaceDir);
              if (!addResult.success) {
                vscode.window.showWarningMessage(`Failed to add ${project.name}: ${addResult.error}`);
              }
            } catch (err) {
              vscode.window.showErrorMessage(`Error adding ${project.name}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }

          // Generate context file
          const task = await findTask(primaryTicket);
          if (task) {
            await writeContextFile(task, expandPath(workspaceDir));
          }

          taskTree.refresh();
          return result.data;
        },
      );

      // Show success message after progress completes
      if (created) {
        const action = await vscode.window.showInformationMessage(
          `Task ${primaryTicket} created with ${selected.length} project(s)`,
          'Open Workspace',
        );
        if (action === 'Open Workspace') {
          await vscode.commands.executeCommand('grove.task.open', created);
        }
      }
    }),
  );

  // --- grove.task.open (multi-root workspace) ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.task.open', async (arg?: TaskItem | { id: string }) => {
      const task = arg instanceof vscode.TreeItem
        ? (arg as TaskItem).task
        : arg
          ? await findTask(arg.id)
          : await pickTask();

      if (!task) return;

      const folders = task.projects.map((p) => ({
        uri: vscode.Uri.file(p.worktreePath),
        name: `${task.id}/${p.name}`,
      }));

      if (folders.length === 0) {
        vscode.window.showWarningMessage(`Task ${task.id} has no projects.`);
        return;
      }

      const currentCount = vscode.workspace.workspaceFolders?.length ?? 0;
      vscode.workspace.updateWorkspaceFolders(currentCount, null, ...folders);
    }),
  );

  // --- grove.task.archive ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.task.archive', async (arg?: TaskItem) => {
      const task = arg instanceof vscode.TreeItem ? (arg as TaskItem).task : await pickTask();
      if (!task) return;

      const choice = await vscode.window.showQuickPick(
        [
          { label: 'Archive only', description: 'Keep worktrees on disk', cleanup: false },
          { label: 'Archive and clean up', description: 'Remove worktrees and workspace', cleanup: true },
        ],
        { placeHolder: `Archive ${task.id}?` },
      );
      if (!choice) return;

      const result = await archiveTask(task.id, choice.cleanup);
      if (result.success) {
        vscode.window.showInformationMessage(`Task ${task.id} archived.`);
        taskTree.refresh();
      } else {
        vscode.window.showErrorMessage(`Failed to archive: ${result.error}`);
      }
    }),
  );

  // --- grove.task.delete ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.task.delete', async (arg?: TaskItem) => {
      const task = arg instanceof vscode.TreeItem ? (arg as TaskItem).task : await pickTask();
      if (!task) return;

      const confirm = await vscode.window.showInputBox({
        prompt: `Type "${task.id}" to confirm permanent deletion`,
        placeHolder: task.id,
      });
      if (confirm !== task.id) {
        vscode.window.showInformationMessage('Deletion cancelled.');
        return;
      }

      const result = await deleteTask(task.id);
      if (result.success) {
        vscode.window.showInformationMessage(`Task ${task.id} deleted.`);
        taskTree.refresh();
      } else {
        vscode.window.showErrorMessage(`Failed to delete: ${result.error}`);
      }
    }),
  );

  // --- grove.task.addProject ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.task.addProject', async (arg?: TaskItem) => {
      const task = arg instanceof vscode.TreeItem ? (arg as TaskItem).task : await resolveTask(taskDetection);
      if (!task) return;

      const allProjects = await loadProjects();
      const existing = new Set(task.projects.map((p) => p.name));
      const available = allProjects.filter((p) => !existing.has(p.name));

      if (available.length === 0) {
        vscode.window.showInformationMessage('All registered projects are already in this task.');
        return;
      }

      const selected = await vscode.window.showQuickPick(
        available.map((p) => ({ label: p.name, description: p.path })),
        { canPickMany: true, placeHolder: 'Select projects to add' },
      );
      if (!selected || selected.length === 0) return;

      const config = await loadConfig();
      const workspaceDir = getWorkspaceDir(config);

      await vscode.window.withProgress(
        { location: vscode.ProgressLocation.Notification, title: 'Adding projects...' },
        async (progress) => {
          for (const item of selected) {
            const project = await findProject(item.label);
            if (!project) continue;

            progress.report({ message: `Creating worktree for ${project.name}...` });

            const slug = task.title
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '');
            const branch = generateBranchName(config.branchTemplate, {
              ticketId: task.id,
              slug,
              title: task.title,
            });

            await addProjectToTask(task.id, project, branch, project.defaultBaseBranch, workspaceDir);
          }

          taskTree.refresh();
          vscode.window.showInformationMessage(`Added ${selected.length} project(s) to ${task.id}.`);
        },
      );
    }),
  );

  // --- grove.task.removeProject ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.task.removeProject', async (arg?: TaskProjectItem) => {
      let taskId: string;
      let projectName: string;

      if (arg && 'project' in arg) {
        taskId = arg.task.id;
        projectName = arg.project.name;
      } else {
        const task = await resolveTask(taskDetection);
        if (!task) return;
        taskId = task.id;

        const picked = await vscode.window.showQuickPick(
          task.projects.map((p) => ({ label: p.name })),
          { placeHolder: 'Select project to remove' },
        );
        if (!picked) return;
        projectName = picked.label;
      }

      const confirm = await vscode.window.showWarningMessage(
        `Remove ${projectName} from ${taskId}? This will delete the worktree.`,
        { modal: true },
        'Remove',
      );
      if (confirm !== 'Remove') return;

      const result = await removeProjectFromTask(taskId, projectName);
      if (result.success) {
        vscode.window.showInformationMessage(`Removed ${projectName} from ${taskId}.`);
        taskTree.refresh();
      } else {
        vscode.window.showErrorMessage(`Failed: ${result.error}`);
      }
    }),
  );

  // --- grove.task.status ---
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.task.status', async (arg?: TaskItem) => {
      const task = arg instanceof vscode.TreeItem ? (arg as TaskItem).task : await resolveTask(taskDetection);
      if (!task) return;

      await vscode.commands.executeCommand('grove.dashboard', task);
    }),
  );
}

// --- Helpers ---

async function pickTask(): Promise<import('../../core/types.js').Task | undefined> {
  const tasks = await loadTasks();
  if (tasks.length === 0) {
    vscode.window.showInformationMessage('No tasks found.');
    return undefined;
  }

  const items = tasks.map((t) => ({
    label: t.id,
    description: `${t.title} (${t.status})`,
    task: t,
  }));

  const picked = await vscode.window.showQuickPick(items, { placeHolder: 'Select a task' });
  return picked?.task;
}

async function resolveTask(
  taskDetection: TaskDetectionService,
): Promise<import('../../core/types.js').Task | undefined> {
  const current = await taskDetection.getCurrentTask();
  if (current) return current;
  return pickTask();
}
