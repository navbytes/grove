import { spawn } from 'node:child_process';
import type { Command } from 'commander';
import { getConfigValue, loadConfig, saveConfig, setConfigValue } from '../../core/config.js';
import { GroveError } from '../../core/errors.js';
import { CONFIG_FILE } from '../../core/types.js';
import { success } from '../ui/colors.js';

export function registerConfigCommand(program: Command): void {
  const configCmd = program.command('config').description('Manage Grove configuration');

  configCmd
    .command('get <key>')
    .description('Get a configuration value (e.g., grove config get branchTemplate)')
    .action(async (key: string) => {
      const config = await loadConfig();
      const value = getConfigValue(config, key);
      if (value === undefined) {
        throw new GroveError(`Config key not found: ${key}`, {
          suggestion: 'Run `grove config edit` to see all available keys.',
        });
      }
      console.log(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
    });

  configCmd
    .command('set <key> <value>')
    .description('Set a configuration value (e.g., grove config set pollingInterval 120)')
    .action(async (key: string, value: string) => {
      const config = await loadConfig();
      const updated = setConfigValue(config, key, value);
      await saveConfig(updated);
      console.log(success(`${key} = ${value}`));
    });

  configCmd
    .command('edit')
    .description('Open configuration file in $EDITOR')
    .action(async () => {
      const editor = process.env.EDITOR || process.env.VISUAL || 'vi';
      const child = spawn(editor, [CONFIG_FILE], { stdio: 'inherit' });
      await new Promise<void>((resolve) => child.on('close', () => resolve()));
    });
}
