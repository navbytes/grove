/**
 * Task management for Grove
 * High-level operations for creating, modifying, and managing tasks
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  Task,
  TaskProject,
  Project,
  OperationResult,
  SlackThread,
} from './types';
import {
  readConfig,
  getTaskDir,
  ensureTaskDir,
  generateBranchName,
  expandPath,
} from './config';
import { getProject, readProjects } from './projects';
import { addTask, updateTask, deleteTask, getTask, readTasks } from './store';
import { createWorktree, removeWorktree, hasUncommittedChanges } from './worktree';
import { generateWorkspaceFile, getWorkspaceFilePath } from './workspace';
import { generateContextFile, getContextFilePath, preserveNotes } from './context';

export interface CreateTaskOptions {
  ticketIds: string[];
  title: string;
  projectNames: string[];
  jiraUrl?: string;
}

export interface AddProjectToTaskOptions {
  taskId: string;
  projectName: string;
}

export interface RemoveProjectFromTaskOptions {
  taskId: string;
  projectName: string;
  force?: boolean;
}

/**
 * Create a new task with the specified projects
 */
export async function createTask(options: CreateTaskOptions): Promise<OperationResult<Task>> {
  const { ticketIds, title, projectNames, jiraUrl } = options;

  // Get config for branch template
  const configResult = readConfig();
  if (!configResult.success || !configResult.data) {
    return { success: false, error: configResult.error };
  }
  const config = configResult.data;

  // Use the first ticket ID as the task ID
  const taskId = ticketIds[0];

  // Check if task already exists
  const existingTask = getTask(taskId);
  if (existingTask.data) {
    return {
      success: false,
      error: `Task "${taskId}" already exists`,
    };
  }

  // Ensure task directory exists
  const dirResult = ensureTaskDir(taskId);
  if (!dirResult.success) {
    return { success: false, error: dirResult.error };
  }

  const taskDir = getTaskDir(taskId);
  const taskProjects: TaskProject[] = [];

  // Create worktrees for each project
  for (const projectName of projectNames) {
    const projectResult = getProject(projectName);
    if (!projectResult.success || !projectResult.data) {
      return {
        success: false,
        error: `Project "${projectName}" not found`,
      };
    }

    const project = projectResult.data;
    const branch = generateBranchName(
      config.branchTemplate,
      taskId,
      title
    );
    const worktreePath = path.join(taskDir, projectName);

    const worktreeResult = await createWorktree({
      repoPath: expandPath(project.path),
      worktreePath,
      branch,
      baseBranch: project.defaultBaseBranch,
      createBranch: true,
    });

    if (!worktreeResult.success) {
      // Clean up any worktrees we've already created
      for (const tp of taskProjects) {
        await removeWorktree(tp.repoPath, tp.worktreePath, true);
      }
      return {
        success: false,
        error: `Failed to create worktree for "${projectName}": ${worktreeResult.error}`,
      };
    }

    taskProjects.push({
      name: projectName,
      repoPath: expandPath(project.path),
      worktreePath,
      branch,
      baseBranch: project.defaultBaseBranch,
      pr: null,
    });
  }

  // Create the task object
  const now = new Date().toISOString();
  const task: Task = {
    id: taskId,
    title,
    jiraUrl,
    jiraTickets: ticketIds,
    status: 'active',
    createdAt: now,
    updatedAt: now,
    projects: taskProjects,
    workspaceFile: getWorkspaceFilePath(taskId),
    notes: '',
    slackThreads: [],
  };

  // Generate workspace file
  const workspaceResult = generateWorkspaceFile(task);
  if (!workspaceResult.success) {
    return { success: false, error: workspaceResult.error };
  }

  // Generate context file
  const contextResult = generateContextFile(task);
  if (!contextResult.success) {
    return { success: false, error: contextResult.error };
  }

  // Save task to store
  const saveResult = addTask(task);
  if (!saveResult.success) {
    return { success: false, error: saveResult.error };
  }

  return { success: true, data: task };
}

/**
 * Add a project to an existing task
 */
