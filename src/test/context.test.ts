/**
 * Tests for context module
 */

import { describe, expect, test } from 'bun:test';
import { createContextContent, extractNotes } from '../core/context';
import { Task } from '../core/types';

describe('context', () => {
  const mockTask: Task = {
    id: 'TASK-200',
    title: 'Add user preferences',
    jiraUrl: 'https://company.atlassian.net/browse/TASK-200',
    jiraTickets: ['TASK-200'],
    status: 'active',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    projects: [
      {
        name: 'backend-api',
        repoPath: '/repos/backend-api',
        worktreePath: '/workspaces/TASK-200/backend-api',
        branch: 'TASK-200-add-user-preferences',
        baseBranch: 'main',
        prs: [
          {
            number: 145,
            url: 'https://github.com/org/backend-api/pull/145',
            status: 'open',
            reviewStatus: 'approved',
            ciStatus: 'passed',
          },
        ],
      },
      {
        name: 'web-ui',
        repoPath: '/repos/web-ui',
        worktreePath: '/workspaces/TASK-200/web-ui',
        branch: 'TASK-200-add-user-preferences',
        baseBranch: 'main',
        prs: [],
      },
    ],
    workspaceFile: '/workspaces/TASK-200/TASK-200.code-workspace',
    notes: '',
    slackThreads: [
      {
        url: 'https://company.slack.com/archives/C123/p456',
        title: 'Discussion thread',
        addedAt: '2024-01-01T00:00:00Z',
      },
    ],
    links: [],
  };

  describe('createContextContent', () => {
    test('should generate context with task header', () => {
      const content = createContextContent(mockTask);
      expect(content).toContain('# Task: TASK-200 — Add user preferences');
    });

    test('should include Jira tickets section', () => {
      const content = createContextContent(mockTask);
      expect(content).toContain('## Jira Tickets');
      expect(content).toContain('[TASK-200](https://company.atlassian.net/browse/TASK-200)');
    });

    test('should include Slack threads section', () => {
      const content = createContextContent(mockTask);
      expect(content).toContain('## Slack Threads');
      expect(content).toContain('[Discussion thread](https://company.slack.com/archives/C123/p456)');
    });

    test('should include repositories table', () => {
      const content = createContextContent(mockTask);
      expect(content).toContain('## Repositories & Branches');
      expect(content).toContain('| Repo | Branch | Base Branch | PR | CI |');
      expect(content).toContain('backend-api');
      expect(content).toContain('web-ui');
    });

    test('should include PR links section', () => {
      const content = createContextContent(mockTask);
      expect(content).toContain('## PR Links');
      expect(content).toContain('backend-api: https://github.com/org/backend-api/pull/145');
    });

    test('should include Notes section', () => {
      const content = createContextContent(mockTask);
      expect(content).toContain('## Notes');
      expect(content).toContain('<!-- Add your task notes below this line -->');
    });

    test('should preserve existing notes', () => {
      const content = createContextContent(mockTask, 'My existing notes');
      expect(content).toContain('My existing notes');
    });
  });

  describe('extractNotes', () => {
    test('should extract notes from content', () => {
      const content = `# Task
## Notes
<!-- Add your task notes below this line -->

These are my notes`;

      const notes = extractNotes(content);
      expect(notes).toBe('These are my notes');
    });

    test('should return empty string if no notes section', () => {
      const content = '# Task\n## Other section';
      const notes = extractNotes(content);
      expect(notes).toBe('');
    });

    test('should handle empty notes section', () => {
      const content = `# Task
## Notes
<!-- Add your task notes below this line -->`;

      const notes = extractNotes(content);
      expect(notes).toBe('');
    });
  });
});
