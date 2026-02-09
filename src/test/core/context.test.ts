import { beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateContextContent, readExistingNotes } from '../../core/context.js';
import type { Task } from '../../core/types.js';

const makeTask = (overrides?: Partial<Task>): Task => ({
  id: 'TASK-100',
  title: 'Test task',
  jiraUrl: 'https://company.atlassian.net/browse/TASK-100',
  jiraTickets: ['TASK-100'],
  status: 'active',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  projects: [
    {
      name: 'backend-api',
      repoPath: '/repos/backend-api',
      worktreePath: '/workspaces/TASK-100/backend-api',
      branch: 'TASK-100-test-task',
      baseBranch: 'main',
      pr: null,
    },
  ],
  links: [],
  notes: '',
  ...overrides,
});

describe('generateContextContent', () => {
  test('generates basic content', () => {
    const content = generateContextContent(makeTask());
    expect(content).toContain('# Task: TASK-100 — Test task');
    expect(content).toContain('## Jira Tickets');
    expect(content).toContain('[TASK-100]');
    expect(content).toContain('## Repositories & Branches');
    expect(content).toContain('backend-api');
    expect(content).toContain('## Notes');
  });

  test('includes PR links when present', () => {
    const task = makeTask({
      projects: [
        {
          name: 'backend',
          repoPath: '/repos/backend',
          worktreePath: '/ws/TASK-100/backend',
          branch: 'TASK-100-test',
          baseBranch: 'main',
          pr: {
            number: 42,
            url: 'https://github.com/org/backend/pull/42',
            status: 'open',
            reviewStatus: 'pending',
            ciStatus: 'passed',
          },
        },
      ],
    });
    const content = generateContextContent(task);
    expect(content).toContain('## PR Links');
    expect(content).toContain('https://github.com/org/backend/pull/42');
  });

  test('includes links grouped by category', () => {
    const task = makeTask({
      links: [
        { label: 'Chat', url: 'https://slack.com/1', category: 'slack' },
        { label: 'Build', url: 'https://buildkite.com/1', category: 'buildkite' },
      ],
    });
    const content = generateContextContent(task);
    expect(content).toContain('## Links');
    expect(content).toContain('### Slack');
    expect(content).toContain('### Buildkite');
  });

  test('preserves existing notes', () => {
    const content = generateContextContent(makeTask(), 'My important note\nAnother line');
    expect(content).toContain('My important note');
    expect(content).toContain('Another line');
  });
});

describe('readExistingNotes', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = await mkdtemp(join(tmpdir(), 'grove-context-test-'));
  });

  test('returns empty string for non-existent file', async () => {
    const notes = await readExistingNotes(join(testDir, 'nonexistent.md'));
    expect(notes).toBe('');
  });

  test('extracts notes from existing file', async () => {
    const filePath = join(testDir, 'context.md');
    await writeFile(
      filePath,
      '# Task: X\n\n## Notes\n<!-- Add your task notes below this line -->\nMy note here\nSecond line\n',
    );
    const notes = await readExistingNotes(filePath);
    expect(notes).toContain('My note here');
    expect(notes).toContain('Second line');
  });

  test('returns empty string when no notes section', async () => {
    const filePath = join(testDir, 'no-notes.md');
    await writeFile(filePath, '# Task: X\n\n## Repos\n- backend\n');
    const notes = await readExistingNotes(filePath);
    expect(notes).toBe('');
  });
});