export async function addProjectToTask(
  options: AddProjectToTaskOptions
): Promise<OperationResult<Task>> {
  const { taskId, projectName } = options;

  // Get the task
  const taskResult = getTask(taskId);
  if (!taskResult.success || !taskResult.data) {
    return { success: false, error: `Task "${taskId}" not found` };
  }
  const task = taskResult.data;

  // Check if project is already in task
  if (task.projects.some((p) => p.name === projectName)) {
    return {
      success: false,
      error: `Project "${projectName}" is already in task "${taskId}"`,
    };
  }

  // Get the project
  const projectResult = getProject(projectName);
  if (!projectResult.success || !projectResult.data) {
    return { success: false, error: `Project "${projectName}" not found` };
  }
  const project = projectResult.data;

  // Get config for branch template
  const configResult = readConfig();
  if (!configResult.success || !configResult.data) {
    return { success: false, error: configResult.error };
  }
  const config = configResult.data;

  // Create worktree
  const taskDir = getTaskDir(taskId);
  const branch = generateBranchName(config.branchTemplate, taskId, task.title);
  const worktreePath = path.join(taskDir, projectName);

  const worktreeResult = await createWorktree({
    repoPath: expandPath(project.path),
    worktreePath,
    branch,
    baseBranch: project.defaultBaseBranch,
    createBranch: true,
  });

  if (!worktreeResult.success) {
    return {
      success: false,
      error: `Failed to create worktree: ${worktreeResult.error}`,
    };
  }

  // Add project to task
  const taskProject: TaskProject = {
    name: projectName,
    repoPath: expandPath(project.path),
    worktreePath,
    branch,
    baseBranch: project.defaultBaseBranch,
    pr: null,
  };

  task.projects.push(taskProject);

  // Update task in store
  const updateResult = updateTask(taskId, { projects: task.projects });
  if (!updateResult.success || !updateResult.data) {
    return { success: false, error: updateResult.error };
  }

  // Regenerate workspace and context files
  generateWorkspaceFile(updateResult.data);
  generateContextFile(updateResult.data);

  return { success: true, data: updateResult.data };
}

/**
 * Remove a project from a task
 */
export async function removeProjectFromTask(
  options: RemoveProjectFromTaskOptions
): Promise<OperationResult<Task>> {
  const { taskId, projectName, force = false } = options;

  // Get the task
  const taskResult = getTask(taskId);
  if (!taskResult.success || !taskResult.data) {
    return { success: false, error: `Task "${taskId}" not found` };
  }
  const task = taskResult.data;

  // Find the project in task
  const projectIndex = task.projects.findIndex((p) => p.name === projectName);
  if (projectIndex === -1) {
    return {
      success: false,
      error: `Project "${projectName}" is not in task "${taskId}"`,
    };
  }

  const taskProject = task.projects[projectIndex];

  // Check for uncommitted changes unless force is true
  if (!force) {
    const changesResult = await hasUncommittedChanges(taskProject.worktreePath);
    if (changesResult.success && changesResult.data) {
      return {
        success: false,
        error: `Project "${projectName}" has uncommitted changes. Use force to remove anyway.`,
      };
    }
  }

  // Remove worktree
  const removeResult = await removeWorktree(
    taskProject.repoPath,
    taskProject.worktreePath,
    force
  );
  if (!removeResult.success) {
    return {
      success: false,
      error: `Failed to remove worktree: ${removeResult.error}`,
    };
  }

  // Remove project from task
  task.projects.splice(projectIndex, 1);

  // Update task in store
  const updateResult = updateTask(taskId, { projects: task.projects });
  if (!updateResult.success || !updateResult.data) {
    return { success: false, error: updateResult.error };
  }

  // Regenerate workspace and context files
  generateWorkspaceFile(updateResult.data);
  generateContextFile(updateResult.data);

  return { success: true, data: updateResult.data };
}

/**
 * Archive a task
 */
export async function archiveTask(
  taskId: string,
  cleanup: boolean = false
): Promise<OperationResult<Task>> {
  // Get the task
  const taskResult = getTask(taskId);
  if (!taskResult.success || !taskResult.data) {
    return { success: false, error: `Task "${taskId}" not found` };
  }
  const task = taskResult.data;

  if (cleanup) {
    // Remove all worktrees
    for (const project of task.projects) {
      await removeWorktree(project.repoPath, project.worktreePath, true);
    }

    // Remove workspace file
    if (fs.existsSync(task.workspaceFile)) {
      fs.unlinkSync(task.workspaceFile);
    }

    // Remove context file
    const contextPath = getContextFilePath(taskId);
    if (fs.existsSync(contextPath)) {
      fs.unlinkSync(contextPath);
    }

    // Remove task directory if empty
    const taskDir = getTaskDir(taskId);
    try {
      const files = fs.readdirSync(taskDir);
      if (files.length === 0) {
        fs.rmdirSync(taskDir);
      }
    } catch {
      // Directory might not exist or have permission issues
    }
  }

  // Update task status
  const updateResult = updateTask(taskId, { status: 'archived' });
  if (!updateResult.success || !updateResult.data) {
    return { success: false, error: updateResult.error };
  }

  return { success: true, data: updateResult.data };
}

/**
 * Delete a task completely
 */
