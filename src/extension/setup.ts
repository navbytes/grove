/**
 * Setup wizard for Grove
 * First-run configuration flow
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as os from 'os';
import {
  GroveConfig,
  DEFAULT_CONFIG,
  SECRET_KEYS,
  GitProvider,
} from '../core/types';
import { writeConfig, expandPath, ensureWorkspaceDir } from '../core/config';
import { registerProject, detectDefaultBranch } from '../core/projects';
import { createJiraClient } from '../core/jira';
import { createGitHubClient } from '../core/github';

/**
 * Show the setup wizard
 */
export async function showSetupWizard(context: vscode.ExtensionContext): Promise<boolean> {
  const config: Partial<GroveConfig> = { ...DEFAULT_CONFIG };

  // Step 1: Workspace directory
  const workspaceDir = await vscode.window.showInputBox({
    prompt: 'Where should Grove create task workspaces?',
    value: DEFAULT_CONFIG.workspaceDir,
    placeHolder: '~/grove-workspaces',
    validateInput: (value) => {
      if (!value.trim()) {
        return 'Workspace directory is required';
      }
      return undefined;
    },
  });

  if (!workspaceDir) {
    return false; // User cancelled
  }

  config.workspaceDir = workspaceDir;

  // Ensure workspace directory exists
  const expandedDir = expandPath(workspaceDir);
  const dirResult = ensureWorkspaceDir();
  if (!dirResult.success) {
    vscode.window.showErrorMessage(`Failed to create workspace directory: ${dirResult.error}`);
    return false;
  }

  // Step 2: Configure Jira (optional)
  const configureJira = await vscode.window.showQuickPick(
    [
      { label: 'Yes', description: 'Set up Jira integration now' },
      { label: 'Skip', description: 'Configure later' },
    ],
    {
      placeHolder: 'Would you like to configure Jira integration?',
    }
  );

  if (configureJira?.label === 'Yes') {
    const jiraConfig = await configureJiraIntegration(context);
    if (jiraConfig) {
      config.jira = jiraConfig;
    }
  }

  // Step 3: Configure Git provider
  const configureGit = await vscode.window.showQuickPick(
    [
      { label: 'Yes', description: 'Set up GitHub/GitLab/Bitbucket integration' },
      { label: 'Skip', description: 'Configure later' },
    ],
    {
      placeHolder: 'Would you like to configure Git provider integration?',
    }
  );

  if (configureGit?.label === 'Yes') {
    const gitConfig = await configureGitIntegration(context);
    if (gitConfig) {
      config.git = gitConfig;
    }
  }

  // Step 4: Branch template
  const branchTemplate = await vscode.window.showInputBox({
    prompt: 'Branch naming template (use {ticketId} and {slug} as placeholders)',
    value: DEFAULT_CONFIG.branchTemplate,
    placeHolder: '{ticketId}-{slug}',
  });

  if (branchTemplate) {
    config.branchTemplate = branchTemplate;
  }

  // Step 5: Register first project (optional)
  const registerFirstProject = await vscode.window.showQuickPick(
    [
      { label: 'Yes', description: 'Register a project now' },
      { label: 'Skip', description: 'Register projects later' },
    ],
    {
      placeHolder: 'Would you like to register your first project?',
    }
  );

  if (registerFirstProject?.label === 'Yes') {
    await registerProjectWizard();
  }

  // Save configuration
  const fullConfig: GroveConfig = {
    ...DEFAULT_CONFIG,
    ...config,
  };

  const writeResult = writeConfig(fullConfig);
  if (!writeResult.success) {
    vscode.window.showErrorMessage(`Failed to save configuration: ${writeResult.error}`);
    return false;
  }

  vscode.window.showInformationMessage('Grove setup complete! You can now create your first task.');
  return true;
}

/**
 * Configure Jira integration
 */
async function configureJiraIntegration(
  context: vscode.ExtensionContext
): Promise<{ baseUrl: string; email: string } | null> {
  // Jira base URL
  const baseUrl = await vscode.window.showInputBox({
    prompt: 'Enter your Jira base URL',
    placeHolder: 'https://company.atlassian.net',
    validateInput: (value) => {
      if (!value.trim()) {
        return 'Jira URL is required';
      }
      try {
        new URL(value);
      } catch {
        return 'Please enter a valid URL';
      }
      return undefined;
    },
  });

  if (!baseUrl) {
    return null;
  }

  // Jira email
  const email = await vscode.window.showInputBox({
    prompt: 'Enter your Jira email address',
    placeHolder: 'you@company.com',
    validateInput: (value) => {
      if (!value.trim()) {
        return 'Email is required';
      }
      if (!value.includes('@')) {
        return 'Please enter a valid email address';
      }
      return undefined;
    },
  });

  if (!email) {
    return null;
  }

  // Jira API token
  const apiToken = await vscode.window.showInputBox({
    prompt: 'Enter your Jira API token (create one at https://id.atlassian.com/manage-profile/security/api-tokens)',
    password: true,
    validateInput: (value) => {
      if (!value.trim()) {
        return 'API token is required';
      }
      return undefined;
    },
  });

  if (!apiToken) {
    return null;
  }

  // Test connection
  const testingMessage = vscode.window.setStatusBarMessage('Testing Jira connection...');

  try {
    const client = createJiraClient({ baseUrl, email, apiToken });
    const testResult = await client.testConnection();

    testingMessage.dispose();

    if (!testResult.success) {
      const retry = await vscode.window.showErrorMessage(
        `Jira connection failed: ${testResult.error}`,
        'Retry',
        'Skip Jira'
      );
      if (retry === 'Retry') {
        return configureJiraIntegration(context);
      }
      return null;
    }

    // Store API token securely
    await context.secrets.store(SECRET_KEYS.JIRA_API_TOKEN, apiToken);

    vscode.window.showInformationMessage('Jira connection successful!');
    return { baseUrl, email };
  } catch (error) {
    testingMessage.dispose();
    vscode.window.showErrorMessage(`Failed to test Jira connection: ${error}`);
    return null;
  }
}

