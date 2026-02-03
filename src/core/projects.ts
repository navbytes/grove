/**
 * Project registry management for Grove
 * Handles registered git repositories
 */

import * as fs from 'fs';
import * as path from 'path';
import { Project, GROVE_PATHS, OperationResult } from './types';
import { getGrovePath, ensureGroveDir, expandPath } from './config';
import { execGit } from './worktree';

/**
 * Read all registered projects
 */
export function readProjects(): OperationResult<Project[]> {
  try {
    const projectsPath = getGrovePath(GROVE_PATHS.PROJECTS_FILE);

    if (!fs.existsSync(projectsPath)) {
      return { success: true, data: [] };
    }

    const content = fs.readFileSync(projectsPath, 'utf-8');
    const projects = JSON.parse(content) as Project[];

    return { success: true, data: projects };
  } catch (error) {
    return {
      success: false,
      error: `Failed to read projects: ${error}`,
    };
  }
}

/**
 * Write the projects list
 */
export function writeProjects(projects: Project[]): OperationResult {
  try {
    const dirResult = ensureGroveDir();
    if (!dirResult.success) {
      return dirResult;
    }

    const projectsPath = getGrovePath(GROVE_PATHS.PROJECTS_FILE);
    fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2), 'utf-8');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to write projects: ${error}`,
    };
  }
}

/**
 * Get a project by name
 */
export function getProject(name: string): OperationResult<Project | null> {
  const result = readProjects();
  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  const project = result.data.find((p) => p.name === name);
  return { success: true, data: project || null };
}

/**
 * Register a new project
 */
export function registerProject(project: Project): OperationResult {
  const result = readProjects();
  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  const projects = result.data;

  // Check if project with same name already exists
  if (projects.some((p) => p.name === project.name)) {
    return {
      success: false,
      error: `Project with name "${project.name}" already exists`,
    };
  }

  // Check if project with same path already exists
  const expandedPath = expandPath(project.path);
  if (projects.some((p) => expandPath(p.path) === expandedPath)) {
    return {
      success: false,
      error: `Project at path "${project.path}" is already registered`,
    };
  }

  // Validate that the path is a git repository
  if (!isGitRepository(expandedPath)) {
    return {
      success: false,
      error: `Path "${project.path}" is not a valid git repository`,
    };
  }

  projects.push(project);
  return writeProjects(projects);
}

/**
 * Remove a project by name
 */
export function removeProject(name: string): OperationResult {
  const result = readProjects();
  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  const projects = result.data;
  const index = projects.findIndex((p) => p.name === name);

  if (index === -1) {
    return {
      success: false,
      error: `Project "${name}" not found`,
    };
  }

  projects.splice(index, 1);
  return writeProjects(projects);
}

/**
 * Update a project
 */
export function updateProject(name: string, updates: Partial<Project>): OperationResult<Project> {
  const result = readProjects();
  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  const projects = result.data;
  const index = projects.findIndex((p) => p.name === name);

  if (index === -1) {
    return {
      success: false,
      error: `Project "${name}" not found`,
    };
  }

  const updatedProject = { ...projects[index], ...updates };
  projects[index] = updatedProject;

  const writeResult = writeProjects(projects);
  if (!writeResult.success) {
    return { success: false, error: writeResult.error };
  }

  return { success: true, data: updatedProject };
}

/**
 * Check if a path is a valid git repository
 */
export function isGitRepository(repoPath: string): boolean {
  try {
    const gitDir = path.join(repoPath, '.git');
    return fs.existsSync(gitDir);
  } catch {
    return false;
  }
}

/**
 * Detect the default branch of a repository
 */
export async function detectDefaultBranch(repoPath: string): Promise<OperationResult<string>> {
  try {
    // Try to get the default branch from remote
    const result = await execGit(repoPath, [
      'symbolic-ref',
      'refs/remotes/origin/HEAD',
      '--short',
    ]);

    if (result.success && result.data) {
      // Remove 'origin/' prefix
      const branch = result.data.trim().replace('origin/', '');
      return { success: true, data: branch };
    }

    // Fallback: check if 'main' or 'master' exists
    const branchListResult = await execGit(repoPath, ['branch', '-l']);
    if (branchListResult.success && branchListResult.data) {
      const branches = branchListResult.data
        .split('\n')
        .map((b) => b.trim().replace('* ', ''));

      if (branches.includes('main')) {
        return { success: true, data: 'main' };
      }
      if (branches.includes('master')) {
        return { success: true, data: 'master' };
      }
    }

    // Default to 'main'
    return { success: true, data: 'main' };
  } catch (error) {
    return { success: true, data: 'main' }; // Default fallback
  }
}

/**
 * Get the remote URL of a repository
 */
export async function getRemoteUrl(repoPath: string): Promise<OperationResult<string>> {
  try {
    const result = await execGit(repoPath, ['remote', 'get-url', 'origin']);
    if (result.success && result.data) {
      return { success: true, data: result.data.trim() };
    }
    return { success: false, error: 'No remote URL found' };
  } catch (error) {
    return { success: false, error: `Failed to get remote URL: ${error}` };
  }
}

/**
 * Extract repo name from remote URL
 */
export function extractRepoName(remoteUrl: string): string | null {
  // Handle SSH format: git@github.com:org/repo.git
  const sshMatch = remoteUrl.match(/git@[^:]+:([^/]+)\/([^/.]+)/);
  if (sshMatch) {
    return sshMatch[2];
  }

  // Handle HTTPS format: https://github.com/org/repo.git
  const httpsMatch = remoteUrl.match(/https?:\/\/[^/]+\/([^/]+)\/([^/.]+)/);
  if (httpsMatch) {
    return httpsMatch[2];
  }

  return null;
}

/**
 * Extract owner/org from remote URL
 */
export function extractRepoOwner(remoteUrl: string): string | null {
  // Handle SSH format: git@github.com:org/repo.git
  const sshMatch = remoteUrl.match(/git@[^:]+:([^/]+)\/[^/.]+/);
  if (sshMatch) {
    return sshMatch[1];
  }

  // Handle HTTPS format: https://github.com/org/repo.git
  const httpsMatch = remoteUrl.match(/https?:\/\/[^/]+\/([^/]+)\/[^/.]+/);
  if (httpsMatch) {
    return httpsMatch[1];
  }

  return null;
}
