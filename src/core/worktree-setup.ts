/**
 * Worktree setup module - handles copying/symlinking files and running post-create commands
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import {
  CopyRule,
  WorktreeSetup,
  OperationResult,
  GROVE_PATHS,
  Project,
} from './types';

/**
 * Expand ~ to home directory in paths
 */
function expandPath(filePath: string): string {
  if (filePath.startsWith('~/')) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    return path.join(homeDir, filePath.slice(2));
  }
  return filePath;
}

/**
 * Read repo-level setup.json if it exists
 */
export function readRepoSetup(repoPath: string): WorktreeSetup | null {
  const setupPath = path.join(expandPath(repoPath), GROVE_PATHS.REPO_SETUP_FILE);
  if (fs.existsSync(setupPath)) {
    try {
      const content = fs.readFileSync(setupPath, 'utf-8');
      return JSON.parse(content) as WorktreeSetup;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Merge repo-level setup with project-level setup
 * Project-level takes precedence
 */
export function mergeSetups(
  repoSetup: WorktreeSetup | null,
  projectSetup: WorktreeSetup | undefined
): WorktreeSetup {
  const merged: WorktreeSetup = {
    copyFiles: [],
    postCreateCommands: [],
  };

  // Add repo-level rules first
  if (repoSetup?.copyFiles) {
    merged.copyFiles!.push(...repoSetup.copyFiles);
  }
  if (repoSetup?.postCreateCommands) {
    merged.postCreateCommands!.push(...repoSetup.postCreateCommands);
  }

  // Add project-level rules (may override/duplicate, but that's intentional)
  if (projectSetup?.copyFiles) {
    merged.copyFiles!.push(...projectSetup.copyFiles);
  }
  if (projectSetup?.postCreateCommands) {
    merged.postCreateCommands!.push(...projectSetup.postCreateCommands);
  }

  return merged;
}

/**
 * Copy a file or directory
 */
function copyFileOrDir(source: string, destination: string): void {
  const stat = fs.statSync(source);
  if (stat.isDirectory()) {
    fs.mkdirSync(destination, { recursive: true });
    const entries = fs.readdirSync(source);
    for (const entry of entries) {
      copyFileOrDir(path.join(source, entry), path.join(destination, entry));
    }
  } else {
    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(source, destination);
  }
}

/**
 * Execute a single copy rule
 */
export function executeCopyRule(
  rule: CopyRule,
  repoPath: string,
  worktreePath: string
): OperationResult {
  try {
    // Determine source path
    let sourcePath: string;
    if (rule.source.startsWith('/') || rule.source.startsWith('~/')) {
      // Absolute path
      sourcePath = expandPath(rule.source);
    } else {
      // Relative to main repo
      sourcePath = path.join(expandPath(repoPath), rule.source);
    }

    // Determine destination path
    const destRelative = rule.destination || rule.source;
    // If destination starts with ~/ or /, it's a mistake - always relative to worktree
    const destPath = destRelative.startsWith('/') || destRelative.startsWith('~/')
      ? path.join(expandPath(worktreePath), path.basename(destRelative))
      : path.join(expandPath(worktreePath), destRelative);

    // Check source exists
    if (!fs.existsSync(sourcePath)) {
      return {
        success: false,
        error: `Source not found: ${rule.source}`,
      };
    }

    // Ensure parent directory exists
    fs.mkdirSync(path.dirname(destPath), { recursive: true });

    // Execute based on mode
    if (rule.mode === 'symlink') {
      // Remove existing file/symlink if present
      if (fs.existsSync(destPath)) {
        fs.rmSync(destPath, { recursive: true });
      }
      fs.symlinkSync(sourcePath, destPath);
    } else {
      // Copy mode
      copyFileOrDir(sourcePath, destPath);
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to ${rule.mode} ${rule.source}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Execute a shell command in a directory
 */
export function executeCommand(
  command: string,
  cwd: string
): Promise<OperationResult<string>> {
  return new Promise((resolve) => {
    const expandedCwd = expandPath(cwd);
    const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
    const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command];

    const proc = spawn(shell, shellArgs, {
      cwd: expandedCwd,
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, data: stdout });
      } else {
        resolve({
          success: false,
          error: `Command failed with code ${code}: ${stderr || stdout}`,
        });
      }
    });

    proc.on('error', (error) => {
      resolve({
        success: false,
        error: `Failed to execute command: ${error.message}`,
      });
    });
  });
}

/**
 * Execute all worktree setup rules
 */
export async function executeWorktreeSetup(
  project: Project,
  worktreePath: string,
  onProgress?: (message: string) => void
): Promise<OperationResult<{ copyResults: string[]; commandResults: string[] }>> {
  const repoPath = project.path;
  const results = {
    copyResults: [] as string[],
    commandResults: [] as string[],
  };

  // Get merged setup from repo-level and project-level
  const repoSetup = readRepoSetup(repoPath);
  const mergedSetup = mergeSetups(repoSetup, project.worktreeSetup);

  // Execute copy rules
  if (mergedSetup.copyFiles && mergedSetup.copyFiles.length > 0) {
    for (const rule of mergedSetup.copyFiles) {
      onProgress?.(`${rule.mode === 'symlink' ? 'Linking' : 'Copying'} ${rule.source}...`);
      const result = executeCopyRule(rule, repoPath, worktreePath);
      if (result.success) {
        results.copyResults.push(`${rule.mode}: ${rule.source}`);
      } else {
        // Log warning but continue with other rules
        results.copyResults.push(`Failed: ${rule.source} - ${result.error}`);
      }
    }
  }

  // Execute post-create commands
  if (mergedSetup.postCreateCommands && mergedSetup.postCreateCommands.length > 0) {
    for (const command of mergedSetup.postCreateCommands) {
      onProgress?.(`Running: ${command}...`);
      const result = await executeCommand(command, worktreePath);
      if (result.success) {
        results.commandResults.push(`Success: ${command}`);
      } else {
        // Log warning but continue with other commands
        results.commandResults.push(`Failed: ${command} - ${result.error}`);
      }
    }
  }

  return {
    success: true,
    data: results,
  };
}

/**
 * Check if a project has any worktree setup configured
 */
export function hasWorktreeSetup(project: Project): boolean {
  const repoSetup = readRepoSetup(project.path);
  const projectSetup = project.worktreeSetup;

  return !!(
    (repoSetup?.copyFiles && repoSetup.copyFiles.length > 0) ||
    (repoSetup?.postCreateCommands && repoSetup.postCreateCommands.length > 0) ||
    (projectSetup?.copyFiles && projectSetup.copyFiles.length > 0) ||
    (projectSetup?.postCreateCommands && projectSetup.postCreateCommands.length > 0)
  );
}

/**
 * Get combined setup rules for display
 */
export function getCombinedSetup(project: Project): WorktreeSetup {
  const repoSetup = readRepoSetup(project.path);
  return mergeSetups(repoSetup, project.worktreeSetup);
}
