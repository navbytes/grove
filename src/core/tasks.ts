import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { getWorkspaceDir, loadConfig } from './config.js';
import { writeContextFile } from './context.js';
import { dirExists, expandPath, readJsonFile, writeJsonFile } from './store.js';
import type { OperationResult, Project, Task, TaskLink, TaskProject } from './types.js';
import { TASKS_FILE } from './types.js';
import { createWorktree, removeWorktree, runWorktreeSetup, type WorktreeSetupResult } from './worktree.js';

export async function loadTasks(): Promise<Task[]> {
  return readJsonFile<Task[]>(TASKS_FILE, []);
}

export async function saveTasks(tasks: Task[]): Promise<void> {
  await writeJsonFile(TASKS_FILE, tasks);
}

export async function findTask(taskId: string): Promise<Task | undefined> {
  const tasks = await loadTasks();
  return tasks.find((t) => t.id === taskId);
}

export async function getActiveTasks(): Promise<Task[]> {
  const tasks = await loadTasks();
  return tasks.filter((t) => t.status === 'active');
}

export async function getArchivedTasks(): Promise<Task[]> {
  const tasks = await loadTasks();
  return tasks.filter((t) => t.status === 'archived');
}

export function getTaskWorkspacePath(workspaceDir: string, taskId: string): string {
  return join(expandPath(workspaceDir), taskId);
}

export async function createTask(opts: {
  id: string;
  title: string;
  jiraTickets: string[];
  jiraUrl: string;
}): Promise<OperationResult<Task>> {
  const tasks = await loadTasks();

  if (tasks.some((t) => t.id === opts.id)) {
    return { success: false, error: `Task "${opts.id}" already exists` };
  }

  const now = new Date().toISOString();
  const task: Task = {
    id: opts.id,
    title: opts.title,
    jiraUrl: opts.jiraUrl,
    jiraTickets: opts.jiraTickets,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    projects: [],
    links: [],
    notes: '',
  };

  tasks.push(task);
  await saveTasks(tasks);
  return { success: true, data: task };
}

export async function addProjectToTask(
  taskId: string,
  project: Project,
  branch: string,
  baseBranch: string,
  workspaceDir: string,
): Promise<OperationResult<TaskProject & { setupResult?: WorktreeSetupResult }>> {
  const tasks = await loadTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return { success: false, error: `Task "${taskId}" not found` };
  }

  if (task.projects.some((p) => p.name === project.name)) {
    return { success: false, error: `Project "${project.name}" is already in this task` };
  }

  const worktreePath = join(expandPath(workspaceDir), taskId, project.name);

  const result = await createWorktree({
    repoPath: project.path,
    worktreePath,
    branch,
    baseBranch,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  // Run worktree setup if configured
  let setupResult: WorktreeSetupResult | undefined;
  if (project.worktreeSetup) {
    const setup = await runWorktreeSetup({
      repoPath: project.path,
      worktreePath,
      setup: project.worktreeSetup,
    });
    setupResult = setup.data;
  }

  const taskProject: TaskProject = {
    name: project.name,
    repoPath: project.path,
    worktreePath,
    branch,
    baseBranch,
    pr: null,
  };

  task.projects.push(taskProject);
  task.updatedAt = new Date().toISOString();
  await saveTasks(tasks);

  // Update context file
  await writeContextFile(task, expandPath(workspaceDir));

  return { success: true, data: { ...taskProject, setupResult } };
}

export async function removeProjectFromTask(taskId: string, projectName: string): Promise<OperationResult> {
  const tasks = await loadTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return { success: false, error: `Task "${taskId}" not found` };
  }

  const projectIndex = task.projects.findIndex((p) => p.name === projectName);
  if (projectIndex === -1) {
    return { success: false, error: `Project "${projectName}" not found in task "${taskId}"` };
  }

  const project = task.projects[projectIndex] as TaskProject;

  // Remove worktree
  const result = await removeWorktree({
    repoPath: project.repoPath,
    worktreePath: project.worktreePath,
  });

  if (!result.success) {
    return { success: false, error: result.error };
  }

  task.projects.splice(projectIndex, 1);
  task.updatedAt = new Date().toISOString();
  await saveTasks(tasks);

  // Update context file
  const config = await loadConfig();
  await writeContextFile(task, getWorkspaceDir(config));

  return { success: true };
}

