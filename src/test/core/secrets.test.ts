import { describe, expect, test } from 'bun:test';
import { getToken, isKeychainAvailable } from '../../core/secrets.js';

describe('secrets', () => {
  test('isKeychainAvailable returns boolean', async () => {
    const result = await isKeychainAvailable();
    expect(typeof result).toBe('boolean');
  });

  test('getToken returns env var when set', async () => {
    process.env.GROVE_TEST_TOKEN = 'test-value';
    const token = await getToken('GROVE_TEST_TOKEN', 'test-key');
    expect(token).toBe('test-value');
    delete process.env.GROVE_TEST_TOKEN;
  });

  test('getToken returns null when nothing available', async () => {
    const token = await getToken('GROVE_NONEXISTENT_TOKEN_XYZ', 'nonexistent-key-xyz');
    expect(token).toBeNull();
  });
});
