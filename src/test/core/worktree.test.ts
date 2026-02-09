import { beforeEach, describe, expect, test } from 'bun:test';
import { execSync } from 'node:child_process';
import { mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { branchExists, createWorktree, execGit, listWorktrees, removeWorktree } from '../../core/worktree.js';

let testDir: string;
let repoDir: string;

beforeEach(async () => {
  // Resolve symlinks (macOS /tmp -> /private/tmp) so paths match git output
  testDir = await realpath(await mkdtemp(join(tmpdir(), 'grove-worktree-test-')));
  repoDir = join(testDir, 'repo');

  // Create a bare-bones git repo with at least one commit
  execSync(`mkdir -p ${repoDir} && cd ${repoDir} && git init -b main && git commit --allow-empty -m "init"`, {
    stdio: 'ignore',
  });
});

describe('execGit', () => {
  test('runs a git command successfully', async () => {
    const result = await execGit(['rev-parse', '--is-inside-work-tree'], repoDir);
    expect(result.success).toBe(true);
    expect(result.data).toBe('true');
  });

  test('returns error for invalid command', async () => {
    const result = await execGit(['not-a-command'], repoDir);
    expect(result.success).toBe(false);
  });
});

describe('branchExists', () => {
  test('returns true for existing branch', async () => {
    expect(await branchExists(repoDir, 'main')).toBe(true);
  });

  test('returns false for non-existent branch', async () => {
    expect(await branchExists(repoDir, 'nonexistent-branch')).toBe(false);
  });
});

describe('createWorktree / removeWorktree', () => {
  test('creates and removes a worktree', async () => {
    const worktreePath = join(testDir, 'wt-feature');

    const createResult = await createWorktree({
      repoPath: repoDir,
      worktreePath,
      branch: 'feature-branch',
      baseBranch: 'main',
    });
    expect(createResult.success).toBe(true);
    expect(createResult.data).toBe(worktreePath);

    // Branch should now exist
    expect(await branchExists(repoDir, 'feature-branch')).toBe(true);

    // Should appear in worktree list
    const listResult = await listWorktrees(repoDir);
    expect(listResult.success).toBe(true);
    expect(listResult.data?.some((wt) => wt.path === worktreePath)).toBe(true);

    // Remove it
    const removeResult = await removeWorktree({
      repoPath: repoDir,
      worktreePath,
    });
    expect(removeResult.success).toBe(true);
  });

  test('fails when worktree path already exists', async () => {
    const worktreePath = join(testDir, 'wt-dup');

    await createWorktree({
      repoPath: repoDir,
      worktreePath,
      branch: 'dup-branch',
      baseBranch: 'main',
    });

    // Try to create again at the same path
    const result = await createWorktree({
      repoPath: repoDir,
      worktreePath,
      branch: 'dup-branch-2',
      baseBranch: 'main',
    });
    expect(result.success).toBe(false);
  });
});

describe('listWorktrees', () => {
  test('lists the main worktree', async () => {
    const result = await listWorktrees(repoDir);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.length).toBeGreaterThanOrEqual(1);
    expect(result.data?.[0]?.branch).toBe('main');
  });
});
