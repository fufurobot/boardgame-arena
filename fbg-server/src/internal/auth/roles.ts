import { UserRole } from '../../users/db/User.entity';

/**
 * Role hierarchy.
 *
 * A higher rank implies every permission of the ranks below it, so an admin
 * can do anything a moderator can. Keeping this in one place means a new role
 * is added in a single spot rather than at every call site.
 */
const RANK: Record<UserRole, number> = {
  [UserRole.USER]: 0,
  [UserRole.MODERATOR]: 1,
  [UserRole.ADMIN]: 2,
};

/** True when `role` is a role this application knows about. */
export function isKnownRole(role: unknown): role is UserRole {
  return typeof role === 'string' && role in RANK;
}

/**
 * True when `actual` is at least as privileged as `required`.
 *
 * Unknown roles are treated as having no privileges, so a malformed or
 * tampered value can never grant access.
 */
export function roleSatisfies(actual: unknown, required: UserRole): boolean {
  if (!isKnownRole(actual)) {
    return false;
  }
  return RANK[actual] >= RANK[required];
}
