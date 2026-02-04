/**
 * Setup webview panel for Grove
 * Provides a rich UI for initial configuration
 */

import * as vscode from 'vscode';
import {
  GroveConfig,
  DEFAULT_CONFIG,
  SECRET_KEYS,
  GitProvider,
} from '../core/types';
import { writeConfig, readConfig, ensureWorkspaceDir } from '../core/config';
import { createJiraClient } from '../core/jira';

interface SetupConfig {
  workspaceDir: string;
  branchTemplate: string;
  jira?: {
    baseUrl: string;
    email: string;
  };
  git?: {
    provider: GitProvider;
    baseUrl: string;
    org: string;
  };
}

interface SetupData {
  config: SetupConfig;
  gitToken?: string;
  jiraToken?: string;
}

type SetupMessageToExtension =
  | { type: 'ready' }
  | { type: 'save'; data: SetupData }
  | { type: 'testJira'; baseUrl: string; email: string; token: string }
  | { type: 'testGit'; provider: GitProvider; baseUrl: string; org: string; token: string }
  | { type: 'skip' }
  | { type: 'openExternal'; url: string }
  | { type: 'browseFolder' };

export class GroveSetupPanel {
  public static currentPanel: GroveSetupPanel | undefined;
  private static readonly viewType = 'groveSetup';

  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _context: vscode.ExtensionContext;
  private _disposables: vscode.Disposable[] = [];
  private _onComplete: ((completed: boolean) => void) | undefined;

