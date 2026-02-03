/**
 * Tests for projects module
 */

import { describe, expect, test } from 'bun:test';
import { extractRepoName, extractRepoOwner } from '../core/projects';

describe('projects', () => {
  describe('extractRepoName', () => {
    test('should extract repo name from SSH URL', () => {
      const result = extractRepoName('git@github.com:company-org/backend-api.git');
      expect(result).toBe('backend-api');
    });

    test('should extract repo name from HTTPS URL', () => {
      const result = extractRepoName('https://github.com/company-org/backend-api.git');
      expect(result).toBe('backend-api');
    });

    test('should extract repo name from URL without .git suffix', () => {
      const result = extractRepoName('https://github.com/company-org/backend-api');
      expect(result).toBe('backend-api');
    });

    test('should return null for invalid URL', () => {
      const result = extractRepoName('invalid-url');
      expect(result).toBeNull();
    });
  });

  describe('extractRepoOwner', () => {
    test('should extract owner from SSH URL', () => {
      const result = extractRepoOwner('git@github.com:company-org/backend-api.git');
      expect(result).toBe('company-org');
    });

    test('should extract owner from HTTPS URL', () => {
      const result = extractRepoOwner('https://github.com/company-org/backend-api.git');
      expect(result).toBe('company-org');
    });

    test('should return null for invalid URL', () => {
      const result = extractRepoOwner('invalid-url');
      expect(result).toBeNull();
    });
  });
});
