import type { Command } from 'commander';
import { saveConfig } from '../../core/config.js';
import { addProject } from '../../core/projects.js';
import { isKeychainAvailable, setSecret } from '../../core/secrets.js';
import { ensureDir, expandPath } from '../../core/store.js';
import { DEFAULT_CONFIG } from '../../core/types.js';
import { clack, promptConfirm, promptPassword, promptText } from '../ui/prompts.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Interactive setup wizard for Grove')
    .action(async () => {
      clack.intro('grove init');

      // Workspace directory
      const workspaceDir = await promptText(
        'Where should task workspaces be created?',
        DEFAULT_CONFIG.workspaceDir.replace(process.env.HOME || '', '~'),
      );
      const absWorkspaceDir = expandPath(workspaceDir);
      await ensureDir(absWorkspaceDir);
      clack.log.success(`Created ${absWorkspaceDir}/`);

      const config = { ...DEFAULT_CONFIG, workspaceDir };

      const useKeychain = await isKeychainAvailable();

      // Jira integration
      const configureJira = await promptConfirm('Configure Jira integration?', false);
      if (configureJira) {
        const baseUrl = await promptText('Jira base URL:', 'https://company.atlassian.net');
        const email = await promptText('Jira email:');
        const apiToken = await promptPassword('Jira API token:');

        config.jira = { baseUrl, email };

        if (useKeychain) {
          await setSecret('jira-api-token', apiToken);
          clack.log.success('Stored token in macOS Keychain.');
        } else {
          clack.log.warn('Keychain not available. Set GROVE_JIRA_TOKEN environment variable.');
        }
      }

      // GitHub integration
      const configureGit = await promptConfirm('Configure GitHub integration?', false);
      if (configureGit) {
        const org = await promptText('GitHub org:');
        const apiToken = await promptPassword('GitHub API token:');

        config.git = {
          provider: 'github',
          baseUrl: 'https://github.com',
          org,
        };
        config.ci = { provider: 'github-actions' };

        if (useKeychain) {
          await setSecret('github-api-token', apiToken);
          clack.log.success('Stored token in macOS Keychain.');
        } else {
          clack.log.warn('Keychain not available. Set GROVE_GITHUB_TOKEN environment variable.');
        }
      }

      // Save config
      await saveConfig(config);

      // Register a project
      const registerNow = await promptConfirm('Register a project now?', true);
      if (registerNow) {
        const projectPath = await promptText('Project path:', '.');
        const result = await addProject(projectPath);
        if (result.success && result.data) {
          clack.log.success(`Detected: ${result.data.name} (default branch: ${result.data.defaultBaseBranch})`);
          clack.log.success('Project registered.');
        } else {
          clack.log.warn(result.error || 'Failed to register project.');
        }
      }

      clack.outro('Grove is ready! Run `grove new` to create your first task.');
    });
}
