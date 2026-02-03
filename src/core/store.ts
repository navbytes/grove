/**
 * Task store for Grove
 * Handles reading/writing tasks.json
 */

import * as fs from 'fs';
import { Task, GROVE_PATHS, OperationResult, TaskStatus } from './types';
import { getGrovePath, ensureGroveDir } from './config';

/**
 * Read all tasks from the store
 */
export function readTasks(): OperationResult<Task[]> {
  try {
    const tasksPath = getGrovePath(GROVE_PATHS.TASKS_FILE);

    if (!fs.existsSync(tasksPath)) {
      return { success: true, data: [] };
    }

    const content = fs.readFileSync(tasksPath, 'utf-8');
    const tasks = JSON.parse(content) as Task[];

    return { success: true, data: tasks };
  } catch (error) {
    return {
      success: false,
      error: `Failed to read tasks: ${error}`,
    };
  }
}

/**
 * Write tasks to the store
 */
export function writeTasks(tasks: Task[]): OperationResult {
  try {
    const dirResult = ensureGroveDir();
    if (!dirResult.success) {
      return dirResult;
    }

    const tasksPath = getGrovePath(GROVE_PATHS.TASKS_FILE);
    fs.writeFileSync(tasksPath, JSON.stringify(tasks, null, 2), 'utf-8');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to write tasks: ${error}`,
    };
  }
}

/**
 * Get a task by ID
 */
export function getTask(taskId: string): OperationResult<Task | null> {
  const result = readTasks();
  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  const task = result.data.find((t) => t.id === taskId);
  return { success: true, data: task || null };
}

/**
 * Add a new task to the store
 */
export function addTask(task: Task): OperationResult {
  const result = readTasks();
  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  const tasks = result.data;

  // Check if task with same ID already exists
  if (tasks.some((t) => t.id === task.id)) {
    return {
      success: false,
      error: `Task with ID "${task.id}" already exists`,
    };
  }

  tasks.push(task);
  return writeTasks(tasks);
}

/**
 * Update an existing task
 */
export function updateTask(taskId: string, updates: Partial<Task>): OperationResult<Task> {
  const result = readTasks();
  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  const tasks = result.data;
  const index = tasks.findIndex((t) => t.id === taskId);

  if (index === -1) {
    return {
      success: false,
      error: `Task "${taskId}" not found`,
    };
  }

  const updatedTask: Task = {
    ...tasks[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  tasks[index] = updatedTask;

  const writeResult = writeTasks(tasks);
  if (!writeResult.success) {
    return { success: false, error: writeResult.error };
  }

  return { success: true, data: updatedTask };
}

/**
 * Delete a task from the store
 */
export function deleteTask(taskId: string): OperationResult {
  const result = readTasks();
  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  const tasks = result.data;
  const index = tasks.findIndex((t) => t.id === taskId);

  if (index === -1) {
    return {
      success: false,
      error: `Task "${taskId}" not found`,
    };
  }

  tasks.splice(index, 1);
  return writeTasks(tasks);
}

/**
 * Get all tasks by status
 */
export function getTasksByStatus(status: TaskStatus): OperationResult<Task[]> {
  const result = readTasks();
  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  const tasks = result.data.filter((t) => t.status === status);
  return { success: true, data: tasks };
}

/**
 * Get active tasks
 */
export function getActiveTasks(): OperationResult<Task[]> {
  return getTasksByStatus('active');
}

/**
 * Get archived tasks
 */
export function getArchivedTasks(): OperationResult<Task[]> {
  return getTasksByStatus('archived');
}

/**
 * Archive a task (low-level store operation)
 */
export function setTaskArchived(taskId: string): OperationResult<Task> {
  return updateTask(taskId, { status: 'archived' });
}

/**
 * Find task by workspace file path
 */
export function findTaskByWorkspace(workspaceFile: string): OperationResult<Task | null> {
  const result = readTasks();
  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  const task = result.data.find((t) => t.workspaceFile === workspaceFile);
  return { success: true, data: task || null };
}

/**
 * Find tasks that contain a specific project
 */
export function findTasksByProject(projectName: string): OperationResult<Task[]> {
  const result = readTasks();
  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  const tasks = result.data.filter((t) =>
    t.projects.some((p) => p.name === projectName)
  );

  return { success: true, data: tasks };
}
