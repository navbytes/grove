/**
 * Command handlers for Grove
 */

import * as vscode from 'vscode';
import * as path from 'path';
import {
  Task,
  Project,
  SECRET_KEYS,
  JiraTicket,
} from '../core/types';
import {
  readConfig,
  isGroveSetup,
  generateBranchName,
  getTaskDir,
  expandPath,
} from '../core/config';
import { readProjects, removeProject, getProject } from '../core/projects';
import { readTasks, getTask, updateTask, getActiveTasks, getArchivedTasks } from '../core/store';
import {
  createTask,
  addProjectToTask,
  removeProjectFromTask,
  archiveTask,
  deleteTaskCompletely,
  addSlackThread,
  removeSlackThread,
  getAvailableProjectsForTask,
  refreshTask,
  addLink,
  removeLink,
  detectLinkType,
} from '../core/tasks';
import { generateContextFile, getContextFilePath } from '../core/context';
import { pushBranch, isBranchPushed } from '../core/worktree';
import { getTaskIdFromWorkspace } from '../core/workspace';
import { createJiraClient, JiraClient } from '../core/jira';
import { createGitHubClient, GitHubClient } from '../core/github';
import { prDetailsToInfo } from '../core/git-provider';
import { extractRepoOwner, extractRepoName, getRemoteUrl } from '../core/projects';
import { showSetupWizard, registerProjectWizard, editSettings } from './setup';
import { GroveSidebarProvider } from './sidebar';

/**
 * Register all Grove commands
 */
export function registerCommands(
  context: vscode.ExtensionContext,
  sidebarProvider: GroveSidebarProvider
): void {
  // Setup & Configuration Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.setup', () =>
      showSetupWizard(context).then(() => sidebarProvider.refresh())
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.registerProject', () =>
      registerProjectWizard().then(() => sidebarProvider.refresh())
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.removeProject', () =>
      removeProjectCommand().then(() => sidebarProvider.refresh())
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.listProjects', listProjectsCommand)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.editSettings', editSettings)
  );

  // Task Management Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.newTask', () =>
      newTaskCommand(context).then(() => sidebarProvider.refresh())
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.openTask', openTaskCommand)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.listTasks', listTasksCommand)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.archiveTask', () =>
      archiveTaskCommand().then(() => sidebarProvider.refresh())
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.deleteTask', () =>
      deleteTaskCommand().then(() => sidebarProvider.refresh())
    )
  );

  // Task Workspace Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.addProject', () =>
      addProjectCommand().then(() => sidebarProvider.refresh())
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.removeProjectFromTask', () =>
      removeProjectFromTaskCommand().then(() => sidebarProvider.refresh())
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.createPR', () =>
      createPRCommand(context).then(() => sidebarProvider.refresh())
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.linkPR', () =>
      linkPRCommand(context).then(() => sidebarProvider.refresh())
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.openPR', openPRCommand)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.openJira', openJiraCommand)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.openCI', openCICommand)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.refreshStatus', () =>
      refreshStatusCommand(context).then(() => sidebarProvider.refresh())
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.updateContextFile', updateContextFileCommand)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.taskNotes', taskNotesCommand)
  );

  // Slack thread commands
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.addSlackThread', () =>
      addSlackThreadCommand().then(() => sidebarProvider.refresh())
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.removeSlackThread', () =>
      removeSlackThreadCommand().then(() => sidebarProvider.refresh())
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.openSlackThread', openSlackThreadCommand)
  );

  // Link commands
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.addLink', () =>
      addLinkCommand().then(() => sidebarProvider.refresh())
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.removeLink', () =>
      removeLinkCommand().then(() => sidebarProvider.refresh())
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.openLink', openLinkCommand)
  );

  // Sidebar commands
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.refreshSidebar', () => sidebarProvider.refresh())
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('grove.openTaskFromSidebar', (taskId: string) =>
      openTaskById(taskId)
    )
  );
}

/**
 * Get the current task (if in a Grove workspace)
 */