export async function archiveTask(taskId: string, cleanup: boolean): Promise<OperationResult> {
  const tasks = await loadTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return { success: false, error: `Task "${taskId}" not found` };
  }

  if (cleanup) {
    // Remove all worktrees
    for (const project of task.projects) {
      await removeWorktree({
        repoPath: project.repoPath,
        worktreePath: project.worktreePath,
      });
    }

    // Remove workspace directory
    const config = await loadConfig();
    const taskDir = getTaskWorkspacePath(getWorkspaceDir(config), taskId);
    if (await dirExists(taskDir)) {
      await rm(taskDir, { recursive: true, force: true });
    }
  }

  task.status = 'archived';
  task.updatedAt = new Date().toISOString();
  await saveTasks(tasks);
  return { success: true };
}

export async function deleteTask(taskId: string): Promise<OperationResult> {
  const tasks = await loadTasks();
  const taskIndex = tasks.findIndex((t) => t.id === taskId);
  if (taskIndex === -1) {
    return { success: false, error: `Task "${taskId}" not found` };
  }

  const task = tasks[taskIndex] as Task;

  // Remove all worktrees
  for (const project of task.projects) {
    await removeWorktree({
      repoPath: project.repoPath,
      worktreePath: project.worktreePath,
    });
  }

  // Remove workspace directory
  const config = await loadConfig();
  const taskDir = getTaskWorkspacePath(getWorkspaceDir(config), taskId);
  if (await dirExists(taskDir)) {
    await rm(taskDir, { recursive: true, force: true });
  }

  tasks.splice(taskIndex, 1);
  await saveTasks(tasks);
  return { success: true };
}

export async function touchTask(taskId: string): Promise<void> {
  const tasks = await loadTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (task) {
    task.updatedAt = new Date().toISOString();
    await saveTasks(tasks);
  }
}

export async function addLinkToTask(taskId: string, link: TaskLink): Promise<OperationResult> {
  const tasks = await loadTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return { success: false, error: `Task "${taskId}" not found` };
  }

  task.links.push(link);
  task.updatedAt = new Date().toISOString();
  await saveTasks(tasks);

  // Update context file
  const config = await loadConfig();
  await writeContextFile(task, getWorkspaceDir(config));

  return { success: true };
}

export async function removeLinkFromTask(taskId: string, index: number): Promise<OperationResult> {
  const tasks = await loadTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return { success: false, error: `Task "${taskId}" not found` };
  }

  // Index is 1-based (as displayed to user)
  const zeroIndex = index - 1;
  if (zeroIndex < 0 || zeroIndex >= task.links.length) {
    return { success: false, error: `Invalid link index: ${index}` };
  }

  task.links.splice(zeroIndex, 1);
  task.updatedAt = new Date().toISOString();
  await saveTasks(tasks);

  // Update context file
  const config = await loadConfig();
  await writeContextFile(task, getWorkspaceDir(config));

  return { success: true };
}

export async function detectCurrentTask(): Promise<Task | null> {
  // Check GROVE_TASK environment variable first
  const envTaskId = process.env.GROVE_TASK;
  if (envTaskId) {
    const task = await findTask(envTaskId);
    if (task) return task;
  }

  // Try to detect from current working directory
  const cwd = process.cwd();
  const config = await loadConfig();
  const workspaceDir = getWorkspaceDir(config);

  if (!cwd.startsWith(workspaceDir)) {
    return null;
  }

  // cwd is something like /Users/.../grove-workspaces/TASK-200/backend-api
  // Extract the task ID from the path
  const relativePath = cwd.slice(workspaceDir.length + 1); // strip workspace dir + separator
  const taskId = relativePath.split('/')[0];
  if (!taskId) return null;

  return (await findTask(taskId)) ?? null;
}
