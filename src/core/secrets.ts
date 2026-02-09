import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { OperationResult } from './types.js';

const execFileAsync = promisify(execFile);

const SERVICE_NAME = 'grove-cli';

export async function isKeychainAvailable(): Promise<boolean> {
  try {
    await execFileAsync('/usr/bin/security', ['help']);
    return true;
  } catch {
    return false;
  }
}

export async function setSecret(key: string, value: string): Promise<OperationResult> {
  try {
    // Delete existing entry first (ignore errors if it doesn't exist)
    try {
      await execFileAsync('/usr/bin/security', ['delete-generic-password', '-s', SERVICE_NAME, '-a', key]);
    } catch {
      // Ignore — entry may not exist
    }

    await execFileAsync('/usr/bin/security', [
      'add-generic-password',
      '-s',
      SERVICE_NAME,
      '-a',
      key,
      '-w',
      value,
      '-U',
    ]);
    return { success: true };
  } catch (err) {
    return { success: false, error: `Failed to store secret: ${err}` };
  }
}

export async function getSecret(key: string): Promise<OperationResult<string>> {
  try {
    const { stdout } = await execFileAsync('/usr/bin/security', [
      'find-generic-password',
      '-s',
      SERVICE_NAME,
      '-a',
      key,
      '-w',
    ]);
    return { success: true, data: stdout.trim() };
  } catch {
    return { success: false, error: `Secret not found: ${key}` };
  }
}

export async function deleteSecret(key: string): Promise<OperationResult> {
  try {
    await execFileAsync('/usr/bin/security', ['delete-generic-password', '-s', SERVICE_NAME, '-a', key]);
    return { success: true };
  } catch {
    return { success: false, error: `Failed to delete secret: ${key}` };
  }
}

export async function getToken(envVar: string, keychainKey: string): Promise<string | null> {
  // Environment variable takes priority
  const envValue = process.env[envVar];
  if (envValue) {
    return envValue;
  }

  // Fall back to keychain
  if (await isKeychainAvailable()) {
    const result = await getSecret(keychainKey);
    if (result.success && result.data) {
      return result.data;
    }
  }

  return null;
}
