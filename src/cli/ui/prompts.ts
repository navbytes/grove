import * as p from '@clack/prompts';

function handleCancel(value: unknown): void {
  if (p.isCancel(value)) {
    p.cancel('Operation cancelled.');
    process.exit(0);
  }
}

export async function promptText(message: string, defaultValue?: string): Promise<string> {
  const value = await p.text({ message, defaultValue, placeholder: defaultValue });
  handleCancel(value);
  return value as string;
}

export async function promptConfirm(message: string, defaultValue: boolean = true): Promise<boolean> {
  const value = await p.confirm({ message, initialValue: defaultValue });
  handleCancel(value);
  return value as boolean;
}

export async function promptSelect<T>(message: string, choices: Array<{ name: string; value: T }>): Promise<T> {
  const options = choices.map((c) => ({ value: c.value, label: c.name }));
  // biome-ignore lint/suspicious/noExplicitAny: @clack/prompts Option<T> conditional type requires cast for generics
  const value = await p.select({ message, options: options as any });
  handleCancel(value);
  return value as T;
}

export async function promptCheckbox<T>(message: string, choices: Array<{ name: string; value: T }>): Promise<T[]> {
  const options = choices.map((c) => ({ value: c.value, label: c.name }));
  // biome-ignore lint/suspicious/noExplicitAny: @clack/prompts Option<T> conditional type requires cast for generics
  const value = await p.multiselect({ message, options: options as any, required: true });
  handleCancel(value);
  return value as T[];
}

export async function promptPassword(message: string): Promise<string> {
  const value = await p.password({ message, mask: '*' });
  handleCancel(value);
  return value as string;
}

export { p as clack };
