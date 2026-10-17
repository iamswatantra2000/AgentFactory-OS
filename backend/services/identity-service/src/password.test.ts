import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('verifies the right password without storing it in plain text', async () => {
    const stored = await hashPassword('correct horse battery staple');
    expect(stored).not.toContain('correct horse battery staple');
    expect(await verifyPassword('correct horse battery staple', stored)).toBe(true);
    expect(await verifyPassword('a different password', stored)).toBe(false);
  });

  it('uses a fresh salt for every password', async () => {
    const first = await hashPassword('correct horse battery staple');
    const second = await hashPassword('correct horse battery staple');
    expect(first).not.toBe(second);
  });
});
