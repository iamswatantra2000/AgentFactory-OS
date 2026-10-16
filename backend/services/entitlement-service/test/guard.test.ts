import { describe, expect, it } from 'vitest';
import { canUseTestCheckout } from '../src/guard.js';

describe('test checkout guard', () => {
  it('rejects production even when the flag is enabled', () => {
    expect(canUseTestCheckout('production', 'true')).toBe(false);
  });

  it('allows an explicit test environment flag', () => {
    expect(canUseTestCheckout('test', 'true')).toBe(true);
  });
});
