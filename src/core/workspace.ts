/**
 * VS Code workspace file generation for Grove
 */

import * as fs from 'fs';
import * as path from 'path';
import { Task, WorkspaceFile, OperationResult } from './types';
import { getTaskDir } from './config';

/**
 * Get the workspace file path for a task
 */
export function getWorkspaceFilePath(taskId: string): string {
  const taskDir = getTaskDir(taskId);
  return path.join(taskDir, `${taskId}.code-workspace`);
}

/**
 * Generate the workspace file content
 */
export function createWorkspaceContent(task: Task): WorkspaceFile {
  const folders = task.projects.map((project) => ({
    name: `${project.name} (${task.id})`,
    path: project.worktreePath,
  }));

  return {
    folders,
    settings: {
      'grove.taskId': task.id,
    },
  };
}

/**
 * Generate and write the workspace file for a task
 */
export function generateWorkspaceFile(task: Task): OperationResult {
  try {
    const workspaceContent = createWorkspaceContent(task);
    const workspacePath = getWorkspaceFilePath(task.id);

    // Ensure the task directory exists
    const taskDir = path.dirname(workspacePath);
    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true });
    }

    fs.writeFileSync(
      workspacePath,
      JSON.stringify(workspaceContent, null, 2),
      'utf-8'
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to generate workspace file: ${error}`,
    };
  }
}

/**
 * Read an existing workspace file
 */
export function readWorkspaceFile(workspacePath: string): OperationResult<WorkspaceFile> {
  try {
    if (!fs.existsSync(workspacePath)) {
      return { success: false, error: 'Workspace file does not exist' };
    }

    const content = fs.readFileSync(workspacePath, 'utf-8');
    const workspace = JSON.parse(content) as WorkspaceFile;

    return { success: true, data: workspace };
  } catch (error) {
    return {
      success: false,
      error: `Failed to read workspace file: ${error}`,
    };
  }
}

/**
 * Check if a workspace file is a Grove task workspace
 */
export function isGroveWorkspace(workspacePath: string): boolean {
  const result = readWorkspaceFile(workspacePath);
  if (!result.success || !result.data) {
    return false;
  }

  return 'grove.taskId' in (result.data.settings || {});
}

/**
 * Get the task ID from a workspace file
 */
export function getTaskIdFromWorkspace(workspacePath: string): string | null {
  const result = readWorkspaceFile(workspacePath);
  if (!result.success || !result.data) {
    return null;
  }

  const taskId = result.data.settings?.['grove.taskId'];
  return typeof taskId === 'string' ? taskId : null;
}

/**
 * Update the workspace file with new folders
 */
export function updateWorkspaceFile(
  workspacePath: string,
  task: Task
): OperationResult {
  try {
    const workspaceContent = createWorkspaceContent(task);

    fs.writeFileSync(
      workspacePath,
      JSON.stringify(workspaceContent, null, 2),
      'utf-8'
    );

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to update workspace file: ${error}`,
    };
  }
}
