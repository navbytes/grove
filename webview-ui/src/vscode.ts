import type { DashboardData, MessageToExtension } from './types';

// Wrapper for VS Code API
class VSCodeAPI {
  private readonly vscode = acquireVsCodeApi();

  public postMessage(message: MessageToExtension): void {
    this.vscode.postMessage(message);
  }

  public getState(): DashboardData | undefined {
    return this.vscode.getState();
  }

  public setState(state: DashboardData): void {
    this.vscode.setState(state);
  }
}

// Singleton instance
export const vscode = new VSCodeAPI();
