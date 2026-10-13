import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { UserRole } from '../../users/db/User.entity';
import { roleSatisfies } from './roles';

/** Metadata key holding the roles a handler requires. */
export const ROLES_KEY = 'roles';

/**
 * Declares which roles may reach a handler.
 *
 * Must be combined with an authentication guard (GqlAuthGuard), which is what
 * populates `req.user`.
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Authorizes a request against the roles declared with @Roles().
 *
 * Denies by default when a role is required and the caller has none, including
 * anonymous callers and callers carrying an unrecognised role value.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No @Roles() metadata means this guard imposes no restriction.
    if (!required || required.length === 0) {
      return true;
    }

    const user = this.getUser(context);
    const allowed = required.some((role) => roleSatisfies(user?.role, role));
    if (!allowed) {
      throw new ForbiddenException(
        `This action requires one of the following roles: ${required.join(', ')}.`,
      );
    }
    return true;
  }

  /** Reads the user from either a GraphQL or an HTTP request. */
  private getUser(context: ExecutionContext): { role?: string } | undefined {
    // GraphQL executions expose getArgs(); plain HTTP ones do not. Nest's
    // ContextType union has no 'graphql' member, so detect it structurally.
    if (typeof (context as any).getArgs === 'function') {
      const ctx = GqlExecutionContext.create(context);
      return ctx.getContext()?.req?.user;
    }
    return context.switchToHttp().getRequest()?.user;
  }
}
