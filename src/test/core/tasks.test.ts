import { beforeEach, describe, expect, test } from 'bun:test';
import { execSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeJsonFile } from '../../core/store.js';

// We import lazily to let test setup override GROVE_DIR
let _tasksModule: typeof import('../../core/tasks.js');
let testDir: string;
let repoDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'grove-tasks-test-'));
  repoDir = join(testDir, 'repo');

  // Create a git repo
  execSync(`mkdir -p ${repoDir} && cd ${repoDir} && git init -b main && git commit --allow-empty -m "init"`, {
    stdio: 'ignore',
  });

  // Write a tasks file
  await writeJsonFile(join(testDir, 'tasks.json'), []);

  // Write a config file
  await writeJsonFile(join(testDir, 'config.json'), {
    workspaceDir: join(testDir, 'workspaces'),
  });
});

// Note: These tests exercise the function logic through the core module.
// They are intentionally higher-level than unit tests because tasks.ts
// orchestrates worktree and store operations.

describe('tasks module structure', () => {
  test('exports expected functions', async () => {
    const tasks = await import('../../core/tasks.js');
    expect(typeof tasks.loadTasks).toBe('function');
    expect(typeof tasks.saveTasks).toBe('function');
    expect(typeof tasks.createTask).toBe('function');
    expect(typeof tasks.findTask).toBe('function');
    expect(typeof tasks.addProjectToTask).toBe('function');
    expect(typeof tasks.removeProjectFromTask).toBe('function');
    expect(typeof tasks.archiveTask).toBe('function');
    expect(typeof tasks.deleteTask).toBe('function');
    expect(typeof tasks.addLinkToTask).toBe('function');
    expect(typeof tasks.removeLinkFromTask).toBe('function');
    expect(typeof tasks.detectCurrentTask).toBe('function');
    expect(typeof tasks.getTaskWorkspacePath).toBe('function');
  });

  test('getTaskWorkspacePath returns expected path', async () => {
    const tasks = await import('../../core/tasks.js');
    const result = tasks.getTaskWorkspacePath('/home/user/workspaces', 'TASK-100');
    expect(result).toBe('/home/user/workspaces/TASK-100');
  });
});
