import { describe, expect, it } from 'vitest';
import { shouldReveal } from './motion-policy';

describe('progressive reveal eligibility', () => {
  it('leaves visible content and restored scroll positions unchanged', () => {
    expect(shouldReveal(0, 800)).toBe(false);
    expect(shouldReveal(799, 800)).toBe(false);
    expect(shouldReveal(-100, 800)).toBe(false);
  });
  it('reveals below-fold content on entry', () => {
    expect(shouldReveal(800, 800)).toBe(true);
    expect(shouldReveal(1500, 800)).toBe(true);
  });
  it('fails safely for invalid viewport measurements', () => {
    expect(shouldReveal(100, 0)).toBe(false);
    expect(shouldReveal(NaN, 800)).toBe(false);
    expect(shouldReveal(100, Infinity)).toBe(false);
  });
});
