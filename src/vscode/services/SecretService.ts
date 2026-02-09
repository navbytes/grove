import * as vscode from 'vscode';
import type { SecretBackend } from '../../core/secrets.js';
import type { OperationResult } from '../../core/types.js';

export class VsCodeSecretBackend implements SecretBackend {
  constructor(private readonly secrets: vscode.SecretStorage) {}

  async isAvailable(): Promise<boolean> {
    return true;
  }

  async get(key: string): Promise<OperationResult<string>> {
    const value = await this.secrets.get(key);
    if (value !== undefined) {
      return { success: true, data: value };
    }
    return { success: false, error: `Secret not found: ${key}` };
  }

  async set(key: string, value: string): Promise<OperationResult> {
    await this.secrets.store(key, value);
    return { success: true };
  }

  async delete(key: string): Promise<OperationResult> {
    await this.secrets.delete(key);
    return { success: true };
  }
}
