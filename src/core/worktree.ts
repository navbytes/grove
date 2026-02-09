import { execFile } from 'node:child_process';
import { copyFile, cp, mkdir, symlink } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';
import { dirExists, fileExists } from './store.js';
import type { OperationResult, WorktreeInfo, WorktreeSetup, WorktreeSetupCopyEntry } from './types.js';

const execFileAsync = promisify(execFile);

export async function execGit(args: string[], cwd: string): Promise<OperationResult<string>> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd });
    return { success: true, data: stdout.trim() };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

export async function branchExists(repoPath: string, branch: string): Promise<boolean> {
  const result = await execGit(['rev-parse', '--verify', `refs/heads/${branch}`], repoPath);
  return result.success;
}

export async function worktreePathInUse(repoPath: string, worktreePath: string): Promise<boolean> {
  const result = await listWorktrees(repoPath);
  if (!result.success || !result.data) return false;
  return result.data.some((wt) => wt.path === worktreePath);
}

export async function listWorktrees(repoPath: string): Promise<OperationResult<WorktreeInfo[]>> {
  const result = await execGit(['worktree', 'list', '--porcelain'], repoPath);
  if (!result.success) return { success: false, error: result.error };

  const worktrees: WorktreeInfo[] = [];
  let current: Partial<WorktreeInfo> = {};

  for (const line of (result.data || '').split('\n')) {
    if (line.startsWith('worktree ')) {
      current.path = line.slice('worktree '.length);
    } else if (line.startsWith('HEAD ')) {
      current.head = line.slice('HEAD '.length);
    } else if (line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).replace('refs/heads/', '');
    } else if (line === '') {
      if (current.path) {
        worktrees.push({
          path: current.path,
          branch: current.branch || '',
          head: current.head || '',
        });
      }
      current = {};
    }
  }

  // Handle last entry if no trailing newline
  if (current.path) {
    worktrees.push({
      path: current.path,
      branch: current.branch || '',
      head: current.head || '',
    });
  }

  return { success: true, data: worktrees };
}

export async function createWorktree(opts: {
  repoPath: string;
  worktreePath: string;
  branch: string;
  baseBranch: string;
}): Promise<OperationResult<string>> {
  const { repoPath, worktreePath, branch, baseBranch } = opts;

  // Check if worktree path already exists
  if (await dirExists(worktreePath)) {
    return { success: false, error: `Worktree path already exists: ${worktreePath}` };
  }

  // Check if branch already exists
  const exists = await branchExists(repoPath, branch);
  if (exists) {
    // Use existing branch
    const result = await execGit(['worktree', 'add', worktreePath, branch], repoPath);
    if (!result.success) {
      return { success: false, error: `Failed to create worktree: ${result.error}` };
    }
    return { success: true, data: worktreePath };
  }

  // Create new branch from baseBranch
  const result = await execGit(['worktree', 'add', '-b', branch, worktreePath, baseBranch], repoPath);
  if (!result.success) {
    return { success: false, error: `Failed to create worktree: ${result.error}` };
  }

  return { success: true, data: worktreePath };
}

export async function removeWorktree(opts: { repoPath: string; worktreePath: string }): Promise<OperationResult> {
  const { repoPath, worktreePath } = opts;

  const result = await execGit(['worktree', 'remove', worktreePath, '--force'], repoPath);
  if (!result.success) {
    return { success: false, error: `Failed to remove worktree: ${result.error}` };
  }

  return { success: true };
}

// --- Worktree Setup ---

export interface WorktreeSetupResult {
  copiedFiles: string[];
  symlinkedFiles: string[];
  commandResults: Array<{ command: string; success: boolean; error?: string }>;
  warnings: string[];
}

export async function runWorktreeSetup(opts: {
  repoPath: string;
  worktreePath: string;
  setup: WorktreeSetup;
}): Promise<OperationResult<WorktreeSetupResult>> {
  const { repoPath, worktreePath, setup } = opts;
  const result: WorktreeSetupResult = {
    copiedFiles: [],
    symlinkedFiles: [],
    commandResults: [],
    warnings: [],
  };

  if (setup.copyFiles) {
    for (const entry of setup.copyFiles) {
      const entryResult = await processSetupEntry(repoPath, worktreePath, entry);
      if (entryResult.success) {
        const dest = entry.destination || entry.source;
        if (entry.mode === 'symlink') {
          result.symlinkedFiles.push(dest);
        } else {
          result.copiedFiles.push(dest);
        }
      } else {
        result.warnings.push(entryResult.error || `Failed to process: ${entry.source}`);
      }
    }
  }

  if (setup.postCreateCommands) {
    for (const command of setup.postCreateCommands) {
      const cmdResult = await runSetupCommand(command, worktreePath);
      result.commandResults.push(cmdResult);
      if (!cmdResult.success) {
        result.warnings.push(`Command failed: ${command} — ${cmdResult.error}`);
      }
    }
  }

  return { success: true, data: result };
}

async function processSetupEntry(
  repoPath: string,
  worktreePath: string,
  entry: WorktreeSetupCopyEntry,
): Promise<OperationResult> {
  const sourcePath = resolve(repoPath, entry.source);
  const destPath = resolve(worktreePath, entry.destination || entry.source);

  const sourceIsDir = await dirExists(sourcePath);
  const sourceIsFile = !sourceIsDir && (await fileExists(sourcePath));

  if (!sourceIsDir && !sourceIsFile) {
    return { success: false, error: `Source not found: ${entry.source}` };
  }

  await mkdir(dirname(destPath), { recursive: true });

  if (entry.mode === 'symlink') {
    try {
      await symlink(sourcePath, destPath);
      return { success: true };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Symlink failed for ${entry.source}: ${message}` };
    }
  }

  try {
    if (sourceIsDir) {
      await cp(sourcePath, destPath, { recursive: true });
    } else {
      await copyFile(sourcePath, destPath);
    }
    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Copy failed for ${entry.source}: ${message}` };
  }
}

async function runSetupCommand(
  command: string,
  cwd: string,
): Promise<{ command: string; success: boolean; error?: string }> {
  try {
    await execFileAsync('/bin/sh', ['-c', command], { cwd, timeout: 120_000 });
    return { command, success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { command, success: false, error: message };
  }
}
