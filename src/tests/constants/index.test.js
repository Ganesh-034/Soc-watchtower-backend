
// File: src/tests/constants/index.test.js
import { jest } from '@jest/globals';

const importConstants = async () => {
  // Ensure a clean ESM import for each test
  jest.resetModules();
  const moduleSpecifier = new URL('../../constants/index.js', import.meta.url).href;
  return import(moduleSpecifier);
};

describe('src/constants/index.js', () => {
  test('exports named constants with correct values and types', async () => {
    const { APP_NAME, VERSION, default: defaultExport } = await importConstants();

    // No default export expected
    expect(defaultExport).toBeUndefined();

    // APP_NAME checks
    expect(typeof APP_NAME).toBe('string');
    expect(APP_NAME).toBe('SOC Watchtower Backend'); // from source

    // VERSION checks
    expect(typeof VERSION).toBe('string');
    expect(VERSION).toBe('1.0.0'); // from source

    // SemVer-like format (very basic): x.y.z
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  test('values remain consistent across multiple imports (no side effects)', async () => {
    const first = await importConstants();
    const second = await importConstants();

    expect(first.APP_NAME).toBe('SOC Watchtower Backend');
    expect(second.APP_NAME).toBe('SOC Watchtower Backend');

    expect(first.VERSION).toBe('1.0.0');
    expect(second.VERSION).toBe('1.0.0');

    // The imported bindings should be identical across imports
    expect(first.APP_NAME).toBe(second.APP_NAME);
    expect(first.VERSION).toBe(second.VERSION);
  });

  test('does not read environment variables (sanity)', async () => {
    // Changing env should have no impact
    process.env.APP_NAME = 'Overridden';
    process.env.VERSION = '9.9.9';

    const { APP_NAME, VERSION } = await importConstants();

    expect(APP_NAME).toBe('SOC Watchtower Backend');
    expect(VERSION).toBe('1.0.0');
  });
});
