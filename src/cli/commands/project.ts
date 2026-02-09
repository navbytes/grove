import type { Command } from 'commander';
import { GroveError, ProjectNotFoundError } from '../../core/errors.js';
import { addProject, loadProjects, removeProject, saveProjects } from '../../core/projects.js';
import type { WorktreeSetup, WorktreeSetupCopyEntry } from '../../core/types.js';
import { dim, success, warn } from '../ui/colors.js';
import { clack, promptConfirm, promptSelect, promptText } from '../ui/prompts.js';
import { renderProjectTable } from '../ui/table.js';

export function registerProjectCommand(program: Command): void {
  const projectCmd = program.command('project').description('Manage registered projects');

  projectCmd
    .command('add [path]')
    .description('Register a git repository as a project (defaults to current directory)')
    .action(async (path?: string) => {
      const repoPath = path || '.';
      const result = await addProject(repoPath);
      if (result.success && result.data) {
        console.log(success(`Detected: ${result.data.name} (default branch: ${result.data.defaultBaseBranch})`));
        console.log(success('Project registered.'));
      } else {
        throw new GroveError(result.error || 'Failed to register project.', {
          suggestion: 'Check that the path is a valid git repository.',
        });
      }
    });

  projectCmd
    .command('list')
    .description('List all registered projects')
    .action(async () => {
      const projects = await loadProjects();
      if (projects.length === 0) {
        console.log(warn('No projects registered. Run `grove project add <path>` to register one.'));
        return;
      }
      console.log();
      console.log(renderProjectTable(projects));
      console.log();
    });

  projectCmd
    .command('remove <name>')
    .description('Remove a registered project')
    .action(async (name: string) => {
      const confirmed = await promptConfirm(
        `Remove project "${name}"? Existing tasks using this project are not affected.`,
        false,
      );
      if (!confirmed) return;

      const result = await removeProject(name);
      if (result.success) {
        console.log(success(`Removed ${name}.`));
      } else {
        throw new GroveError(result.error || 'Failed to remove project.');
      }
    });

  projectCmd
    .command('setup <name>')
    .description('Configure worktree setup steps for a project (files to copy, commands to run)')
    .action(async (name: string) => {
      const projects = await loadProjects();
      const projectIndex = projects.findIndex((p) => p.name === name);
      if (projectIndex === -1) {
        throw new ProjectNotFoundError(name);
      }

      // biome-ignore lint/style/noNonNullAssertion: index validated by findIndex check above
      const project = projects[projectIndex]!;

      clack.intro(`grove project setup — ${name}`);

      // Show current setup if any
      if (project.worktreeSetup) {
        clack.log.info('Current setup:');
        if (project.worktreeSetup.copyFiles?.length) {
          for (const entry of project.worktreeSetup.copyFiles) {
            const dest = entry.destination || entry.source;
            clack.log.info(`  ${entry.mode}: ${entry.source} -> ${dest}`);
          }
        }
        if (project.worktreeSetup.postCreateCommands?.length) {
          for (const cmd of project.worktreeSetup.postCreateCommands) {
            clack.log.info(`  cmd: ${cmd}`);
          }
        }

        const action = await promptSelect('What would you like to do?', [
          { name: 'Add more entries', value: 'add' as const },
          { name: 'Replace entire setup', value: 'replace' as const },
          { name: 'Clear setup', value: 'clear' as const },
        ]);

        if (action === 'clear') {
          delete project.worktreeSetup;
          await saveProjects(projects);
          console.log(success('Setup cleared.'));
          clack.outro('');
          return;
        }
        if (action === 'replace') {
          project.worktreeSetup = {};
        }
      }

      const setup: WorktreeSetup = project.worktreeSetup || {};

      // Files to copy/symlink
      const addFiles = await promptConfirm('Add files/directories to copy or symlink?', true);
      if (addFiles) {
        setup.copyFiles = setup.copyFiles || [];
        let addMore = true;
        while (addMore) {
          const source = await promptText('Source path (relative to repo root):');
          const destination = await promptText('Destination path (relative to worktree root):', source);
          const mode = await promptSelect('Mode:', [
            { name: 'Copy — duplicate the file/directory', value: 'copy' as const },
            { name: 'Symlink — link worktree to main repo', value: 'symlink' as const },
          ]);

          const entry: WorktreeSetupCopyEntry = { source, mode };
          if (destination !== source) {
            entry.destination = destination;
          }

          setup.copyFiles.push(entry);
          clack.log.success(`Added: ${mode} ${source}${destination !== source ? ` -> ${destination}` : ''}`);

          addMore = await promptConfirm('Add another file/directory?', false);
        }
      }

      // Post-create commands
      const addCommands = await promptConfirm('Add post-create commands?', true);
      if (addCommands) {
        setup.postCreateCommands = setup.postCreateCommands || [];
        let addMore = true;
        while (addMore) {
          const command = await promptText('Command to run in worktree:');
          setup.postCreateCommands.push(command);
          clack.log.success(`Added: ${command}`);

          addMore = await promptConfirm('Add another command?', false);
        }
      }

      project.worktreeSetup = setup;
      await saveProjects(projects);

      // Summary
      if (setup.copyFiles?.length) {
        console.log(dim(`  ${setup.copyFiles.length} file(s) to copy/symlink`));
      }
      if (setup.postCreateCommands?.length) {
        console.log(dim(`  ${setup.postCreateCommands.length} post-create command(s)`));
      }

      clack.outro('Setup saved.');
    });
}
