import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { promisify } from 'util';

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
/** Stored-hash format marker, so the scheme can be changed later. */
const SCHEME = 'scrypt';

/** Minimum accepted password length. */
export const MIN_PASSWORD_LENGTH = 8;

/**
 * Hashes a password with a per-password random salt.
 *
 * Format: `scrypt$<saltHex>$<derivedKeyHex>`. Salting means two users with
 * the same password get different stored hashes, so a leaked database cannot
 * be attacked with a single precomputed table.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const derived = await scrypt(password, salt, KEY_LENGTH);
  return `${SCHEME}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

/**
 * Checks a password against a stored hash in constant time.
 *
 * Returns false rather than throwing for malformed hashes so a corrupted row
 * cannot be distinguished from a wrong password by the caller.
 */
export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  if (typeof stored !== 'string') {
    return false;
  }
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== SCHEME) {
    return false;
  }
  const salt = Buffer.from(parts[1], 'hex');
  const expected = Buffer.from(parts[2], 'hex');
  if (salt.length === 0 || expected.length !== KEY_LENGTH) {
    return false;
  }
  const derived = await scrypt(password, salt, expected.length);
  // timingSafeEqual throws on length mismatch, so guard first.
  if (derived.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(derived, expected);
}
