/**
 * JWT signing secret.
 *
 * A hard-coded fallback would let anyone forge a token for any user, which
 * would defeat the roles added in objective 3. In production the secret must
 * be supplied; in development a per-process random secret is generated so the
 * default is at least not a known constant (tokens then stop verifying across
 * restarts, which is an acceptable trade for not shipping a public secret).
 */
import { randomBytes } from 'crypto';
import { IS_PROD } from '../util';

function resolveSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv.length > 0) {
    return fromEnv;
  }
  if (IS_PROD) {
    throw new Error(
      'JWT_SECRET must be set in production: refusing to start with a generated or default secret.',
    );
  }
  return randomBytes(32).toString('hex');
}

export const JWT_SECRET = resolveSecret();
