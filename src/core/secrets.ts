import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { OperationResult } from './types.js';

const execFileAsync = promisify(execFile);

const SERVICE_NAME = 'grove-cli';

// --- Pluggable secret backend ---

export interface SecretBackend {
  isAvailable(): Promise<boolean>;
  get(key: string): Promise<OperationResult<string>>;
  set(key: string, value: string): Promise<OperationResult>;
  delete(key: string): Promise<OperationResult>;
}

const keychainBackend: SecretBackend = {
  async isAvailable() {
    try {
      await execFileAsync('/usr/bin/security', ['help']);
      return true;
    } catch {
      return false;
    }
  },

  async get(key: string) {
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
  },

  async set(key: string, value: string) {
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
  },

  async delete(key: string) {
    try {
      await execFileAsync('/usr/bin/security', ['delete-generic-password', '-s', SERVICE_NAME, '-a', key]);
      return { success: true };
    } catch {
      return { success: false, error: `Failed to delete secret: ${key}` };
    }
  },
};

let activeBackend: SecretBackend = keychainBackend;

export function setSecretBackend(backend: SecretBackend): void {
  activeBackend = backend;
}

export function getSecretBackend(): SecretBackend {
  return activeBackend;
}

// --- Public API (delegates to active backend) ---

export async function isKeychainAvailable(): Promise<boolean> {
  return activeBackend.isAvailable();
}

export async function setSecret(key: string, value: string): Promise<OperationResult> {
  return activeBackend.set(key, value);
}

export async function getSecret(key: string): Promise<OperationResult<string>> {
  return activeBackend.get(key);
}

export async function deleteSecret(key: string): Promise<OperationResult> {
  return activeBackend.delete(key);
}

export async function getToken(envVar: string, keychainKey: string): Promise<string | null> {
  // Environment variable takes priority
  const envValue = process.env[envVar];
  if (envValue) {
    return envValue;
  }

  // Fall back to secret backend
  if (await activeBackend.isAvailable()) {
    const result = await activeBackend.get(keychainKey);
    if (result.success && result.data) {
      return result.data;
    }
  }

  return null;
}
