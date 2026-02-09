import { access, mkdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { GROVE_DIR } from './types.js';

export function expandPath(inputPath: string): string {
  if (inputPath.startsWith('~/') || inputPath === '~') {
    return resolve(homedir(), inputPath.slice(2));
  }
  return resolve(inputPath);
}

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const s = await stat(dirPath);
    return s.isDirectory();
  } catch {
    return false;
  }
}

export async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch {
    return defaultValue;
  }
}

export async function writeJsonFile<T>(filePath: string, data: T, mode: number = 0o644): Promise<void> {
  await ensureDir(dirname(filePath));
  const tmpPath = `${filePath}.tmp`;
  const content = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(tmpPath, content, { mode });
  await rename(tmpPath, filePath);
}

export async function ensureGroveDir(): Promise<void> {
  await ensureDir(GROVE_DIR);
}
