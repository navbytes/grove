import type { LinkCategory, TaskLink } from './types.js';

interface UrlPattern {
  pattern: RegExp;
  category: LinkCategory;
}

const URL_PATTERNS: UrlPattern[] = [
  { pattern: /slack\.com/i, category: 'slack' },
  { pattern: /buildkite\.com/i, category: 'buildkite' },
  { pattern: /github\.com/i, category: 'github' },
  { pattern: /atlassian\.net/i, category: 'jira' },
  { pattern: /jira\./i, category: 'jira' },
  { pattern: /confluence/i, category: 'confluence' },
  { pattern: /figma\.com/i, category: 'figma' },
  { pattern: /notion\.so/i, category: 'notion' },
  { pattern: /docs\.google\.com/i, category: 'google-docs' },
];

export function categorizeUrl(url: string): LinkCategory {
  for (const { pattern, category } of URL_PATTERNS) {
    if (pattern.test(url)) {
      return category;
    }
  }
  return 'misc';
}

export function createLink(url: string, label: string): TaskLink {
  return {
    label,
    url,
    category: categorizeUrl(url),
  };
}

export function groupLinksByCategory(links: TaskLink[]): Map<LinkCategory, TaskLink[]> {
  const grouped = new Map<LinkCategory, TaskLink[]>();
  for (const link of links) {
    const existing = grouped.get(link.category);
    if (existing) {
      existing.push(link);
    } else {
      grouped.set(link.category, [link]);
    }
  }
  return grouped;
}

const CATEGORY_DISPLAY_NAMES: Record<LinkCategory, string> = {
  slack: 'Slack',
  buildkite: 'Buildkite',
  github: 'GitHub',
  jira: 'Jira',
  confluence: 'Confluence',
  figma: 'Figma',
  notion: 'Notion',
  'google-docs': 'Google Docs',
  misc: 'Misc',
};

export function categoryDisplayName(category: LinkCategory): string {
  return CATEGORY_DISPLAY_NAMES[category];
}
