import { beforeEach, describe, expect, test } from 'bun:test';
import { execSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectDefaultBranch, detectRepoName } from '../../core/projects.js';

let testDir: string;
let testRepoDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'grove-projects-test-'));
  testRepoDir = join(testDir, 'test-repo');

  // Create a minimal git repo
  execSync(`mkdir -p ${testRepoDir} && cd ${testRepoDir} && git init -b main && git commit --allow-empty -m "init"`, {
    stdio: 'ignore',
  });
});

describe('detectRepoName', () => {
  test('falls back to directory name when no remote', async () => {
    const name = await detectRepoName(testRepoDir);
    expect(name).toBe('test-repo');
  });
});

describe('detectDefaultBranch', () => {
  test('detects main branch', async () => {
    const branch = await detectDefaultBranch(testRepoDir);
    expect(branch).toBe('main');
  });
});

describe('links test', () => {
  test('categorizeUrl is re-exported from links', async () => {
    const { categorizeUrl } = await import('../../core/links.js');
    expect(categorizeUrl('https://company.slack.com/archives/C01234')).toBe('slack');
    expect(categorizeUrl('https://buildkite.com/org/pipeline')).toBe('buildkite');
    expect(categorizeUrl('https://github.com/org/repo')).toBe('github');
    expect(categorizeUrl('https://company.atlassian.net/browse/PROJ-123')).toBe('jira');
    expect(categorizeUrl('https://figma.com/file/abc')).toBe('figma');
    expect(categorizeUrl('https://notion.so/page')).toBe('notion');
    expect(categorizeUrl('https://docs.google.com/spreadsheets/d/abc')).toBe('google-docs');
    expect(categorizeUrl('https://random-site.com/page')).toBe('misc');
  });
});
