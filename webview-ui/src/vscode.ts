import type { MessageToExtension, SetupMessageToExtension, WebviewState } from './types';

// Wrapper for VS Code API
class VSCodeAPI {
  private readonly vscode = acquireVsCodeApi();

  public postMessage(message: MessageToExtension | SetupMessageToExtension): void {
    this.vscode.postMessage(message);
  }

  public getState(): WebviewState | undefined {
    return this.vscode.getState();
  }

  public setState(state: WebviewState): void {
    this.vscode.setState(state);
  }
}

// Singleton instance
export const vscode = new VSCodeAPI();
