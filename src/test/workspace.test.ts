/**
 * Tests for workspace module
 */

import { describe, expect, test } from 'bun:test';
import { createWorkspaceContent } from '../core/workspace';
import { Task } from '../core/types';

describe('workspace', () => {
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
        pr: null,
      },
      {
        name: 'web-ui',
        repoPath: '/repos/web-ui',
        worktreePath: '/workspaces/TASK-200/web-ui',
        branch: 'TASK-200-add-user-preferences',
        baseBranch: 'main',
        pr: null,
      },
    ],
    workspaceFile: '/workspaces/TASK-200/TASK-200.code-workspace',
    notes: '',
    slackThreads: [],
  };

  describe('createWorkspaceContent', () => {
    test('should create workspace with folders', () => {
      const content = createWorkspaceContent(mockTask);

      expect(content.folders).toHaveLength(2);
      expect(content.folders[0].name).toBe('backend-api (TASK-200)');
      expect(content.folders[0].path).toBe('/workspaces/TASK-200/backend-api');
      expect(content.folders[1].name).toBe('web-ui (TASK-200)');
      expect(content.folders[1].path).toBe('/workspaces/TASK-200/web-ui');
    });

    test('should include task ID in settings', () => {
      const content = createWorkspaceContent(mockTask);

      expect(content.settings).toBeDefined();
      expect(content.settings['grove.taskId']).toBe('TASK-200');
    });

    test('should handle empty projects', () => {
      const emptyTask: Task = {
        ...mockTask,
        projects: [],
      };

      const content = createWorkspaceContent(emptyTask);
      expect(content.folders).toHaveLength(0);
    });
  });
});
