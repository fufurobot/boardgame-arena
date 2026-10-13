import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard, ROLES_KEY } from './RolesGuard';
import { UserRole } from '../../users/db/User.entity';

/**
 * Objective 3: role based authorization.
 *
 * Authentication exists (JwtStrategy/GqlAuthGuard) but nothing checks what an
 * authenticated user is *allowed* to do. This guard closes that gap.
 */
function mockContext(user: any): any {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as any;
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RolesGuard, Reflector],
    }).compile();
    guard = module.get(RolesGuard);
    reflector = module.get(Reflector);
  });

  it('allows access when no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(mockContext({ role: UserRole.USER }))).toEqual(true);
  });

  it('allows a user holding the required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    expect(guard.canActivate(mockContext({ role: UserRole.ADMIN }))).toEqual(true);
  });

  it('denies a user lacking the required role', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    expect(() => guard.canActivate(mockContext({ role: UserRole.USER }))).toThrow(
      ForbiddenException,
    );
  });

  it('denies an anonymous request', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.USER]);
    expect(() => guard.canActivate(mockContext(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('allows any of several accepted roles', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue([UserRole.ADMIN, UserRole.MODERATOR]);
    expect(
      guard.canActivate(mockContext({ role: UserRole.MODERATOR })),
    ).toEqual(true);
  });

  it('an unknown role value is denied, not trusted', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([UserRole.ADMIN]);
    expect(() => guard.canActivate(mockContext({ role: 'superuser' }))).toThrow(
      ForbiddenException,
    );
  });

  it('reads required roles from the ROLES_KEY metadata', () => {
    const spy = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([]);
    guard.canActivate(mockContext({ role: UserRole.USER }));
    expect(spy).toHaveBeenCalledWith(ROLES_KEY, expect.anything());
  });
});
