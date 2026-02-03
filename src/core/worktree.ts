/**
 * Git worktree operations for Grove
 * Spawns git CLI commands for worktree management
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { OperationResult, WorktreeCreateOptions } from './types';

/**
 * Execute a git command and return the result
 */
export function execGit(
  cwd: string,
  args: string[]
): Promise<OperationResult<string>> {
  return new Promise((resolve) => {
    const git = spawn('git', args, { cwd });

    let stdout = '';
    let stderr = '';

    git.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    git.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    git.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, data: stdout });
      } else {
        resolve({ success: false, error: stderr || `Git command failed with code ${code}` });
      }
    });

    git.on('error', (error) => {
      resolve({ success: false, error: `Failed to spawn git: ${error.message}` });
    });
  });
}

/**
 * Create a new git worktree
 */
export async function createWorktree(options: WorktreeCreateOptions): Promise<OperationResult> {
  const { repoPath, worktreePath, branch, baseBranch, createBranch = true } = options;

  // Ensure parent directory exists
  const parentDir = path.dirname(worktreePath);
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir, { recursive: true });
  }

  // Check if worktree path already exists
  if (fs.existsSync(worktreePath)) {
    return {
      success: false,
      error: `Worktree path already exists: ${worktreePath}`,
    };
  }

  // Check if branch already exists
  const branchExists = await checkBranchExists(repoPath, branch);

  let args: string[];
  if (createBranch && !branchExists.data) {
    // Create new branch based on baseBranch
    args = ['worktree', 'add', '-b', branch, worktreePath, baseBranch];
  } else if (branchExists.data) {
    // Use existing branch
    args = ['worktree', 'add', worktreePath, branch];
  } else {
    // Create new branch based on baseBranch
    args = ['worktree', 'add', '-b', branch, worktreePath, baseBranch];
  }

  const result = await execGit(repoPath, args);

  if (!result.success) {
    return {
      success: false,
      error: `Failed to create worktree: ${result.error}`,
    };
  }

  return { success: true };
}

/**
 * Remove a git worktree
 */
export async function removeWorktree(
  repoPath: string,
  worktreePath: string,
  force: boolean = false
): Promise<OperationResult> {
  const args = force
    ? ['worktree', 'remove', '--force', worktreePath]
    : ['worktree', 'remove', worktreePath];

  const result = await execGit(repoPath, args);

  if (!result.success) {
    return {
      success: false,
      error: `Failed to remove worktree: ${result.error}`,
    };
  }

  return { success: true };
}

/**
 * List all worktrees for a repository
 */
export async function listWorktrees(
  repoPath: string
): Promise<OperationResult<string[]>> {
  const result = await execGit(repoPath, ['worktree', 'list', '--porcelain']);

  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  const worktrees: string[] = [];
  const lines = result.data.split('\n');

  for (const line of lines) {
    if (line.startsWith('worktree ')) {
      worktrees.push(line.replace('worktree ', ''));
    }
  }

  return { success: true, data: worktrees };
}

/**
 * Check if a branch exists in the repository
 */
export async function checkBranchExists(
  repoPath: string,
  branch: string
): Promise<OperationResult<boolean>> {
  // Check local branches
  const localResult = await execGit(repoPath, [
    'show-ref',
    '--verify',
    '--quiet',
    `refs/heads/${branch}`,
  ]);

  if (localResult.success) {
    return { success: true, data: true };
  }

  // Check remote branches
  const remoteResult = await execGit(repoPath, [
    'show-ref',
    '--verify',
    '--quiet',
    `refs/remotes/origin/${branch}`,
  ]);

  return { success: true, data: remoteResult.success };
}

/**
 * Get the current branch of a worktree
 */
export async function getCurrentBranch(worktreePath: string): Promise<OperationResult<string>> {
  const result = await execGit(worktreePath, ['rev-parse', '--abbrev-ref', 'HEAD']);

  if (!result.success || !result.data) {
    return { success: false, error: result.error };
  }

  return { success: true, data: result.data.trim() };
}

/**
 * Check if a worktree has uncommitted changes
 */
export async function hasUncommittedChanges(worktreePath: string): Promise<OperationResult<boolean>> {
  const result = await execGit(worktreePath, ['status', '--porcelain']);

  if (!result.success) {
    return { success: false, error: result.error };
  }

  const hasChanges = (result.data || '').trim().length > 0;
  return { success: true, data: hasChanges };
}

/**
 * Push a branch to remote
 */
export async function pushBranch(
  worktreePath: string,
  branch: string,
  setUpstream: boolean = true
): Promise<OperationResult> {
  const args = setUpstream
    ? ['push', '-u', 'origin', branch]
    : ['push', 'origin', branch];

  const result = await execGit(worktreePath, args);

  if (!result.success) {
    return {
      success: false,
      error: `Failed to push branch: ${result.error}`,
    };
  }

  return { success: true };
}

/**
 * Fetch from remote
 */
export async function fetchRemote(repoPath: string): Promise<OperationResult> {
  const result = await execGit(repoPath, ['fetch', 'origin']);

  if (!result.success) {
    return {
      success: false,
      error: `Failed to fetch: ${result.error}`,
    };
  }

  return { success: true };
}

/**
 * Check if branch has been pushed to remote
 */
export async function isBranchPushed(
  repoPath: string,
  branch: string
): Promise<OperationResult<boolean>> {
  const result = await execGit(repoPath, [
    'show-ref',
    '--verify',
    '--quiet',
    `refs/remotes/origin/${branch}`,
  ]);

  return { success: true, data: result.success };
}

/**
 * Prune worktrees (clean up stale entries)
 */
export async function pruneWorktrees(repoPath: string): Promise<OperationResult> {
  const result = await execGit(repoPath, ['worktree', 'prune']);

  if (!result.success) {
    return {
      success: false,
      error: `Failed to prune worktrees: ${result.error}`,
    };
  }

  return { success: true };
}

/**
 * Delete a branch (local and optionally remote)
 */
export async function deleteBranch(
  repoPath: string,
  branch: string,
  deleteRemote: boolean = false
): Promise<OperationResult> {
  // Delete local branch
  const localResult = await execGit(repoPath, ['branch', '-D', branch]);
  if (!localResult.success) {
    // Branch might not exist locally, continue
  }

  if (deleteRemote) {
    const remoteResult = await execGit(repoPath, ['push', 'origin', '--delete', branch]);
    if (!remoteResult.success) {
      // Remote branch might not exist, continue
    }
  }

  return { success: true };
}