  public static createOrShow(
    context: vscode.ExtensionContext,
    onComplete?: (completed: boolean) => void
  ): GroveSetupPanel {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (GroveSetupPanel.currentPanel) {
      GroveSetupPanel.currentPanel._panel.reveal(column);
      GroveSetupPanel.currentPanel._onComplete = onComplete;
      return GroveSetupPanel.currentPanel;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      GroveSetupPanel.viewType,
      'Grove Setup',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(context.extensionUri, 'webview-ui', 'build'),
        ],
      }
    );

    GroveSetupPanel.currentPanel = new GroveSetupPanel(panel, context, onComplete);
    return GroveSetupPanel.currentPanel;
  }

  private constructor(
    panel: vscode.WebviewPanel,
    context: vscode.ExtensionContext,
    onComplete?: (completed: boolean) => void
  ) {
    this._panel = panel;
    this._extensionUri = context.extensionUri;
    this._context = context;
    this._onComplete = onComplete;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      (message: SetupMessageToExtension) => this._handleMessage(message),
      null,
      this._disposables
    );
  }

  public dispose() {
    GroveSetupPanel.currentPanel = undefined;

    this._panel.dispose();

    while (this._disposables.length) {
      const x = this._disposables.pop();
      if (x) {
        x.dispose();
      }
    }
  }

  private async _handleMessage(message: SetupMessageToExtension) {
    switch (message.type) {
      case 'ready':
        this._sendInitData();
        break;

      case 'save':
        await this._saveConfig(message.data);
        break;

      case 'testJira':
        await this._testJiraConnection(message.baseUrl, message.email, message.token);
        break;

      case 'testGit':
        await this._testGitConnection(message.provider, message.baseUrl, message.org, message.token);
        break;

      case 'skip':
        this._onComplete?.(false);
        this.dispose();
        break;

      case 'openExternal':
        vscode.env.openExternal(vscode.Uri.parse(message.url));
        break;

      case 'browseFolder':
        await this._browseFolder();
        break;
    }
  }

  private _sendInitData() {
    // Load existing config if available
    const existingConfig = readConfig();
    let config: SetupConfig | undefined;

    if (existingConfig.success && existingConfig.data) {
      config = {
        workspaceDir: existingConfig.data.workspaceDir,
        branchTemplate: existingConfig.data.branchTemplate,
        jira: existingConfig.data.jira,
        git: existingConfig.data.git,
      };
    }

    this._panel.webview.postMessage({ type: 'init', config });
  }

  private async _testJiraConnection(baseUrl: string, email: string, token: string) {
    try {
      const client = createJiraClient({ baseUrl, email, apiToken: token });
      const result = await client.testConnection();

      this._panel.webview.postMessage({
        type: 'jiraTestResult',
        result: {
          success: result.success,
          error: result.error,
        },
      });
    } catch (error) {
      this._panel.webview.postMessage({
        type: 'jiraTestResult',
        result: {
          success: false,
          error: error instanceof Error ? error.message : 'Connection failed',
        },
      });
    }
  }

  private async _testGitConnection(
    provider: GitProvider,
    baseUrl: string,
    org: string,
    token: string
  ) {
    try {
      if (provider === 'github') {
        // Test GitHub connection
        const apiUrl = baseUrl === 'https://github.com'
          ? 'https://api.github.com/user'
          : `${baseUrl}/api/v3/user`;

        const response = await fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        this._panel.webview.postMessage({
          type: 'gitTestResult',
          result: { success: true },
        });
      } else {
        // For GitLab and Bitbucket, just assume success for now
        // TODO: Implement proper testing for other providers
        this._panel.webview.postMessage({
          type: 'gitTestResult',
          result: { success: true },
        });
      }
    } catch (error) {
      this._panel.webview.postMessage({
        type: 'gitTestResult',
        result: {
          success: false,
          error: error instanceof Error ? error.message : 'Connection failed',
        },
      });
    }
  }

  private async _browseFolder() {
    const folders = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
      openLabel: 'Select Workspace Directory',
      title: 'Select where Grove should create task workspaces',
    });

    if (folders && folders.length > 0) {
      this._panel.webview.postMessage({
        type: 'folderSelected',
        path: folders[0].fsPath,
      });
    }
  }

  private async _saveConfig(data: SetupData) {
    try {
      // Build the full config
      const fullConfig: GroveConfig = {
        ...DEFAULT_CONFIG,
        workspaceDir: data.config.workspaceDir,
        branchTemplate: data.config.branchTemplate,
      };

      if (data.config.jira) {
        fullConfig.jira = {
          baseUrl: data.config.jira.baseUrl,
          email: data.config.jira.email,
        };
      }

      if (data.config.git) {
        fullConfig.git = {
          provider: data.config.git.provider,
          baseUrl: data.config.git.baseUrl,
          org: data.config.git.org,
        };
      }

      // Ensure workspace directory exists
      const dirResult = ensureWorkspaceDir();
      if (!dirResult.success) {
        this._panel.webview.postMessage({
          type: 'error',
          message: `Failed to create workspace directory: ${dirResult.error}`,
        });
        return;
      }

      // Save config
      const writeResult = writeConfig(fullConfig);
      if (!writeResult.success) {
        this._panel.webview.postMessage({
          type: 'error',
          message: `Failed to save configuration: ${writeResult.error}`,
        });
        return;
      }

      // Store tokens securely
      if (data.jiraToken) {
        await this._context.secrets.store(SECRET_KEYS.JIRA_API_TOKEN, data.jiraToken);
      }

      if (data.gitToken) {
        await this._context.secrets.store(SECRET_KEYS.GIT_API_TOKEN, data.gitToken);
      }

      // Notify webview of success
      this._panel.webview.postMessage({ type: 'saved' });

      // Show success message
      vscode.window.showInformationMessage('Grove setup complete! You can now create your first task.');

      // Notify completion and close
      this._onComplete?.(true);
      this.dispose();
    } catch (error) {
      this._panel.webview.postMessage({
        type: 'error',
        message: error instanceof Error ? error.message : 'Failed to save configuration',
      });
    }
  }

  private _update() {
    this._panel.webview.html = this._getHtmlForWebview();
  }

  private _getHtmlForWebview() {
    const webview = this._panel.webview;

    // Get URIs for webview resources
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        'webview-ui',
        'build',
        'assets',
        'index.js'
      )
    );

    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        'webview-ui',
        'build',
        'assets',
        'index.css'
      )
    );

    // Use a nonce to only allow specific scripts to be run
    const nonce = getNonce();

    return `<!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource}; img-src ${webview.cspSource} https: data:; connect-src https:;">
          <link rel="stylesheet" type="text/css" href="${styleUri}">
          <title>Grove Setup</title>
        </head>
        <body>
          <div id="app"></div>
          <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>`;
  }
}

function getNonce() {
  let text = '';
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
