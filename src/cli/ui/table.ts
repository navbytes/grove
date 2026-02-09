import Table from 'cli-table3';
import pc from 'picocolors';
import { categoryDisplayName, groupLinksByCategory } from '../../core/links.js';
import type { Project, Task, TaskLink } from '../../core/types.js';

export function renderProjectTable(projects: Project[]): string {
  const table = new Table({
    head: [pc.dim('Name'), pc.dim('Path'), pc.dim('Default Branch')],
    style: { head: [], border: [], compact: true },
    chars: {
      top: '',
      'top-mid': '',
      'top-left': '',
      'top-right': '',
      bottom: '',
      'bottom-mid': '',
      'bottom-left': '',
      'bottom-right': '',
      left: '  ',
      'left-mid': '',
      mid: '',
      'mid-mid': '',
      right: '',
      'right-mid': '',
      middle: '  ',
    },
  });

  for (const p of projects) {
    const path = p.path.replace(process.env.HOME || '', '~');
    table.push([pc.magenta(p.name), pc.dim(path), p.defaultBaseBranch]);
  }

  return table.toString();
}

export function renderTaskListTable(tasks: Task[]): string {
  const table = new Table({
    head: [pc.dim('ID'), pc.dim('Title'), pc.dim('Projects'), pc.dim('PRs'), pc.dim('Status')],
    style: { head: [], border: [], compact: true },
    chars: {
      top: '',
      'top-mid': '',
      'top-left': '',
      'top-right': '',
      bottom: '',
      'bottom-mid': '',
      'bottom-left': '',
      'bottom-right': '',
      left: '  ',
      'left-mid': '',
      mid: '',
      'mid-mid': '',
      right: '',
      'right-mid': '',
      middle: '  ',
    },
  });

  for (const t of tasks) {
    const prCount = t.projects.filter((p) => p.pr !== null).length;
    const totalProjects = t.projects.length;
    const statusColor = t.status === 'active' ? pc.green : pc.dim;
    table.push([
      pc.bold(pc.cyan(t.id)),
      t.title.length > 35 ? `${t.title.slice(0, 32)}...` : t.title,
      String(totalProjects),
      `${prCount}/${totalProjects}`,
      statusColor(t.status),
    ]);
  }

  return table.toString();
}

export function renderTaskStatusTable(task: Task): string {
  const table = new Table({
    head: [pc.dim('Project'), pc.dim('Branch'), pc.dim('PR'), pc.dim('Review'), pc.dim('CI')],
    style: { head: [], border: [], compact: true },
    chars: {
      top: '',
      'top-mid': '',
      'top-left': '',
      'top-right': '',
      bottom: '',
      'bottom-mid': '',
      'bottom-left': '',
      'bottom-right': '',
      left: '  ',
      'left-mid': '',
      mid: '',
      'mid-mid': '',
      right: '',
      'right-mid': '',
      middle: '  ',
    },
  });

  for (const p of task.projects) {
    const branchDisplay = p.branch.length > 30 ? `${p.branch.slice(0, 27)}...` : p.branch;
    const prDisplay = p.pr ? `#${p.pr.number}` : '—';
    const reviewDisplay = p.pr ? p.pr.reviewStatus : '—';
    const ciDisplay = p.pr ? p.pr.ciStatus : '—';
    table.push([pc.magenta(p.name), pc.dim(branchDisplay), prDisplay, reviewDisplay, ciDisplay]);
  }

  return table.toString();
}

export function renderLinksTable(links: TaskLink[]): string {
  if (links.length === 0) {
    return pc.dim('  No links.');
  }

  const grouped = groupLinksByCategory(links);
  const lines: string[] = [];
  let index = 1;

  for (const [category, categoryLinks] of grouped) {
    lines.push(`  ${pc.bold(categoryDisplayName(category))}:`);
    for (const link of categoryLinks) {
      lines.push(`    ${pc.dim(`${index}.`)} ${link.label}`);
      lines.push(`       ${pc.dim(link.url)}`);
      index++;
    }
  }

  return lines.join('\n');
}
