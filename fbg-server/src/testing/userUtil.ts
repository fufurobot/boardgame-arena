/**
 * Test-only helpers for creating users.
 *
 * Nicknames became unique when they started identifying accounts for login.
 * Legacy specs reuse names like `bob` across cases, which now collides. This
 * helper derives a unique nickname while preserving the readable intent
 * (`bob` becomes `bob0`, `bob1`, ...).
 */

let counter = 0;

/** Returns a unique nickname based on `base`. */
export function uniqueNickname(base: string): string {
  // Nicknames are capped at 15 characters by UsersService.
  const suffix = String(counter++);
  const trimmed = base.slice(0, 15 - suffix.length);
  return `${trimmed}${suffix}`;
}
