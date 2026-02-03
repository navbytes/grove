/**
 * Grove VS Code Extension Entry Point
 */

import * as vscode from 'vscode';
import { isGroveSetup } from '../core/config';
import { registerCommands } from './commands';
import { GroveSidebarProvider } from './sidebar';
import { GroveStatusBar } from './statusbar';
import { GrovePolling } from './polling';
import { showSetupWizard } from './setup';
import { GroveDashboardPanel } from './dashboard';

let statusBar: GroveStatusBar | undefined;
let polling: GrovePolling | undefined;
let sidebarProvider: GroveSidebarProvider | undefined;

/**
 * Extension activation
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('Grove extension is activating...');

  // Register sidebar view
  sidebarProvider = new GroveSidebarProvider(context);
  const treeView = vscode.window.createTreeView('groveExplorer', {
    treeDataProvider: sidebarProvider,
    showCollapseAll: true,
  });
  context.subscriptions.push(treeView);

  // Register all commands
  registerCommands(context, sidebarProvider);

  // Register dashboard command
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.openDashboard', () => {
      GroveDashboardPanel.createOrShow(context.extensionUri);
    })
  );

  // Register webview serializer for dashboard restoration
  if (vscode.window.registerWebviewPanelSerializer) {
    context.subscriptions.push(
      vscode.window.registerWebviewPanelSerializer('groveDashboard', {
        async deserializeWebviewPanel(webviewPanel: vscode.WebviewPanel) {
          GroveDashboardPanel.revive(webviewPanel, context.extensionUri);
        },
      })
    );
  }

  // Initialize status bar
  statusBar = new GroveStatusBar(context);

  // Initialize polling
  polling = new GrovePolling(context, sidebarProvider, statusBar);

  // Check if setup is needed
  if (!isGroveSetup()) {
    const choice = await vscode.window.showInformationMessage(
      'Welcome to Grove! Would you like to set up your workspace now?',
      'Set Up Grove',
      'Later'
    );

    if (choice === 'Set Up Grove') {
      await showSetupWizard(context);
      sidebarProvider.refresh();
    }
  } else {
    // Start polling if already set up
    polling.start();
  }

  // Refresh on window focus
  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((state) => {
      if (state.focused && isGroveSetup()) {
        polling?.refreshNow();
      }
    })
  );

  console.log('Grove extension activated successfully');
}

/**
 * Extension deactivation
 */
export function deactivate(): void {
  console.log('Grove extension is deactivating...');

  polling?.stop();
  statusBar?.dispose();

  console.log('Grove extension deactivated');
}
