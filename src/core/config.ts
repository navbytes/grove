/**
 * Configuration management for Grove
 * Handles reading/writing config files from ~/.grove/
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  GroveConfig,
  DEFAULT_CONFIG,
  GROVE_PATHS,
  OperationResult,
} from './types';

/**
 * Get the Grove config directory path
 */
export function getGroveDir(): string {
  return path.join(os.homedir(), GROVE_PATHS.CONFIG_DIR);
}

/**
 * Get the path to a specific Grove config file
 */
export function getGrovePath(filename: string): string {
  return path.join(getGroveDir(), filename);
}

/**
 * Expand tilde (~) in paths to the home directory
 */
export function expandPath(filepath: string): string {
  if (filepath.startsWith('~/')) {
    return path.join(os.homedir(), filepath.slice(2));
  }
  if (filepath === '~') {
    return os.homedir();
  }
  return filepath;
}

/**
 * Ensure the Grove config directory exists
 */
export function ensureGroveDir(): OperationResult {
  try {
    const groveDir = getGroveDir();
    if (!fs.existsSync(groveDir)) {
      fs.mkdirSync(groveDir, { recursive: true });
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to create Grove directory: ${error}`,
    };
  }
}

/**
 * Check if Grove has been set up (config.json exists)
 */
export function isGroveSetup(): boolean {
  const configPath = getGrovePath(GROVE_PATHS.CONFIG_FILE);
  return fs.existsSync(configPath);
}

/**
 * Read the global Grove configuration
 */
export function readConfig(): OperationResult<GroveConfig> {
  try {
    const configPath = getGrovePath(GROVE_PATHS.CONFIG_FILE);

    if (!fs.existsSync(configPath)) {
      // Return default config if no config file exists
      return { success: true, data: { ...DEFAULT_CONFIG } };
    }

    const content = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(content) as Partial<GroveConfig>;

    // Merge with defaults to ensure all fields are present
    const mergedConfig: GroveConfig = {
      ...DEFAULT_CONFIG,
      ...config,
    };

    return { success: true, data: mergedConfig };
  } catch (error) {
    return {
      success: false,
      error: `Failed to read config: ${error}`,
    };
  }
}

/**
 * Write the global Grove configuration
 */
export function writeConfig(config: GroveConfig): OperationResult {
  try {
    const dirResult = ensureGroveDir();
    if (!dirResult.success) {
      return dirResult;
    }

    const configPath = getGrovePath(GROVE_PATHS.CONFIG_FILE);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to write config: ${error}`,
    };
  }
}

/**
 * Update specific fields in the configuration
 */
export function updateConfig(updates: Partial<GroveConfig>): OperationResult<GroveConfig> {
  const readResult = readConfig();
  if (!readResult.success || !readResult.data) {
    return { success: false, error: readResult.error };
  }

  const updatedConfig: GroveConfig = {
    ...readResult.data,
    ...updates,
  };

  const writeResult = writeConfig(updatedConfig);
  if (!writeResult.success) {
    return { success: false, error: writeResult.error };
  }

  return { success: true, data: updatedConfig };
}

/**
 * Get the workspace directory path (expanded)
 */
export function getWorkspaceDir(): string {
  const result = readConfig();
  const config = result.data || DEFAULT_CONFIG;
  return expandPath(config.workspaceDir);
}

/**
 * Ensure the workspace directory exists
 */
export function ensureWorkspaceDir(): OperationResult {
  try {
    const workspaceDir = getWorkspaceDir();
    if (!fs.existsSync(workspaceDir)) {
      fs.mkdirSync(workspaceDir, { recursive: true });
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to create workspace directory: ${error}`,
    };
  }
}

/**
 * Get the task workspace directory path
 */
export function getTaskDir(taskId: string): string {
  return path.join(getWorkspaceDir(), taskId);
}

/**
 * Ensure the task directory exists
 */
export function ensureTaskDir(taskId: string): OperationResult {
  try {
    const taskDir = getTaskDir(taskId);
    if (!fs.existsSync(taskDir)) {
      fs.mkdirSync(taskDir, { recursive: true });
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to create task directory: ${error}`,
    };
  }
}

/**
 * Generate a branch name from the template
 */
export function generateBranchName(
  template: string,
  ticketId: string,
  title: string,
  maxSlugLength: number = 30
): string {
  // Generate slug from title
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .slice(0, maxSlugLength); // Truncate to max length

  return template
    .replace('{ticketId}', ticketId)
    .replace('{slug}', slug)
    .replace('{title}', slug); // {title} also uses slug format
}
