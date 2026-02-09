import pc from 'picocolors';

export function success(text: string): string {
  return pc.green(`  ✓ ${text}`);
}

export function error(text: string): string {
  return pc.red(`  ✗ ${text}`);
}

export function warn(text: string): string {
  return pc.yellow(`  ⚠ ${text}`);
}

export function info(text: string): string {
  return pc.blue(`  ${text}`);
}

export function dim(text: string): string {
  return pc.dim(text);
}

export function bold(text: string): string {
  return pc.bold(text);
}

export function heading(text: string): string {
  return pc.bold(pc.underline(text));
}

export function taskId(text: string): string {
  return pc.bold(pc.cyan(text));
}

export function projectName(text: string): string {
  return pc.magenta(text);
}

export function label(text: string): string {
  return pc.dim(text);
}
