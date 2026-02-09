import * as vscode from 'vscode';
import { GROVE_DIR } from '../../core/types.js';

export class FileWatcherService {
  private debounceTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly onChanged: () => void) {}

  register(context: vscode.ExtensionContext): void {
    const pattern = new vscode.RelativePattern(vscode.Uri.file(GROVE_DIR), '*.json');
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    const debounced = () => {
      if (this.debounceTimer) clearTimeout(this.debounceTimer);
      this.debounceTimer = setTimeout(() => this.onChanged(), 200);
    };

    watcher.onDidChange(debounced);
    watcher.onDidCreate(debounced);
    watcher.onDidDelete(debounced);

    context.subscriptions.push(watcher, {
      dispose: () => {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
      },
    });
  }
}