export async function deleteTaskCompletely(taskId: string): Promise<OperationResult> {
  // Get the task
  const taskResult = getTask(taskId);
  if (!taskResult.success || !taskResult.data) {
    return { success: false, error: `Task "${taskId}" not found` };
  }
  const task = taskResult.data;

  // Remove all worktrees
  for (const project of task.projects) {
    await removeWorktree(project.repoPath, project.worktreePath, true);
  }

  // Remove workspace file
  if (fs.existsSync(task.workspaceFile)) {
    fs.unlinkSync(task.workspaceFile);
  }

  // Remove context file
  const contextPath = getContextFilePath(taskId);
  if (fs.existsSync(contextPath)) {
    fs.unlinkSync(contextPath);
  }

  // Remove task directory
  const taskDir = getTaskDir(taskId);
  try {
    fs.rmSync(taskDir, { recursive: true, force: true });
  } catch {
    // Directory might not exist
  }

  // Delete from store
  return deleteTask(taskId);
}

/**
 * Add a Slack thread to a task
 */
export function addSlackThread(
  taskId: string,
  url: string,
  title?: string
): OperationResult<Task> {
  const taskResult = getTask(taskId);
  if (!taskResult.success || !taskResult.data) {
    return { success: false, error: `Task "${taskId}" not found` };
  }
  const task = taskResult.data;

  // Check if thread already exists
  if (task.slackThreads.some((t) => t.url === url)) {
    return {
      success: false,
      error: 'Slack thread already added to this task',
    };
  }

  const thread: SlackThread = {
    url,
    title,
    addedAt: new Date().toISOString(),
  };

  task.slackThreads.push(thread);

  const updateResult = updateTask(taskId, { slackThreads: task.slackThreads });
  if (!updateResult.success || !updateResult.data) {
    return { success: false, error: updateResult.error };
  }

  // Regenerate context file to include Slack threads
  generateContextFile(updateResult.data);

  return { success: true, data: updateResult.data };
}

/**
 * Remove a Slack thread from a task
 */
export function removeSlackThread(taskId: string, url: string): OperationResult<Task> {
  const taskResult = getTask(taskId);
  if (!taskResult.success || !taskResult.data) {
    return { success: false, error: `Task "${taskId}" not found` };
  }
  const task = taskResult.data;

  const index = task.slackThreads.findIndex((t) => t.url === url);
  if (index === -1) {
    return {
      success: false,
      error: 'Slack thread not found in this task',
    };
  }

  task.slackThreads.splice(index, 1);

  const updateResult = updateTask(taskId, { slackThreads: task.slackThreads });
  if (!updateResult.success || !updateResult.data) {
    return { success: false, error: updateResult.error };
  }

  // Regenerate context file
  generateContextFile(updateResult.data);

  return { success: true, data: updateResult.data };
}

/**
 * Update a Slack thread title
 */
export function updateSlackThreadTitle(
  taskId: string,
  url: string,
  newTitle: string
): OperationResult<Task> {
  const taskResult = getTask(taskId);
  if (!taskResult.success || !taskResult.data) {
    return { success: false, error: `Task "${taskId}" not found` };
  }
  const task = taskResult.data;

  const thread = task.slackThreads.find((t) => t.url === url);
  if (!thread) {
    return {
      success: false,
      error: 'Slack thread not found in this task',
    };
  }

  thread.title = newTitle;

  const updateResult = updateTask(taskId, { slackThreads: task.slackThreads });
  if (!updateResult.success || !updateResult.data) {
    return { success: false, error: updateResult.error };
  }

  // Regenerate context file
  generateContextFile(updateResult.data);

  return { success: true, data: updateResult.data };
}

/**
 * Get projects not in a specific task (for adding to task)
 */
export function getAvailableProjectsForTask(taskId: string): OperationResult<Project[]> {
  const taskResult = getTask(taskId);
  if (!taskResult.success || !taskResult.data) {
    return { success: false, error: `Task "${taskId}" not found` };
  }
  const task = taskResult.data;

  const projectsResult = readProjects();
  if (!projectsResult.success || !projectsResult.data) {
    return { success: false, error: projectsResult.error };
  }

  const taskProjectNames = new Set(task.projects.map((p) => p.name));
  const available = projectsResult.data.filter((p) => !taskProjectNames.has(p.name));

  return { success: true, data: available };
}

/**
 * Refresh task data (regenerate workspace and context files)
 */
export function refreshTask(taskId: string): OperationResult<Task> {
  const taskResult = getTask(taskId);
  if (!taskResult.success || !taskResult.data) {
    return { success: false, error: `Task "${taskId}" not found` };
  }
  const task = taskResult.data;

  // Regenerate files
  generateWorkspaceFile(task);
  generateContextFile(task);

  return { success: true, data: task };
}
