import { describe, expect, test } from 'bun:test';
import { categorizeUrl, categoryDisplayName, createLink, groupLinksByCategory } from '../../core/links.js';

describe('categorizeUrl', () => {
  test('categorizes Slack URLs', () => {
    expect(categorizeUrl('https://company.slack.com/archives/C01234/p123')).toBe('slack');
  });

  test('categorizes Buildkite URLs', () => {
    expect(categorizeUrl('https://buildkite.com/org/pipeline/builds/456')).toBe('buildkite');
  });

  test('categorizes GitHub URLs', () => {
    expect(categorizeUrl('https://github.com/org/repo/pull/123')).toBe('github');
  });

  test('categorizes Jira URLs (atlassian.net)', () => {
    expect(categorizeUrl('https://company.atlassian.net/browse/PROJ-123')).toBe('jira');
  });

  test('categorizes Figma URLs', () => {
    expect(categorizeUrl('https://figma.com/file/abc123')).toBe('figma');
  });

  test('categorizes Notion URLs', () => {
    expect(categorizeUrl('https://notion.so/some-page-id')).toBe('notion');
  });

  test('categorizes Google Docs URLs', () => {
    expect(categorizeUrl('https://docs.google.com/spreadsheets/d/abc')).toBe('google-docs');
  });

  test('categorizes Confluence URLs', () => {
    expect(categorizeUrl('https://company.confluence.com/wiki/page')).toBe('confluence');
  });

  test('categorizes unknown URLs as misc', () => {
    expect(categorizeUrl('https://random-site.com/page')).toBe('misc');
  });
});

describe('createLink', () => {
  test('creates a link with auto-categorization', () => {
    const link = createLink('https://company.slack.com/archives/C01234', 'Design discussion');
    expect(link.label).toBe('Design discussion');
    expect(link.url).toBe('https://company.slack.com/archives/C01234');
    expect(link.category).toBe('slack');
  });
});

describe('groupLinksByCategory', () => {
  test('groups links by their category', () => {
    const links = [
      createLink('https://company.slack.com/1', 'Slack 1'),
      createLink('https://buildkite.com/1', 'BK 1'),
      createLink('https://company.slack.com/2', 'Slack 2'),
    ];

    const grouped = groupLinksByCategory(links);
    expect(grouped.get('slack')?.length).toBe(2);
    expect(grouped.get('buildkite')?.length).toBe(1);
    expect(grouped.has('misc')).toBe(false);
  });

  test('handles empty links', () => {
    const grouped = groupLinksByCategory([]);
    expect(grouped.size).toBe(0);
  });
});

describe('categoryDisplayName', () => {
  test('returns proper display names', () => {
    expect(categoryDisplayName('slack')).toBe('Slack');
    expect(categoryDisplayName('buildkite')).toBe('Buildkite');
    expect(categoryDisplayName('github')).toBe('GitHub');
    expect(categoryDisplayName('google-docs')).toBe('Google Docs');
    expect(categoryDisplayName('misc')).toBe('Misc');
  });
});
