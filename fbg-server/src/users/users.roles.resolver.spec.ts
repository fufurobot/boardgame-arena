import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users/users.service';
import { UsersModule } from '../users/users.module';
import { UsersResolver } from '../users/users.resolver';
import { FakeDbModule, closeDbConnection } from '../testing/dbUtil';
import { RoomsModule } from '../rooms/rooms.module';
import { MatchModule } from '../match/match.module';
import { UserRole } from '../users/db/User.entity';
import { User } from './gql/User.gql';

/**
 * Objective 3: role based authorization must actually protect operations, not
 * merely be available as a guard.
 */
describe('UsersResolver role administration', () => {
  let module: TestingModule;
  let resolver: UsersResolver;
  let service: UsersService;
  let seq = 0;

  function nick() {
    return `admin${seq++}`;
  }

  async function makeUser(role?: UserRole): Promise<User> {
    const id = await service.register({ nickname: nick(), password: 'password1234' });
    if (role) await service.setRole(id, role);
    return service.getById(id);
  }

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [FakeDbModule, UsersModule, RoomsModule, MatchModule],
    }).compile();
    resolver = module.get<UsersResolver>(UsersResolver);
    service = module.get<UsersService>(UsersService);
  });

  afterAll(async () => {
    closeDbConnection(module);
  });

  it('lets an admin change another user role', async () => {
    const admin = await makeUser(UserRole.ADMIN);
    const target = await makeUser();
    await resolver.setUserRole(admin, target.id, UserRole.MODERATOR);
    expect((await service.getById(target.id)).role).toEqual(UserRole.MODERATOR);
  });

  it('refuses a plain user changing roles', async () => {
    const plain = await makeUser();
    const target = await makeUser();
    await expect(
      resolver.setUserRole(plain, target.id, UserRole.ADMIN),
    ).rejects.toThrow();
    expect((await service.getById(target.id)).role).toEqual(UserRole.USER);
  });

  it('refuses a moderator changing roles', async () => {
    const mod = await makeUser(UserRole.MODERATOR);
    const target = await makeUser();
    await expect(
      resolver.setUserRole(mod, target.id, UserRole.ADMIN),
    ).rejects.toThrow();
  });

  it('an unprivileged caller cannot escalate themselves', async () => {
    const plain = await makeUser();
    await expect(
      resolver.setUserRole(plain, plain.id, UserRole.ADMIN),
    ).rejects.toThrow();
    expect((await service.getById(plain.id)).role).toEqual(UserRole.USER);
  });
});