/**
 * Configure Git provider integration
 */
async function configureGitIntegration(
  context: vscode.ExtensionContext
): Promise<{ provider: GitProvider; baseUrl: string; org: string } | null> {
  // Select provider
  const providerChoice = await vscode.window.showQuickPick(
    [
      { label: 'GitHub', value: 'github' as GitProvider, description: 'github.com or GitHub Enterprise' },
      { label: 'GitLab', value: 'gitlab' as GitProvider, description: 'gitlab.com or self-hosted' },
      { label: 'Bitbucket', value: 'bitbucket' as GitProvider, description: 'bitbucket.org or Bitbucket Server' },
    ],
    {
      placeHolder: 'Select your Git provider',
    }
  );

  if (!providerChoice) {
    return null;
  }

  const provider = providerChoice.value;

  // Base URL (for self-hosted instances)
  let baseUrl: string;
  if (provider === 'github') {
    baseUrl = 'https://github.com';
  } else if (provider === 'gitlab') {
    baseUrl = 'https://gitlab.com';
  } else {
    baseUrl = 'https://bitbucket.org';
  }

  const customUrl = await vscode.window.showInputBox({
    prompt: `Enter ${providerChoice.label} URL (leave default for cloud)`,
    value: baseUrl,
    placeHolder: baseUrl,
  });

  if (customUrl) {
    baseUrl = customUrl;
  }

  // Organization/Group name
  const org = await vscode.window.showInputBox({
    prompt: `Enter your ${provider === 'gitlab' ? 'group' : 'organization'} name`,
    placeHolder: 'company-org',
    validateInput: (value) => {
      if (!value.trim()) {
        return 'Organization name is required';
      }
      return undefined;
    },
  });

  if (!org) {
    return null;
  }

  // API token
  const tokenPrompt =
    provider === 'github'
      ? 'Enter your GitHub Personal Access Token (with repo scope)'
      : provider === 'gitlab'
        ? 'Enter your GitLab Personal Access Token (with api scope)'
        : 'Enter your Bitbucket App Password';

  const apiToken = await vscode.window.showInputBox({
    prompt: tokenPrompt,
    password: true,
    validateInput: (value) => {
      if (!value.trim()) {
        return 'API token is required';
      }
      return undefined;
    },
  });

  if (!apiToken) {
    return null;
  }

  // Test connection (only for GitHub for now)
  if (provider === 'github') {
    const testingMessage = vscode.window.setStatusBarMessage('Testing GitHub connection...');

    try {
      const client = createGitHubClient(
        baseUrl === 'https://github.com' ? undefined : `${baseUrl}/api/v3`
      );
      client.setToken(apiToken);

      // Simple test - try to get user info
      const response = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${apiToken}`,
          Accept: 'application/json',
        },
      });

      testingMessage.dispose();

      if (!response.ok) {
        const retry = await vscode.window.showErrorMessage(
          'GitHub connection failed. Please check your token.',
          'Retry',
          'Skip GitHub'
        );
        if (retry === 'Retry') {
          return configureGitIntegration(context);
        }
        return null;
      }

      vscode.window.showInformationMessage('GitHub connection successful!');
    } catch (error) {
      testingMessage.dispose();
      vscode.window.showErrorMessage(`Failed to test GitHub connection: ${error}`);
      return null;
    }
  }

  // Store API token securely
  await context.secrets.store(SECRET_KEYS.GIT_API_TOKEN, apiToken);

  return { provider, baseUrl, org };
}

/**
 * Register a project wizard
 */
export async function registerProjectWizard(): Promise<boolean> {
  // Select folder
  const folders = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Select Repository',
    title: 'Select a git repository to register',
  });

  if (!folders || folders.length === 0) {
    return false;
  }

  const repoPath = folders[0].fsPath;

  // Suggest project name from folder name
  const suggestedName = path.basename(repoPath);

  const projectName = await vscode.window.showInputBox({
    prompt: 'Enter a name for this project',
    value: suggestedName,
    validateInput: (value) => {
      if (!value.trim()) {
        return 'Project name is required';
      }
      if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
        return 'Project name can only contain letters, numbers, hyphens, and underscores';
      }
      return undefined;
    },
  });

  if (!projectName) {
    return false;
  }

  // Detect default branch
  const detectingMessage = vscode.window.setStatusBarMessage('Detecting default branch...');
  const branchResult = await detectDefaultBranch(repoPath);
  detectingMessage.dispose();

  const defaultBranch =
    branchResult.success && branchResult.data ? branchResult.data : 'main';

  const branch = await vscode.window.showInputBox({
    prompt: 'Default base branch for this project',
    value: defaultBranch,
    validateInput: (value) => {
      if (!value.trim()) {
        return 'Branch name is required';
      }
      return undefined;
    },
  });

  if (!branch) {
    return false;
  }

  // Register the project
  const result = registerProject({
    name: projectName,
    path: repoPath,
    defaultBaseBranch: branch,
  });

  if (!result.success) {
    vscode.window.showErrorMessage(`Failed to register project: ${result.error}`);
    return false;
  }

  vscode.window.showInformationMessage(`Project "${projectName}" registered successfully!`);
  return true;
}

/**
 * Edit settings command - opens config.json
 */
export async function editSettings(): Promise<void> {
  const configPath = path.join(os.homedir(), '.grove', 'config.json');
  const uri = vscode.Uri.file(configPath);

  try {
    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to open settings: ${error}`);
  }
}
