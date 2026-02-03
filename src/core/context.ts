/**
 * Context file (.grove-context.md) generation for Grove
 * This file provides context for AI tools like Claude Code CLI
 */

import * as fs from 'fs';
import * as path from 'path';
import { Task, TaskProject, GROVE_PATHS, OperationResult } from './types';
import { getTaskDir } from './config';

const NOTES_MARKER = '## Notes';
const NOTES_COMMENT = '<!-- Add your task notes below this line -->';

/**
 * Get the context file path for a task
 */
export function getContextFilePath(taskId: string): string {
  const taskDir = getTaskDir(taskId);
  return path.join(taskDir, GROVE_PATHS.CONTEXT_FILE);
}

/**
 * Format PR status for display (shows first/primary PR, with count if multiple)
 */
function formatPRStatus(project: TaskProject): string {
  if (project.prs.length === 0) {
    return '—';
  }

  // Show primary PR (first one, typically most recent open PR)
  const pr = project.prs[0];
  const { number, status, reviewStatus } = pr;
  let statusText = `PR #${number}`;

  if (status === 'merged') {
    statusText += ' (merged)';
  } else if (status === 'closed') {
    statusText += ' (closed)';
  } else if (status === 'draft') {
    statusText += ' (draft)';
  } else {
    // Open PR - show review status
    switch (reviewStatus) {
      case 'approved':
        statusText += ' (approved)';
        break;
      case 'changes_requested':
        statusText += ' (changes requested)';
        break;
      case 'commented':
        statusText += ' (reviewing)';
        break;
      default:
        statusText += ' (pending review)';
    }
  }

  // Indicate if there are more PRs
  if (project.prs.length > 1) {
    statusText += ` (+${project.prs.length - 1} more)`;
  }

  return statusText;
}

/**
 * Format CI status for display (shows primary PR's CI status)
 */
function formatCIStatus(project: TaskProject): string {
  if (project.prs.length === 0) {
    return '—';
  }

  // Show CI status of primary PR
  switch (project.prs[0].ciStatus) {
    case 'passed':
      return 'passed';
    case 'failed':
      return 'failed';
    case 'running':
      return 'running';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'pending';
  }
}

/**
 * Get human-readable label for link type
 */
function getLinkTypeLabel(type: string): string {
  switch (type) {
    case 'confluence':
      return 'Confluence';
    case 'notion':
      return 'Notion';
    case 'google-docs':
      return 'Google Docs';
    case 'figma':
      return 'Figma';
    default:
      return 'Link';
  }
}

/**
 * Generate the context file content
 */