function getCurrentTask(): Task | null {
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
 * Get the current project from active editor
 */
function getCurrentProject(task: Task): typeof task.projects[0] | null {
  const activeEditor = vscode.window.activeTextEditor;
  if (!activeEditor) {
    return null;
  }

  const filePath = activeEditor.document.uri.fsPath;

  for (const project of task.projects) {
    if (filePath.startsWith(project.worktreePath)) {
      return project;
    }
  }

  return null;
}

// Command Implementations

async function removeProjectCommand(): Promise<void> {
  const result = readProjects();
  if (!result.success || !result.data || result.data.length === 0) {
    vscode.window.showInformationMessage('No projects registered.');
    return;
  }

  const items = result.data.map((p) => ({
    label: p.name,
    description: p.path,
    project: p,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a project to remove',
  });

  if (!selected) {
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Remove project "${selected.label}"? This won't affect existing tasks using this project.`,
    { modal: true },
    'Remove'
  );

  if (confirm !== 'Remove') {
    return;
  }

  const removeResult = removeProject(selected.label);
  if (!removeResult.success) {
    vscode.window.showErrorMessage(`Failed to remove project: ${removeResult.error}`);
    return;
  }

  vscode.window.showInformationMessage(`Project "${selected.label}" removed.`);
}

async function listProjectsCommand(): Promise<void> {
  const result = readProjects();
  if (!result.success || !result.data || result.data.length === 0) {
    vscode.window.showInformationMessage('No projects registered. Use "Grove: Register Project" to add one.');
    return;
  }

  const items = result.data.map((p) => ({
    label: p.name,
    description: `${p.path} (base: ${p.defaultBaseBranch})`,
  }));

  await vscode.window.showQuickPick(items, {
    placeHolder: 'Registered projects',
  });
}

async function newTaskCommand(context: vscode.ExtensionContext): Promise<void> {
  if (!isGroveSetup()) {
    const setup = await vscode.window.showWarningMessage(
      'Grove is not set up yet.',
      'Set Up Grove'
    );
    if (setup === 'Set Up Grove') {
      await showSetupWizard(context);
    }
    return;
  }

  // Check if we have any projects
  const projectsResult = readProjects();
  if (!projectsResult.success || !projectsResult.data || projectsResult.data.length === 0) {
    const register = await vscode.window.showWarningMessage(
      'No projects registered. Register a project first.',
      'Register Project'
    );
    if (register === 'Register Project') {
      await registerProjectWizard();
    }
    return;
  }

  // Get ticket IDs
  const ticketInput = await vscode.window.showInputBox({
    prompt: 'Enter Jira ticket ID(s) (comma-separated for multiple)',
    placeHolder: 'TASK-200 or TASK-200, TASK-201',
    validateInput: (value) => {
      if (!value.trim()) {
        return 'At least one ticket ID is required';
      }
      return undefined;
    },
  });

  if (!ticketInput) {
    return;
  }

  const ticketIds = ticketInput.split(',').map((t) => t.trim()).filter(Boolean);

  // Try to fetch ticket info from Jira
  let title = '';
  let jiraUrl: string | undefined;

  const config = readConfig();
  if (config.success && config.data?.jira) {
    const token = await context.secrets.get(SECRET_KEYS.JIRA_API_TOKEN);
    if (token) {
      const client = createJiraClient({
        baseUrl: config.data.jira.baseUrl,
        email: config.data.jira.email,
        apiToken: token,
      });

      const fetchingMessage = vscode.window.setStatusBarMessage('Fetching ticket info from Jira...');
      const ticketResult = await client.getTicket(ticketIds[0]);
      fetchingMessage.dispose();

      if (ticketResult.success && ticketResult.data) {
        title = ticketResult.data.summary;
        jiraUrl = ticketResult.data.url;

        // Show confirmation
        const confirmed = await vscode.window.showInformationMessage(
          `Found: "${title}"`,
          'Use this title',
          'Enter custom title'
        );

        if (confirmed === 'Enter custom title') {
          title = '';
        } else if (!confirmed) {
          return; // Cancelled
        }
      } else {
        vscode.window.showWarningMessage(
          `Could not fetch ticket from Jira: ${ticketResult.error}. Enter title manually.`
        );
      }
    }
  }

  // Manual title entry if not fetched
  if (!title) {
    const manualTitle = await vscode.window.showInputBox({
      prompt: 'Enter task title',
      placeHolder: 'Add user preferences API',
      validateInput: (value) => {
        if (!value.trim()) {
          return 'Title is required';
        }
        return undefined;
      },
    });

    if (!manualTitle) {
      return;
    }

    title = manualTitle;
  }

  // Select projects
  const projectItems = projectsResult.data.map((p) => ({
    label: p.name,
    description: p.path,
    picked: false,
  }));

  const selectedProjects = await vscode.window.showQuickPick(projectItems, {
    canPickMany: true,
    placeHolder: 'Select projects for this task',
  });

  if (!selectedProjects || selectedProjects.length === 0) {
    vscode.window.showWarningMessage('At least one project must be selected.');
    return;
  }

  // Create the task
  const creatingMessage = vscode.window.setStatusBarMessage('Creating task...');

  const createResult = await createTask({
    ticketIds,
    title,
    projectNames: selectedProjects.map((p) => p.label),
    jiraUrl,
  });

  creatingMessage.dispose();

  if (!createResult.success || !createResult.data) {
    vscode.window.showErrorMessage(`Failed to create task: ${createResult.error}`);
    return;
  }

  // Open the workspace
  const openChoice = await vscode.window.showInformationMessage(
    `Task "${createResult.data.id}" created!`,
    'Open Workspace',
    'Later'
  );

  if (openChoice === 'Open Workspace') {
    await openTaskById(createResult.data.id);
  }
}

async function openTaskCommand(): Promise<void> {
  const activeResult = getActiveTasks();
  if (!activeResult.success || !activeResult.data || activeResult.data.length === 0) {
    vscode.window.showInformationMessage('No active tasks. Create one with "Grove: New Task".');
    return;
  }

  const items = activeResult.data.map((t) => ({
    label: t.id,
    description: t.title,
    detail: `${t.projects.length} project(s)`,
    task: t,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a task to open',
  });

  if (!selected) {
    return;
  }

  await openTaskById(selected.task.id);
}

async function openTaskById(taskId: string): Promise<void> {
  const taskResult = getTask(taskId);
  if (!taskResult.success || !taskResult.data) {
    vscode.window.showErrorMessage(`Task "${taskId}" not found.`);
    return;
  }

  const uri = vscode.Uri.file(taskResult.data.workspaceFile);
  await vscode.commands.executeCommand('vscode.openFolder', uri, { forceNewWindow: true });
}

async function listTasksCommand(): Promise<void> {
  const tasksResult = readTasks();
  if (!tasksResult.success || !tasksResult.data || tasksResult.data.length === 0) {
    vscode.window.showInformationMessage('No tasks found.');
    return;
  }

  const items = tasksResult.data.map((t) => ({
    label: `${t.status === 'archived' ? '$(archive) ' : ''}${t.id}`,
    description: t.title,
    detail: `${t.projects.length} project(s) • ${t.status}`,
    task: t,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'All tasks',
  });

  if (selected) {
    await openTaskById(selected.task.id);
  }
}

async function archiveTaskCommand(): Promise<void> {
  const activeResult = getActiveTasks();
  if (!activeResult.success || !activeResult.data || activeResult.data.length === 0) {
    vscode.window.showInformationMessage('No active tasks to archive.');
    return;
  }

  const items = activeResult.data.map((t) => ({
    label: t.id,
    description: t.title,
    task: t,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a task to archive',
  });

  if (!selected) {
    return;
  }

  const cleanupChoice = await vscode.window.showQuickPick(
    [
      { label: 'Archive only', description: 'Keep worktrees and workspace files', cleanup: false },
      { label: 'Archive and clean up', description: 'Remove worktrees and workspace files', cleanup: true },
    ],
    {
      placeHolder: `Archive ${selected.task.id}?`,
    }
  );

  if (!cleanupChoice) {
    return;
  }

  const archiveResult = await archiveTask(selected.task.id, cleanupChoice.cleanup);
  if (!archiveResult.success) {
    vscode.window.showErrorMessage(`Failed to archive task: ${archiveResult.error}`);
    return;
  }

  vscode.window.showInformationMessage(`Task "${selected.task.id}" archived.`);
}

async function deleteTaskCommand(): Promise<void> {
  const tasksResult = readTasks();
  if (!tasksResult.success || !tasksResult.data || tasksResult.data.length === 0) {
    vscode.window.showInformationMessage('No tasks to delete.');
    return;
  }

  const items = tasksResult.data.map((t) => ({
    label: t.id,
    description: `${t.title} (${t.status})`,
    task: t,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a task to delete',
  });

  if (!selected) {
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Delete task "${selected.task.id}"? This will remove all worktrees and cannot be undone.`,
    { modal: true },
    'Delete'
  );

  if (confirm !== 'Delete') {
    return;
  }

  const deleteResult = await deleteTaskCompletely(selected.task.id);
  if (!deleteResult.success) {
    vscode.window.showErrorMessage(`Failed to delete task: ${deleteResult.error}`);
    return;
  }

  vscode.window.showInformationMessage(`Task "${selected.task.id}" deleted.`);
}

async function addProjectCommand(): Promise<void> {
  const task = getCurrentTask();
  if (!task) {
    vscode.window.showWarningMessage('This command is only available in a Grove task workspace.');
    return;
  }

  const availableResult = getAvailableProjectsForTask(task.id);
  if (!availableResult.success || !availableResult.data || availableResult.data.length === 0) {
    vscode.window.showInformationMessage('All registered projects are already in this task.');
    return;
  }

  const items = availableResult.data.map((p) => ({
    label: p.name,
    description: p.path,
    project: p,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    canPickMany: true,
    placeHolder: 'Select projects to add',
  });

  if (!selected || selected.length === 0) {
    return;
  }

  for (const item of selected) {
    const addResult = await addProjectToTask({
      taskId: task.id,
      projectName: item.label,
    });

    if (!addResult.success) {
      vscode.window.showErrorMessage(`Failed to add "${item.label}": ${addResult.error}`);
    } else {
      vscode.window.showInformationMessage(`Added "${item.label}" to task.`);
    }
  }
}

async function removeProjectFromTaskCommand(): Promise<void> {
  const task = getCurrentTask();
  if (!task) {
    vscode.window.showWarningMessage('This command is only available in a Grove task workspace.');
    return;
  }

  if (task.projects.length === 0) {
    vscode.window.showInformationMessage('No projects in this task.');
    return;
  }

  const items = task.projects.map((p) => ({
    label: p.name,
    description: p.branch,
    project: p,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a project to remove',
  });

  if (!selected) {
    return;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Remove "${selected.label}" from this task? This will delete the worktree and any uncommitted changes.`,
    { modal: true },
    'Remove'
  );

  if (confirm !== 'Remove') {
    return;
  }

  const removeResult = await removeProjectFromTask({
    taskId: task.id,
    projectName: selected.label,
    force: true,
  });

  if (!removeResult.success) {
    vscode.window.showErrorMessage(`Failed to remove project: ${removeResult.error}`);
    return;
  }

  vscode.window.showInformationMessage(`Project "${selected.label}" removed.`);
}

async function createPRCommand(context: vscode.ExtensionContext): Promise<void> {
  const task = getCurrentTask();
  if (!task) {
    vscode.window.showWarningMessage('This command is only available in a Grove task workspace.');
    return;
  }

  const project = getCurrentProject(task);
  if (!project) {
    // Let user select a project
    const items = task.projects.map((p) => ({
      label: p.name,
      description: p.pr ? `PR #${p.pr.number}` : 'No PR',
      project: p,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a project to create PR for',
    });

    if (!selected) {
      return;
    }

    await createPRForProject(context, task, selected.project);
    return;
  }

  await createPRForProject(context, task, project);
}

async function createPRForProject(
  context: vscode.ExtensionContext,
  task: Task,
  project: typeof task.projects[0]
): Promise<void> {
  if (project.pr) {
    const open = await vscode.window.showInformationMessage(
      `This project already has PR #${project.pr.number}.`,
      'Open PR'
    );
    if (open === 'Open PR') {
      vscode.env.openExternal(vscode.Uri.parse(project.pr.url));
    }
    return;
  }

  const config = readConfig();
  if (!config.success || !config.data?.git) {
    vscode.window.showWarningMessage('Git provider not configured. Run "Grove: Setup" first.');
    return;
  }

  const token = await context.secrets.get(SECRET_KEYS.GIT_API_TOKEN);
  if (!token) {
    vscode.window.showWarningMessage('Git API token not found. Run "Grove: Setup" first.');
    return;
  }

  // Get remote URL to determine owner/repo
  const remoteResult = await getRemoteUrl(project.repoPath);
  if (!remoteResult.success || !remoteResult.data) {
    vscode.window.showErrorMessage('Could not determine remote URL.');
    return;
  }

  const owner = extractRepoOwner(remoteResult.data);
  const repo = extractRepoName(remoteResult.data);

  if (!owner || !repo) {
    vscode.window.showErrorMessage('Could not parse owner/repo from remote URL.');
    return;
  }

  // Check if branch is pushed
  const pushedResult = await isBranchPushed(project.repoPath, project.branch);
  if (!pushedResult.data) {
    const push = await vscode.window.showInformationMessage(
      'Branch not pushed to remote. Push now?',
      'Push',
      'Cancel'
    );

    if (push !== 'Push') {
      return;
    }

    const pushingMessage = vscode.window.setStatusBarMessage('Pushing branch...');
    const pushResult = await pushBranch(project.worktreePath, project.branch);
    pushingMessage.dispose();

    if (!pushResult.success) {
      vscode.window.showErrorMessage(`Failed to push: ${pushResult.error}`);
      return;
    }
  }

  // Create PR
  const client = createGitHubClient();
  client.setToken(token);

  const title = `${task.jiraTickets[0]}: ${task.title}`;
  const body = task.jiraUrl
    ? `Jira: ${task.jiraUrl}\n\n<!-- Add PR description here -->`
    : '<!-- Add PR description here -->';

  const creatingMessage = vscode.window.setStatusBarMessage('Creating PR...');
  const prResult = await client.createPR({
    owner,
    repo,
    title,
    body,
    head: project.branch,
    base: project.baseBranch,
  });
  creatingMessage.dispose();

  if (!prResult.success || !prResult.data) {
    vscode.window.showErrorMessage(`Failed to create PR: ${prResult.error}`);
    return;
  }

  // Update task with PR info
  const updatedProjects = task.projects.map((p) => {
    if (p.name === project.name) {
      return {
        ...p,
        pr: prDetailsToInfo(prResult.data!),
      };
    }
    return p;
  });

  await updateTask(task.id, { projects: updatedProjects });
  generateContextFile({ ...task, projects: updatedProjects });

  const open = await vscode.window.showInformationMessage(
    `PR #${prResult.data.number} created!`,
    'Open PR'
  );

  if (open === 'Open PR') {
    vscode.env.openExternal(vscode.Uri.parse(prResult.data.url));
  }
}

async function linkPRCommand(context: vscode.ExtensionContext): Promise<void> {
  const task = getCurrentTask();
  if (!task) {
    vscode.window.showWarningMessage('This command is only available in a Grove task workspace.');
    return;
  }

  const config = readConfig();
  if (!config.success || !config.data?.git) {
    vscode.window.showWarningMessage('Git provider not configured. Run "Grove: Setup" first.');
    return;
  }

  const token = await context.secrets.get(SECRET_KEYS.GIT_API_TOKEN);
  if (!token) {
    vscode.window.showWarningMessage('Git API token not found. Run "Grove: Setup" first.');
    return;
  }

  // Get projects without PRs
  const projectsWithoutPR = task.projects.filter((p) => !p.pr);
  if (projectsWithoutPR.length === 0) {
    vscode.window.showInformationMessage('All projects already have PRs linked.');
    return;
  }

  // If only one project without PR, use it; otherwise let user select
  let targetProject: typeof task.projects[0];
  if (projectsWithoutPR.length === 1) {
    targetProject = projectsWithoutPR[0];
  } else {
    const items = projectsWithoutPR.map((p) => ({
      label: p.name,
      description: `Branch: ${p.branch}`,
      project: p,
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select a project to link PR for',
    });

    if (!selected) {
      return;
    }
    targetProject = selected.project;
  }

  // Get remote URL to determine owner/repo
  const remoteResult = await getRemoteUrl(targetProject.repoPath);
  if (!remoteResult.success || !remoteResult.data) {
    vscode.window.showErrorMessage('Could not determine remote URL.');
    return;
  }

  const owner = extractRepoOwner(remoteResult.data);
  const repo = extractRepoName(remoteResult.data);

  if (!owner || !repo) {
    vscode.window.showErrorMessage('Could not parse owner/repo from remote URL.');
    return;
  }

  // Find PR by branch
  const client = createGitHubClient();
  client.setToken(token);

  const searchingMessage = vscode.window.setStatusBarMessage('Searching for PR...');
  const prResult = await client.findPRByBranch(owner, repo, targetProject.branch);
  searchingMessage.dispose();

  if (!prResult.success) {
    vscode.window.showErrorMessage(`Failed to search for PR: ${prResult.error}`);
    return;
  }

  if (!prResult.data) {
    vscode.window.showWarningMessage(
      `No PR found for branch "${targetProject.branch}". Create one first.`
    );
    return;
  }

  // Update task with PR info
  const updatedProjects = task.projects.map((p) => {
    if (p.name === targetProject.name) {
      return {
        ...p,
        pr: prDetailsToInfo(prResult.data!),
      };
    }
    return p;
  });

  await updateTask(task.id, { projects: updatedProjects });
  generateContextFile({ ...task, projects: updatedProjects });

  const open = await vscode.window.showInformationMessage(
    `Linked PR #${prResult.data.number}: ${prResult.data.title}`,
    'Open PR'
  );

  if (open === 'Open PR') {
    vscode.env.openExternal(vscode.Uri.parse(prResult.data.url));
  }
}

async function openPRCommand(): Promise<void> {
  const task = getCurrentTask();
  if (!task) {
    vscode.window.showWarningMessage('This command is only available in a Grove task workspace.');
    return;
  }

  const project = getCurrentProject(task);
  const targetProject = project || task.projects[0];

  if (!targetProject?.pr) {
    vscode.window.showInformationMessage('No PR for this project. Use "Grove: Create PR" first.');
    return;
  }

  vscode.env.openExternal(vscode.Uri.parse(targetProject.pr.url));
}

async function openJiraCommand(): Promise<void> {
  const task = getCurrentTask();
  if (!task) {
    vscode.window.showWarningMessage('This command is only available in a Grove task workspace.');
    return;
  }

  if (!task.jiraUrl) {
    const config = readConfig();
    if (config.success && config.data?.jira) {
      const url = `${config.data.jira.baseUrl}/browse/${task.jiraTickets[0]}`;
      vscode.env.openExternal(vscode.Uri.parse(url));
    } else {
      vscode.window.showWarningMessage('No Jira URL associated with this task.');
    }
    return;
  }

  vscode.env.openExternal(vscode.Uri.parse(task.jiraUrl));
}

async function openCICommand(): Promise<void> {
  const task = getCurrentTask();
  if (!task) {
    vscode.window.showWarningMessage('This command is only available in a Grove task workspace.');
    return;
  }

  const project = getCurrentProject(task);
  const targetProject = project || task.projects[0];

  if (!targetProject) {
    return;
  }

  // Construct CI URL
  const remoteResult = await getRemoteUrl(targetProject.repoPath);
  if (!remoteResult.success || !remoteResult.data) {
    vscode.window.showErrorMessage('Could not determine remote URL.');
    return;
  }

  const owner = extractRepoOwner(remoteResult.data);
  const repo = extractRepoName(remoteResult.data);

  if (!owner || !repo) {
    return;
  }

  const client = createGitHubClient();
  const ciUrl = client.getCIUrl(owner, repo, targetProject.branch);
  vscode.env.openExternal(vscode.Uri.parse(ciUrl));
}

async function refreshStatusCommand(context: vscode.ExtensionContext): Promise<void> {
  const task = getCurrentTask();
  if (!task) {
    vscode.window.showWarningMessage('This command is only available in a Grove task workspace.');
    return;
  }

  const config = readConfig();
  if (!config.success || !config.data?.git) {
    refreshTask(task.id);
    return;
  }

  const token = await context.secrets.get(SECRET_KEYS.GIT_API_TOKEN);
  if (!token) {
    refreshTask(task.id);
    return;
  }

  const client = createGitHubClient();
  client.setToken(token);

  const refreshingMessage = vscode.window.setStatusBarMessage('Refreshing status...');

  for (const project of task.projects) {
    if (!project.pr) {
      continue;
    }

    const remoteResult = await getRemoteUrl(project.repoPath);
    if (!remoteResult.success || !remoteResult.data) {
      continue;
    }

    const owner = extractRepoOwner(remoteResult.data);
    const repo = extractRepoName(remoteResult.data);

    if (!owner || !repo) {
      continue;
    }

    const prResult = await client.getPR(owner, repo, project.pr.number);
    if (prResult.success && prResult.data) {
      project.pr = prDetailsToInfo(prResult.data);
    }
  }

  refreshingMessage.dispose();

  await updateTask(task.id, { projects: task.projects });
  generateContextFile(task);

  vscode.window.showInformationMessage('Status refreshed.');
}

async function updateContextFileCommand(): Promise<void> {
  const task = getCurrentTask();
  if (!task) {
    vscode.window.showWarningMessage('This command is only available in a Grove task workspace.');
    return;
  }

  generateContextFile(task);
  vscode.window.showInformationMessage('Context file updated.');
}

async function taskNotesCommand(): Promise<void> {
  const task = getCurrentTask();
  if (!task) {
    vscode.window.showWarningMessage('This command is only available in a Grove task workspace.');
    return;
  }

  const contextPath = getContextFilePath(task.id);
  const uri = vscode.Uri.file(contextPath);

  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc);
}

async function addSlackThreadCommand(): Promise<void> {
  const task = getCurrentTask();
  if (!task) {
    vscode.window.showWarningMessage('This command is only available in a Grove task workspace.');
    return;
  }

  const url = await vscode.window.showInputBox({
    prompt: 'Enter Slack thread URL',
    placeHolder: 'https://company.slack.com/archives/...',
    validateInput: (value) => {
      if (!value.trim()) {
        return 'URL is required';
      }
      if (!value.includes('slack.com')) {
        return 'Please enter a valid Slack URL';
      }
      return undefined;
    },
  });

  if (!url) {
    return;
  }

  const title = await vscode.window.showInputBox({
    prompt: 'Enter a title for this thread (optional)',
    placeHolder: 'Discussion about API design',
  });

  const result = addSlackThread(task.id, url, title || undefined);
  if (!result.success) {
    vscode.window.showErrorMessage(`Failed to add Slack thread: ${result.error}`);
    return;
  }

  vscode.window.showInformationMessage('Slack thread added.');
}

async function removeSlackThreadCommand(): Promise<void> {
  const task = getCurrentTask();
  if (!task) {
    vscode.window.showWarningMessage('This command is only available in a Grove task workspace.');
    return;
  }

  if (task.slackThreads.length === 0) {
    vscode.window.showInformationMessage('No Slack threads in this task.');
    return;
  }

  const items = task.slackThreads.map((t) => ({
    label: t.title || t.url,
    description: t.title ? t.url : undefined,
    thread: t,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a Slack thread to remove',
  });

  if (!selected) {
    return;
  }

  const result = removeSlackThread(task.id, selected.thread.url);
  if (!result.success) {
    vscode.window.showErrorMessage(`Failed to remove Slack thread: ${result.error}`);
    return;
  }

  vscode.window.showInformationMessage('Slack thread removed.');
}

async function openSlackThreadCommand(): Promise<void> {
  const task = getCurrentTask();
  if (!task) {
    vscode.window.showWarningMessage('This command is only available in a Grove task workspace.');
    return;
  }

  if (task.slackThreads.length === 0) {
    vscode.window.showInformationMessage('No Slack threads in this task.');
    return;
  }

  if (task.slackThreads.length === 1) {
    vscode.env.openExternal(vscode.Uri.parse(task.slackThreads[0].url));
    return;
  }

  const items = task.slackThreads.map((t) => ({
    label: t.title || t.url,
    description: t.title ? t.url : undefined,
    thread: t,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a Slack thread to open',
  });

  if (selected) {
    vscode.env.openExternal(vscode.Uri.parse(selected.thread.url));
  }
}

async function addLinkCommand(): Promise<void> {
  const task = getCurrentTask();
  if (!task) {
    vscode.window.showWarningMessage('This command is only available in a Grove task workspace.');
    return;
  }

  const url = await vscode.window.showInputBox({
    prompt: 'Enter link URL (Confluence, Notion, Google Docs, Figma, or any URL)',
    placeHolder: 'https://company.atlassian.net/wiki/spaces/...',
    validateInput: (value) => {
      if (!value.trim()) {
        return 'URL is required';
      }
      try {
        new URL(value);
        return undefined;
      } catch {
        return 'Please enter a valid URL';
      }
    },
  });

  if (!url) {
    return;
  }

  const detectedType = detectLinkType(url);
  const typeLabels: Record<string, string> = {
    confluence: 'Confluence',
    notion: 'Notion',
    'google-docs': 'Google Docs',
    figma: 'Figma',
    other: 'Other',
  };

  const title = await vscode.window.showInputBox({
    prompt: `Enter a title for this ${typeLabels[detectedType]} link (optional)`,
    placeHolder: 'Design document for API',
  });

  const result = addLink(task.id, url, title || undefined, detectedType);
  if (!result.success) {
    vscode.window.showErrorMessage(`Failed to add link: ${result.error}`);
    return;
  }

  vscode.window.showInformationMessage(`${typeLabels[detectedType]} link added.`);
}

async function removeLinkCommand(): Promise<void> {
  const task = getCurrentTask();
  if (!task) {
    vscode.window.showWarningMessage('This command is only available in a Grove task workspace.');
    return;
  }

  // Initialize links array if it doesn't exist (for backward compatibility)
  const links = task.links || [];

  if (links.length === 0) {
    vscode.window.showInformationMessage('No links in this task.');
    return;
  }

  const typeLabels: Record<string, string> = {
    confluence: 'Confluence',
    notion: 'Notion',
    'google-docs': 'Google Docs',
    figma: 'Figma',
    other: 'Link',
  };

  const items = links.map((l) => ({
    label: l.title || l.url,
    description: l.title ? `${l.url} (${typeLabels[l.type]})` : typeLabels[l.type],
    link: l,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a link to remove',
  });

  if (!selected) {
    return;
  }

  const result = removeLink(task.id, selected.link.url);
  if (!result.success) {
    vscode.window.showErrorMessage(`Failed to remove link: ${result.error}`);
    return;
  }

  vscode.window.showInformationMessage('Link removed.');
}

async function openLinkCommand(): Promise<void> {
  const task = getCurrentTask();
  if (!task) {
    vscode.window.showWarningMessage('This command is only available in a Grove task workspace.');
    return;
  }

  // Initialize links array if it doesn't exist (for backward compatibility)
  const links = task.links || [];

  if (links.length === 0) {
    vscode.window.showInformationMessage('No links in this task.');
    return;
  }

  if (links.length === 1) {
    vscode.env.openExternal(vscode.Uri.parse(links[0].url));
    return;
  }

  const typeLabels: Record<string, string> = {
    confluence: 'Confluence',
    notion: 'Notion',
    'google-docs': 'Google Docs',
    figma: 'Figma',
    other: 'Link',
  };

  const items = links.map((l) => ({
    label: l.title || l.url,
    description: l.title ? `${l.url} (${typeLabels[l.type]})` : typeLabels[l.type],
    link: l,
  }));

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Select a link to open',
  });

  if (selected) {
    vscode.env.openExternal(vscode.Uri.parse(selected.link.url));
  }
}
