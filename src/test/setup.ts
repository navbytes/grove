import { afterAll, beforeAll } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let testGroveDir: string;

beforeAll(async () => {
  testGroveDir = await mkdtemp(join(tmpdir(), 'grove-test-'));
  process.env.GROVE_TEST_DIR = testGroveDir;
});

afterAll(async () => {
  if (testGroveDir) {
    await rm(testGroveDir, { recursive: true, force: true });
  }
});
