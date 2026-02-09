import { beforeEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { dirExists, ensureDir, expandPath, fileExists, readJsonFile, writeJsonFile } from '../../core/store.js';

let testDir: string;

beforeEach(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'grove-store-test-'));
});

describe('expandPath', () => {
  test('expands ~ to home directory', () => {
    const result = expandPath('~/foo/bar');
    expect(result).not.toContain('~');
    expect(result).toContain('foo/bar');
  });

  test('resolves relative paths', () => {
    const result = expandPath('foo/bar');
    expect(result).toMatch(/^\//);
  });

  test('leaves absolute paths as-is', () => {
    expect(expandPath('/usr/local/bin')).toBe('/usr/local/bin');
  });
});

describe('ensureDir', () => {
  test('creates nested directories', async () => {
    const dir = join(testDir, 'a', 'b', 'c');
    await ensureDir(dir);
    expect(await dirExists(dir)).toBe(true);
  });

  test('is idempotent', async () => {
    const dir = join(testDir, 'x');
    await ensureDir(dir);
    await ensureDir(dir);
    expect(await dirExists(dir)).toBe(true);
  });
});

describe('fileExists / dirExists', () => {
  test('returns false for non-existent file', async () => {
    expect(await fileExists(join(testDir, 'nope.txt'))).toBe(false);
  });

  test('returns true for existing file', async () => {
    const path = join(testDir, 'exists.txt');
    await Bun.write(path, 'hello');
    expect(await fileExists(path)).toBe(true);
  });

  test('returns true for existing directory', async () => {
    expect(await dirExists(testDir)).toBe(true);
  });

  test('returns false for non-existent directory', async () => {
    expect(await dirExists(join(testDir, 'nope'))).toBe(false);
  });
});

describe('readJsonFile / writeJsonFile', () => {
  test('returns default value when file does not exist', async () => {
    const result = await readJsonFile(join(testDir, 'missing.json'), { x: 1 });
    expect(result).toEqual({ x: 1 });
  });

  test('writes and reads JSON', async () => {
    const path = join(testDir, 'data.json');
    const data = { name: 'test', items: [1, 2, 3] };
    await writeJsonFile(path, data);

    const result = await readJsonFile(path, {});
    expect(result).toEqual(data);
  });

  test('writes valid JSON with trailing newline', async () => {
    const path = join(testDir, 'formatted.json');
    await writeJsonFile(path, { a: 1 });
    const raw = await readFile(path, 'utf-8');
    expect(raw).toEndWith('\n');
    expect(JSON.parse(raw)).toEqual({ a: 1 });
  });

  test('creates parent directories', async () => {
    const path = join(testDir, 'nested', 'deep', 'file.json');
    await writeJsonFile(path, { ok: true });
    expect(await fileExists(path)).toBe(true);
  });

  test('atomic write does not corrupt on overwrite', async () => {
    const path = join(testDir, 'atomic.json');
    await writeJsonFile(path, { v: 1 });
    await writeJsonFile(path, { v: 2 });
    const result = await readJsonFile(path, {});
    expect(result).toEqual({ v: 2 });
  });
});
