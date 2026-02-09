import slugify from 'slugify';
import { ensureGroveDir, expandPath, readJsonFile, writeJsonFile } from './store.js';
import { CONFIG_FILE, DEFAULT_CONFIG, type GroveConfig } from './types.js';

export async function loadConfig(): Promise<GroveConfig> {
  const stored = await readJsonFile<Partial<GroveConfig>>(CONFIG_FILE, {});
  return { ...DEFAULT_CONFIG, ...stored, notifications: { ...DEFAULT_CONFIG.notifications, ...stored.notifications } };
}

export async function saveConfig(config: GroveConfig): Promise<void> {
  await ensureGroveDir();
  await writeJsonFile(CONFIG_FILE, config, 0o600);
}

export async function isInitialized(): Promise<boolean> {
  const { fileExists } = await import('./store.js');
  return fileExists(CONFIG_FILE);
}

export function getConfigValue(config: GroveConfig, keyPath: string): unknown {
  const keys = keyPath.split('.');
  let current: unknown = config;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function setConfigValue(config: GroveConfig, keyPath: string, value: string): GroveConfig {
  const keys = keyPath.split('.');
  const result = structuredClone(config);
  let current: Record<string, unknown> = result as unknown as Record<string, unknown>;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i] as string;
    if (typeof current[key] !== 'object' || current[key] === null) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1] as string;

  // Attempt to parse as number or boolean
  if (value === 'true') {
    current[lastKey] = true;
  } else if (value === 'false') {
    current[lastKey] = false;
  } else if (!Number.isNaN(Number(value)) && value.trim() !== '') {
    current[lastKey] = Number(value);
  } else {
    current[lastKey] = value;
  }

  return result as unknown as GroveConfig;
}

export function getWorkspaceDir(config: GroveConfig): string {
  const envDir = process.env.GROVE_WORKSPACE_DIR;
  if (envDir) {
    return expandPath(envDir);
  }
  return expandPath(config.workspaceDir);
}

export function generateBranchName(template: string, vars: { ticketId: string; slug: string; title: string }): string {
  let branch = template;
  branch = branch.replace('{ticketId}', vars.ticketId);
  branch = branch.replace('{title}', vars.title);
  branch = branch.replace('{slug}', slugify(vars.slug, { lower: true, strict: true }));
  return branch;
}
