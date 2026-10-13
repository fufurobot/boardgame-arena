import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { FakeDbModule, closeDbConnection } from '../testing/dbUtil';
import { UsersModule } from './users.module';
import { RoomsModule } from '../rooms/rooms.module';
import { MatchModule } from '../match/match.module';
import { UserRole } from './db/User.entity';

/**
 * Objective 3: roles must be assignable, persisted and enforced, not merely
 * stored on the entity.
 */
describe('UsersService roles', () => {
  let module: TestingModule;
  let service: UsersService;
  let seq = 0;

  function nick() {
    return `roleuser${seq++}`;
  }

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [FakeDbModule, UsersModule, RoomsModule, MatchModule],
    }).compile();
    service = module.get<UsersService>(UsersService);
  });

  afterAll(async () => {
    closeDbConnection(module);
  });

  it('gives a newly registered user the least-privileged role', async () => {
    const id = await service.register({ nickname: nick(), password: 'password1234' });
    const entity = await service.getUserEntity(id);
    expect(entity.role).toEqual(UserRole.USER);
  });

  it('exposes the role through the public user DTO', async () => {
    const id = await service.register({ nickname: nick(), password: 'password1234' });
    expect((await service.getById(id)).role).toEqual(UserRole.USER);
  });

  it('promotes a user to admin', async () => {
    const id = await service.register({ nickname: nick(), password: 'password1234' });
    await service.setRole(id, UserRole.ADMIN);
    expect((await service.getUserEntity(id)).role).toEqual(UserRole.ADMIN);
  });

  it('demotes an admin back to user', async () => {
    const id = await service.register({ nickname: nick(), password: 'password1234' });
    await service.setRole(id, UserRole.ADMIN);
    await service.setRole(id, UserRole.USER);
    expect((await service.getUserEntity(id)).role).toEqual(UserRole.USER);
  });

  it('refuses an unknown role', async () => {
    const id = await service.register({ nickname: nick(), password: 'password1234' });
    await expect(service.setRole(id, 'root' as UserRole)).rejects.toThrow();
  });

  it('reports a user permission set by role', async () => {
    const id = await service.register({ nickname: nick(), password: 'password1234' });
    expect(await service.hasRole(id, UserRole.USER)).toEqual(true);
    expect(await service.hasRole(id, UserRole.ADMIN)).toEqual(false);

    await service.setRole(id, UserRole.ADMIN);
    expect(await service.hasRole(id, UserRole.ADMIN)).toEqual(true);
  });

  it('treats admin as satisfying a moderator requirement', async () => {
    const id = await service.register({ nickname: nick(), password: 'password1234' });
    await service.setRole(id, UserRole.ADMIN);
    expect(await service.hasRole(id, UserRole.MODERATOR)).toEqual(true);
  });

  it('does not let a moderator satisfy an admin requirement', async () => {
    const id = await service.register({ nickname: nick(), password: 'password1234' });
    await service.setRole(id, UserRole.MODERATOR);
    expect(await service.hasRole(id, UserRole.ADMIN)).toEqual(false);
  });
});
