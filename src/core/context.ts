import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { categoryDisplayName, groupLinksByCategory } from './links.js';
import { ensureDir, fileExists } from './store.js';
import type { OperationResult, Task } from './types.js';
import { CONTEXT_FILENAME } from './types.js';

export function getContextFilePath(workspaceDir: string, taskId: string): string {
  return join(workspaceDir, taskId, CONTEXT_FILENAME);
}

export async function readExistingNotes(contextFilePath: string): Promise<string> {
  if (!(await fileExists(contextFilePath))) {
    return '';
  }

  const content = await readFile(contextFilePath, 'utf-8');
  const notesMarker = '## Notes';
  const notesIndex = content.indexOf(notesMarker);
  if (notesIndex === -1) {
    return '';
  }

  // Return everything after the "## Notes" heading and its following line
  const afterMarker = content.slice(notesIndex + notesMarker.length);
  // Skip the <!-- comment --> line if present
  const lines = afterMarker.split('\n');
  const contentLines: string[] = [];
  let pastComment = false;

  for (const line of lines) {
    if (!pastComment) {
      if (line.trim() === '' || line.trim().startsWith('<!--')) {
        continue;
      }
      pastComment = true;
    }
    contentLines.push(line);
  }

  return contentLines.join('\n').trim();
}

export function generateContextContent(task: Task, existingNotes?: string): string {
  const lines: string[] = [];

  // Header
  lines.push(`# Task: ${task.id} — ${task.title}`);
  lines.push('');

  // Jira tickets
  if (task.jiraTickets.length > 0) {
    lines.push('## Jira Tickets');
    for (const ticket of task.jiraTickets) {
      if (task.jiraUrl) {
        lines.push(`- [${ticket}](${task.jiraUrl})`);
      } else {
        lines.push(`- ${ticket}`);
      }
    }
    lines.push('');
  }

  // Repositories & Branches
  if (task.projects.length > 0) {
    lines.push('## Repositories & Branches');
    lines.push('| Repo | Branch | Base Branch | PR | CI |');
    lines.push('|------|--------|-------------|----|----|');
    for (const p of task.projects) {
      const pr = p.pr ? `PR #${p.pr.number} (${p.pr.reviewStatus})` : '—';
      const ci = p.pr ? p.pr.ciStatus : '—';
      lines.push(`| ${p.name} | ${p.branch} | ${p.baseBranch} | ${pr} | ${ci} |`);
    }
    lines.push('');

    // PR Links
    const projectsWithPRs = task.projects.filter((p) => p.pr !== null);
    if (projectsWithPRs.length > 0) {
      lines.push('## PR Links');
      for (const p of projectsWithPRs) {
        lines.push(`- ${p.name}: ${p.pr?.url}`);
      }
      lines.push('');
    }
  }

  // Links
  if (task.links.length > 0) {
    lines.push('## Links');
    lines.push('');
    const grouped = groupLinksByCategory(task.links);
    for (const [category, categoryLinks] of grouped) {
      lines.push(`### ${categoryDisplayName(category)}`);
      for (const link of categoryLinks) {
        lines.push(`- [${link.label}](${link.url})`);
      }
      lines.push('');
    }
  }

  // Notes
  lines.push('## Notes');
  lines.push('<!-- Add your task notes below this line -->');
  if (existingNotes) {
    lines.push(existingNotes);
  }
  lines.push('');

  return lines.join('\n');
}

export async function writeContextFile(task: Task, workspaceDir: string): Promise<OperationResult> {
  const contextPath = getContextFilePath(workspaceDir, task.id);
  const taskDir = join(workspaceDir, task.id);

  await ensureDir(taskDir);

  // Preserve existing notes
  const existingNotes = await readExistingNotes(contextPath);
  const content = generateContextContent(task, existingNotes);

  await writeFile(contextPath, content, 'utf-8');
  return { success: true };
}
