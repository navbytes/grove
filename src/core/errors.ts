export class GroveError extends Error {
  readonly exitCode: number;
  readonly suggestion?: string;

  constructor(message: string, opts?: { exitCode?: number; suggestion?: string }) {
    super(message);
    this.name = 'GroveError';
    this.exitCode = opts?.exitCode ?? 1;
    this.suggestion = opts?.suggestion;
  }
}

export class NotInTaskError extends GroveError {
  constructor() {
    super('Not in a task workspace.', {
      suggestion: 'Use --task <id> or cd into a task workspace.',
    });
  }
}

export class TaskNotFoundError extends GroveError {
  constructor(taskId: string) {
    super(`Task "${taskId}" not found.`, {
      suggestion: 'Run `grove list` to see available tasks.',
    });
  }
}

export class ProjectNotFoundError extends GroveError {
  constructor(name: string) {
    super(`Project "${name}" not found.`, {
      suggestion: 'Run `grove project list` to see registered projects.',
    });
  }
}

export class NotInitializedError extends GroveError {
  constructor() {
    super('Grove is not initialized.', {
      suggestion: 'Run `grove init` to set up Grove.',
    });
  }
}

export class GitHubNotConfiguredError extends GroveError {
  constructor() {
    super('GitHub is not configured.', {
      suggestion: 'Run `grove init` to set up GitHub integration.',
    });
  }
}

export class GitHubAuthError extends GroveError {
  constructor() {
    super('GitHub authentication not available.', {
      suggestion: 'Run `grove init` and provide a GitHub token.',
    });
  }
}

export class JiraNotConfiguredError extends GroveError {
  constructor() {
    super('Jira is not configured.', {
      suggestion: 'Run `grove init` to set up Jira integration.',
    });
  }
}
