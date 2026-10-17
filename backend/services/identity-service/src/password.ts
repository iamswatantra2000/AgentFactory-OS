import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const keyLength = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const hash = (await scrypt(password, salt, keyLength)) as Buffer;
  return `scrypt:${salt}:${hash.toString('hex')}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, salt, storedHex] = encoded.split(':');
  if (algorithm !== 'scrypt' || !salt || !storedHex || !/^[0-9a-f]{128}$/.test(storedHex)) {
    return false;
  }
  const stored = Buffer.from(storedHex, 'hex');
  const actual = (await scrypt(password, salt, stored.length)) as Buffer;
  return timingSafeEqual(stored, actual);
}
