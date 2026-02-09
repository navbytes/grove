import { describe, expect, test } from 'bun:test';
import { generateBranchName, getConfigValue, setConfigValue } from '../../core/config.js';
import { DEFAULT_CONFIG } from '../../core/types.js';

describe('getConfigValue', () => {
  test('gets top-level value', () => {
    expect(getConfigValue(DEFAULT_CONFIG, 'workspaceDir')).toBe(DEFAULT_CONFIG.workspaceDir);
  });

  test('gets nested value', () => {
    expect(getConfigValue(DEFAULT_CONFIG, 'notifications.prApproved')).toBe(true);
  });

  test('returns undefined for missing key', () => {
    expect(getConfigValue(DEFAULT_CONFIG, 'nonexistent')).toBeUndefined();
  });

  test('returns undefined for deep missing key', () => {
    expect(getConfigValue(DEFAULT_CONFIG, 'notifications.nonexistent')).toBeUndefined();
  });
});

describe('setConfigValue', () => {
  test('sets top-level string value', () => {
    const result = setConfigValue(DEFAULT_CONFIG, 'workspaceDir', '/tmp/test');
    expect(result.workspaceDir).toBe('/tmp/test');
  });

  test('sets nested value', () => {
    const result = setConfigValue(DEFAULT_CONFIG, 'notifications.prApproved', 'false');
    expect(result.notifications.prApproved).toBe(false);
  });

  test('sets numeric value', () => {
    const result = setConfigValue(DEFAULT_CONFIG, 'pollingInterval', '120');
    expect(result.pollingInterval).toBe(120);
  });

  test('does not mutate original config', () => {
    const original = structuredClone(DEFAULT_CONFIG);
    setConfigValue(DEFAULT_CONFIG, 'workspaceDir', '/changed');
    expect(DEFAULT_CONFIG.workspaceDir).toBe(original.workspaceDir);
  });

  test('creates intermediate objects if needed', () => {
    const config = { ...DEFAULT_CONFIG };
    const result = setConfigValue(config, 'jira.baseUrl', 'https://test.atlassian.net');
    expect(getConfigValue(result, 'jira.baseUrl')).toBe('https://test.atlassian.net');
  });
});

describe('generateBranchName', () => {
  test('replaces ticketId and slug', () => {
    const branch = generateBranchName('{ticketId}-{slug}', {
      ticketId: 'JIRA-123',
      slug: 'Add User Preferences',
      title: 'Add User Preferences',
    });
    expect(branch).toBe('JIRA-123-add-user-preferences');
  });

  test('replaces title variable', () => {
    const branch = generateBranchName('{ticketId}/{title}', {
      ticketId: 'JIRA-123',
      slug: 'test',
      title: 'my-feature',
    });
    expect(branch).toBe('JIRA-123/my-feature');
  });

  test('handles special characters in slug', () => {
    const branch = generateBranchName('{ticketId}-{slug}', {
      ticketId: 'PROJ-1',
      slug: 'Fix: the "bug" (urgent!)',
      title: 'Fix: the "bug" (urgent!)',
    });
    expect(branch).toBe('PROJ-1-fix-the-bug-urgent');
  });
});
