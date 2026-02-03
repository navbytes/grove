/**
 * Tests for config module
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  expandPath,
  generateBranchName,
  getGroveDir,
} from '../core/config';

describe('config', () => {
  describe('expandPath', () => {
    test('should expand ~ to home directory', () => {
      const result = expandPath('~/test');
      expect(result).toBe(path.join(os.homedir(), 'test'));
    });

    test('should handle ~ alone', () => {
      const result = expandPath('~');
      expect(result).toBe(os.homedir());
    });

    test('should not modify absolute paths', () => {
      const result = expandPath('/absolute/path');
      expect(result).toBe('/absolute/path');
    });

    test('should not modify relative paths without ~', () => {
      const result = expandPath('relative/path');
      expect(result).toBe('relative/path');
    });
  });

  describe('generateBranchName', () => {
    test('should generate branch name from template', () => {
      const result = generateBranchName(
        '{ticketId}-{slug}',
        'TASK-123',
        'Add user authentication'
      );
      expect(result).toBe('TASK-123-add-user-authentication');
    });

    test('should truncate long slugs', () => {
      const result = generateBranchName(
        '{ticketId}-{slug}',
        'TASK-123',
        'This is a very long title that should be truncated to fit within the maximum length',
        20
      );
      // Slug is truncated to 20 chars, trailing hyphens are removed
      expect(result).toBe('TASK-123-this-is-a-very-long-');
    });

    test('should handle special characters', () => {
      const result = generateBranchName(
        '{ticketId}-{slug}',
        'TASK-123',
        'Fix bug: handle @special #characters!'
      );
      // Default max slug length is 30, so truncated
      expect(result).toBe('TASK-123-fix-bug-handle-special-charact');
    });

    test('should handle empty title', () => {
      const result = generateBranchName('{ticketId}-{slug}', 'TASK-123', '');
      expect(result).toBe('TASK-123-');
    });

    test('should support {title} variable', () => {
      const result = generateBranchName(
        '{ticketId}/{title}',
        'TASK-123',
        'feature name'
      );
      expect(result).toBe('TASK-123/feature-name');
    });
  });

  describe('getGroveDir', () => {
    test('should return path to .grove in home directory', () => {
      const result = getGroveDir();
      expect(result).toBe(path.join(os.homedir(), '.grove'));
    });
  });
});