export function createContextContent(task: Task, existingNotes?: string): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Task: ${task.id} — ${task.title}`);
  lines.push('');

  // Jira Tickets
  if (task.jiraTickets.length > 0) {
    lines.push('## Jira Tickets');
    for (const ticket of task.jiraTickets) {
      if (task.jiraUrl) {
        // Extract base URL and construct ticket URL
        const baseUrl = task.jiraUrl.replace(/\/browse\/.*$/, '');
        lines.push(`- [${ticket}](${baseUrl}/browse/${ticket})`);
      } else {
        lines.push(`- ${ticket}`);
      }
    }
    lines.push('');
  }

  // Slack Threads
  if (task.slackThreads.length > 0) {
    lines.push('## Slack Threads');
    for (const thread of task.slackThreads) {
      if (thread.title) {
        lines.push(`- [${thread.title}](${thread.url})`);
      } else {
        lines.push(`- ${thread.url}`);
      }
    }
    lines.push('');
  }

  // Links (Confluence, Notion, etc.)
  if (task.links && task.links.length > 0) {
    lines.push('## Related Links');
    for (const link of task.links) {
      const typeLabel = getLinkTypeLabel(link.type);
      if (link.title) {
        lines.push(`- [${link.title}](${link.url}) (${typeLabel})`);
      } else {
        lines.push(`- ${link.url} (${typeLabel})`);
      }
    }
    lines.push('');
  }

  // Repositories & Branches table
  lines.push('## Repositories & Branches');
  lines.push('| Repo | Branch | Base Branch | PR | CI |');
  lines.push('|------|--------|-------------|----|----|');

  for (const project of task.projects) {
    const prStatus = formatPRStatus(project);
    const ciStatus = formatCIStatus(project);
    lines.push(
      `| ${project.name} | ${project.branch} | ${project.baseBranch} | ${prStatus} | ${ciStatus} |`
    );
  }
  lines.push('');

  // PR Links
  const projectsWithPRs = task.projects.filter((p) => p.prs.length > 0);
  if (projectsWithPRs.length > 0) {
    lines.push('## PR Links');
    for (const project of projectsWithPRs) {
      for (const pr of project.prs) {
        const statusLabel = pr.status === 'open' ? '' : ` (${pr.status})`;
        lines.push(`- ${project.name}: ${pr.url}${statusLabel}`);
      }
    }
    lines.push('');
  }

  // Notes section
  lines.push(NOTES_MARKER);
  lines.push(NOTES_COMMENT);

  // Add existing notes if present
  if (existingNotes) {
    lines.push('');
    lines.push(existingNotes);
  }

  return lines.join('\n');
}

/**
 * Extract notes from existing context file content
 */
export function extractNotes(content: string): string {
  const notesIndex = content.indexOf(NOTES_MARKER);
  if (notesIndex === -1) {
    return '';
  }

  // Get everything after the notes marker and comment
  let notesContent = content.slice(notesIndex + NOTES_MARKER.length);

  // Remove the comment line if present
  const commentIndex = notesContent.indexOf(NOTES_COMMENT);
  if (commentIndex !== -1) {
    notesContent = notesContent.slice(commentIndex + NOTES_COMMENT.length);
  }

  return notesContent.trim();
}

/**
 * Preserve notes from existing context file
 */
export function preserveNotes(taskId: string): string {
  const contextPath = getContextFilePath(taskId);

  if (!fs.existsSync(contextPath)) {
    return '';
  }

  try {
    const content = fs.readFileSync(contextPath, 'utf-8');
    return extractNotes(content);
  } catch {
    return '';
  }
}

/**
 * Generate and write the context file for a task
 */
export function generateContextFile(task: Task): OperationResult {
  try {
    // Preserve existing notes
    const existingNotes = preserveNotes(task.id);

    const content = createContextContent(task, existingNotes);
    const contextPath = getContextFilePath(task.id);

    // Ensure the task directory exists
    const taskDir = path.dirname(contextPath);
    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true });
    }

    fs.writeFileSync(contextPath, content, 'utf-8');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to generate context file: ${error}`,
    };
  }
}

/**
 * Read an existing context file
 */
export function readContextFile(taskId: string): OperationResult<string> {
  try {
    const contextPath = getContextFilePath(taskId);

    if (!fs.existsSync(contextPath)) {
      return { success: false, error: 'Context file does not exist' };
    }

    const content = fs.readFileSync(contextPath, 'utf-8');
    return { success: true, data: content };
  } catch (error) {
    return {
      success: false,
      error: `Failed to read context file: ${error}`,
    };
  }
}

/**
 * Update notes in context file
 */
export function updateNotes(taskId: string, notes: string): OperationResult {
  try {
    const contextPath = getContextFilePath(taskId);

    if (!fs.existsSync(contextPath)) {
      return { success: false, error: 'Context file does not exist' };
    }

    const content = fs.readFileSync(contextPath, 'utf-8');

    // Find the notes section and replace it
    const notesIndex = content.indexOf(NOTES_MARKER);
    if (notesIndex === -1) {
      return { success: false, error: 'Notes section not found in context file' };
    }

    const beforeNotes = content.slice(0, notesIndex);
    const newContent = `${beforeNotes}${NOTES_MARKER}\n${NOTES_COMMENT}\n\n${notes}`;

    fs.writeFileSync(contextPath, newContent, 'utf-8');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to update notes: ${error}`,
    };
  }
}
