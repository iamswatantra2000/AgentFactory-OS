import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('gateway configuration', () => {
  it('rejects an invalid downstream URL', () => {
    expect(() => loadConfig({ PROJECT_SERVICE_URL: 'not-a-url' })).toThrow(
      'Invalid gateway configuration',
    );
  });
});
