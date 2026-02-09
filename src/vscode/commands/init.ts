import * as vscode from 'vscode';
import { loadConfig, saveConfig, isInitialized } from '../../core/config.js';
import { ensureDir, expandPath } from '../../core/store.js';
import { ensureGroveDir } from '../../core/store.js';
import { DEFAULT_CONFIG } from '../../core/types.js';

export function registerInitCommand(context: vscode.ExtensionContext, refreshAll: () => void): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('grove.init', async () => {
      const alreadyInit = await isInitialized();
      if (alreadyInit) {
        const proceed = await vscode.window.showWarningMessage(
          'Grove is already initialized. Re-run setup?',
          'Continue',
          'Cancel',
        );
        if (proceed !== 'Continue') return;
      }

      // Step 1: Workspace directory
      const workspaceDir = await vscode.window.showInputBox({
        prompt: 'Where should task workspaces be created?',
        value: DEFAULT_CONFIG.workspaceDir,
        placeHolder: '~/grove-workspaces',
      });
      if (!workspaceDir) return;

      await ensureGroveDir();
      await ensureDir(expandPath(workspaceDir));

      const config = alreadyInit ? await loadConfig() : { ...DEFAULT_CONFIG };
      config.workspaceDir = workspaceDir;

      // Step 2: Jira integration
      const configureJira = await vscode.window.showQuickPick(
        [
          { label: 'Yes', value: true },
          { label: 'No', value: false },
        ],
        { placeHolder: 'Configure Jira integration?' },
      );

      if (configureJira?.value) {
        const baseUrl = await vscode.window.showInputBox({
          prompt: 'Jira base URL',
          placeHolder: 'https://company.atlassian.net',
        });
        const email = await vscode.window.showInputBox({
          prompt: 'Jira email',
          placeHolder: 'you@company.com',
        });

        if (baseUrl && email) {
          config.jira = { baseUrl, email };

          const token = await vscode.window.showInputBox({
            prompt: 'Jira API token',
            password: true,
          });
          if (token) {
            await context.secrets.store('jira-api-token', token);
          }
        }
      }

      // Step 3: GitHub integration
      const configureGitHub = await vscode.window.showQuickPick(
        [
          { label: 'Yes', value: true },
          { label: 'No', value: false },
        ],
        { placeHolder: 'Configure GitHub integration?' },
      );

      if (configureGitHub?.value) {
        const org = await vscode.window.showInputBox({
          prompt: 'GitHub organization name',
          placeHolder: 'my-org',
        });

        if (org) {
          config.git = { provider: 'github', baseUrl: 'https://github.com', org };

          const token = await vscode.window.showInputBox({
            prompt: 'GitHub personal access token',
            password: true,
          });
          if (token) {
            await context.secrets.store('github-api-token', token);
          }
        }
      }

      // Step 4: Save config
      await saveConfig(config);

      // Step 5: Register a project?
      const registerProject = await vscode.window.showQuickPick(
        [
          { label: 'Yes', value: true },
          { label: 'No', value: false },
        ],
        { placeHolder: 'Register a project now?' },
      );

      if (registerProject?.value) {
        await vscode.commands.executeCommand('grove.project.add');
      }

      refreshAll();
      vscode.window.showInformationMessage('Grove initialized successfully!');
    }),
  );
}
