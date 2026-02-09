import { execFile } from 'node:child_process';
import { basename, resolve } from 'node:path';
import { promisify } from 'node:util';
import { dirExists, expandPath, readJsonFile, writeJsonFile } from './store.js';
import type { OperationResult, Project } from './types.js';
import { PROJECTS_FILE } from './types.js';

const execFileAsync = promisify(execFile);

export async function loadProjects(): Promise<Project[]> {
  return readJsonFile<Project[]>(PROJECTS_FILE, []);
}

export async function saveProjects(projects: Project[]): Promise<void> {
  await writeJsonFile(PROJECTS_FILE, projects);
}

export async function findProject(name: string): Promise<Project | undefined> {
  const projects = await loadProjects();
  return projects.find((p) => p.name === name);
}

export async function addProject(repoPath: string): Promise<OperationResult<Project>> {
  const absPath = expandPath(repoPath);

  if (!(await dirExists(absPath))) {
    return { success: false, error: `Directory does not exist: ${absPath}` };
  }

  // Verify it's a git repo
  try {
    await execFileAsync('git', ['rev-parse', '--git-dir'], { cwd: absPath });
  } catch {
    return { success: false, error: `Not a git repository: ${absPath}` };
  }

  const name = await detectRepoName(absPath);
  const defaultBaseBranch = await detectDefaultBranch(absPath);

  const projects = await loadProjects();
  if (projects.some((p) => p.name === name)) {
    return { success: false, error: `Project "${name}" is already registered` };
  }

  const project: Project = { name, path: absPath, defaultBaseBranch };
  projects.push(project);
  await saveProjects(projects);

  return { success: true, data: project };
}

export async function removeProject(name: string): Promise<OperationResult> {
  const projects = await loadProjects();
  const index = projects.findIndex((p) => p.name === name);
  if (index === -1) {
    return { success: false, error: `Project "${name}" not found` };
  }

  projects.splice(index, 1);
  await saveProjects(projects);
  return { success: true };
}

export async function detectRepoName(repoPath: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync('git', ['remote', 'get-url', 'origin'], {
      cwd: repoPath,
    });
    const url = stdout.trim();
    // Handle SSH: git@github.com:org/repo.git
    // Handle HTTPS: https://github.com/org/repo.git
    const match = url.match(/\/([^/]+?)(?:\.git)?$/);
    if (match?.[1]) {
      return match[1];
    }
  } catch {
    // No remote configured, fall back to directory name
  }

  return basename(resolve(repoPath));
}

export async function detectDefaultBranch(repoPath: string): Promise<string> {
  // Try reading the HEAD reference of origin
  try {
    const { stdout } = await execFileAsync('git', ['symbolic-ref', 'refs/remotes/origin/HEAD', '--short'], {
      cwd: repoPath,
    });
    const ref = stdout.trim();
    // Returns something like "origin/main" — strip the "origin/" prefix
    return ref.replace(/^origin\//, '');
  } catch {
    // Fall through
  }

  // Try checking if main or master exists
  for (const branch of ['main', 'master', 'develop']) {
    try {
      await execFileAsync('git', ['rev-parse', '--verify', `refs/heads/${branch}`], {
        cwd: repoPath,
      });
      return branch;
    } catch {
      // Try next
    }
  }

  return 'main';
}
