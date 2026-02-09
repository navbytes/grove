import * as vscode from 'vscode';
import type { Task } from '../../core/types.js';
import { categoryDisplayName } from '../../core/links.js';

export class TaskDetailPanel {
  public static currentPanel: TaskDetailPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  private constructor(panel: vscode.WebviewPanel) {
    this.panel = panel;

    this.panel.webview.onDidReceiveMessage(
      async (message: { command: string; url?: string; taskId?: string }) => {
        switch (message.command) {
          case 'openExternal':
            if (message.url) {
              vscode.env.openExternal(vscode.Uri.parse(message.url));
            }
            break;
          case 'openNotes':
            if (message.taskId) {
              vscode.commands.executeCommand('grove.notes.open', { task: { id: message.taskId } });
            }
            break;
        }
      },
      null,
      this.disposables,
    );

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  public static createOrShow(task?: Task): void {
    if (TaskDetailPanel.currentPanel) {
      TaskDetailPanel.currentPanel.panel.reveal(vscode.ViewColumn.Beside);
      if (task) {
        TaskDetailPanel.currentPanel.update(task);
      }
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'groveTaskDetail',
      task ? `Grove: ${task.id}` : 'Grove Dashboard',
      vscode.ViewColumn.Beside,
      { enableScripts: true, retainContextWhenHidden: true },
    );

    TaskDetailPanel.currentPanel = new TaskDetailPanel(panel);
    if (task) {
      TaskDetailPanel.currentPanel.update(task);
    }
  }

  public update(task: Task): void {
    this.panel.title = `Grove: ${task.id}`;
    this.panel.webview.html = this.getHtml(task);
  }

  private getHtml(task: Task): string {
    const projectRows = task.projects
      .map((p) => {
        const prCell = p.pr
          ? `<a href="#" onclick="openUrl('${p.pr.url}')">PR #${p.pr.number}</a>`
          : '<span class="dim">—</span>';
        const reviewCell = p.pr ? statusBadge(p.pr.reviewStatus, reviewLabel(p.pr.reviewStatus)) : '<span class="dim">—</span>';
        const ciCell = p.pr ? statusBadge(p.pr.ciStatus, ciLabel(p.pr.ciStatus)) : '<span class="dim">—</span>';
        return `<tr>
          <td><strong>${esc(p.name)}</strong></td>
          <td><code>${esc(p.branch)}</code></td>
          <td>${prCell}</td>
          <td>${reviewCell}</td>
          <td>${ciCell}</td>
        </tr>`;
      })
      .join('');

    const linksHtml =
      task.links.length > 0
        ? task.links
            .map(
              (l) =>
                `<li><a href="#" onclick="openUrl('${esc(l.url)}')">${esc(l.label)}</a> <span class="dim">(${esc(categoryDisplayName(l.category))})</span></li>`,
            )
            .join('')
        : '<li class="dim">No links</li>';

    const jiraHtml = task.jiraUrl
      ? `<a href="#" onclick="openUrl('${esc(task.jiraUrl)}')">${esc(task.jiraTickets.join(', '))}</a>`
      : task.jiraTickets.join(', ') || '<span class="dim">None</span>';

    const firstNoteLine = task.notes ? task.notes.split('\n')[0] ?? '' : '';
    const notesPreview = firstNoteLine
      ? `<p>${esc(firstNoteLine.slice(0, 100))}</p>`
      : '<p class="dim">No notes</p>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    background: var(--vscode-editor-background);
    padding: 16px;
    line-height: 1.5;
  }
  h1 { font-size: 1.4em; margin: 0 0 4px; }
  h2 { font-size: 1.1em; margin: 20px 0 8px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 4px; }
  .subtitle { color: var(--vscode-descriptionForeground); margin: 0 0 16px; }
  table { border-collapse: collapse; width: 100%; margin: 8px 0; }
  th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid var(--vscode-panel-border); }
  th { color: var(--vscode-descriptionForeground); font-weight: 600; font-size: 0.9em; }
  code { background: var(--vscode-textCodeBlock-background); padding: 2px 5px; border-radius: 3px; font-size: 0.9em; }
  a { color: var(--vscode-textLink-foreground); text-decoration: none; cursor: pointer; }
  a:hover { text-decoration: underline; }
  ul { padding-left: 20px; }
  li { margin: 4px 0; }
  .dim { color: var(--vscode-descriptionForeground); }
  .badge { padding: 2px 8px; border-radius: 10px; font-size: 0.85em; font-weight: 500; }
  .badge-success { background: var(--vscode-testing-iconPassed); color: var(--vscode-editor-background); }
  .badge-warning { background: var(--vscode-editorWarning-foreground); color: var(--vscode-editor-background); }
  .badge-error { background: var(--vscode-errorForeground); color: var(--vscode-editor-background); }
  .badge-pending { background: var(--vscode-descriptionForeground); color: var(--vscode-editor-background); }
  .meta { display: flex; gap: 24px; flex-wrap: wrap; }
  .meta-item { }
  .meta-label { color: var(--vscode-descriptionForeground); font-size: 0.9em; }
  .actions { margin-top: 16px; }
  .actions button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 6px 14px;
    border-radius: 2px;
    cursor: pointer;
    margin-right: 8px;
    font-size: 0.9em;
  }
  .actions button:hover { background: var(--vscode-button-hoverBackground); }
</style>
</head>
<body>
  <h1>${esc(task.id)}</h1>
  <p class="subtitle">${esc(task.title)}</p>

  <div class="meta">
    <div class="meta-item">
      <div class="meta-label">Jira</div>
      <div>${jiraHtml}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Status</div>
      <div>${esc(task.status)}</div>
    </div>
    <div class="meta-item">
      <div class="meta-label">Created</div>
      <div>${esc(task.createdAt.split('T')[0] ?? task.createdAt)}</div>
    </div>
  </div>

  <h2>Projects</h2>
  ${
    task.projects.length > 0
      ? `<table>
    <thead><tr><th>Repo</th><th>Branch</th><th>PR</th><th>Review</th><th>CI</th></tr></thead>
    <tbody>${projectRows}</tbody>
  </table>`
      : '<p class="dim">No projects</p>'
  }

  <h2>Links</h2>
  <ul>${linksHtml}</ul>

  <h2>Notes</h2>
  ${notesPreview}

  <div class="actions">
    <button onclick="postMessage({command:'openNotes',taskId:'${esc(task.id)}'})">Open Notes</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function openUrl(url) { vscode.postMessage({ command: 'openExternal', url }); }
    function postMessage(msg) { vscode.postMessage(msg); }
  </script>
</body>
</html>`;
  }

  private dispose(): void {
    TaskDetailPanel.currentPanel = undefined;
    this.panel.dispose();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function statusBadge(status: string, label: string): string {
  const classMap: Record<string, string> = {
    approved: 'badge-success',
    passed: 'badge-success',
    changes_requested: 'badge-warning',
    failed: 'badge-error',
    pending: 'badge-pending',
    none: '',
  };
  const cls = classMap[status] ?? '';
  return cls ? `<span class="badge ${cls}">${esc(label)}</span>` : `<span class="dim">${esc(label)}</span>`;
}

function reviewLabel(status: string): string {
  const map: Record<string, string> = {
    approved: 'Approved',
    changes_requested: 'Changes',
    pending: 'Pending',
    none: '—',
  };
  return map[status] ?? status;
}

function ciLabel(status: string): string {
  const map: Record<string, string> = {
    passed: 'Passed',
    failed: 'Failed',
    pending: 'Pending',
    none: '—',
  };
  return map[status] ?? status;
}
