import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { FakeDbModule, closeDbConnection } from '../testing/dbUtil';
import { UsersModule } from './users.module';
import { RoomsModule } from '../rooms/rooms.module';
import { MatchModule } from '../match/match.module';

/**
 * Objective 2: a login/register flow backed by sqlite.
 *
 * The existing `newUser` creates a user from a nickname alone, which means
 * anyone can claim any nickname and there is no way to prove identity. These
 * tests specify password-backed registration plus credential verification.
 */
describe('UsersService credentials', () => {
  let module: TestingModule;
  let service: UsersService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [FakeDbModule, UsersModule, RoomsModule, MatchModule],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  afterAll(async () => {
    closeDbConnection(module);
  });

  it('registers a user with a password without storing it in plaintext', async () => {
    const id = await service.register({
      nickname: 'alice',
      password: 'hunter2hunter2',
    });

    const entity = await service.getUserEntity(id);
    expect(entity.nickname).toEqual('alice');
    // A raw password must never be persisted.
    expect((entity as any).password).toBeUndefined();
    expect((entity as any).passwordHash).toBeDefined();
    expect((entity as any).passwordHash).not.toEqual('hunter2hunter2');
    expect((entity as any).passwordHash.length).toBeGreaterThan(20);
  });

  it('accepts the correct password', async () => {
    await service.register({ nickname: 'bob', password: 'correcthorse' });
    const user = await service.verifyCredentials('bob', 'correcthorse');
    expect(user.nickname).toEqual('bob');
  });

  it('rejects an incorrect password', async () => {
    await service.register({ nickname: 'carol', password: 'rightpassword' });
    await expect(
      service.verifyCredentials('carol', 'wrongpassword'),
    ).rejects.toThrow();
  });

  it('rejects an unknown nickname', async () => {
    await expect(
      service.verifyCredentials('nobody', 'whatever'),
    ).rejects.toThrow();
  });

  it('refuses to register a duplicate nickname', async () => {
    await service.register({ nickname: 'dave', password: 'password1234' });
    await expect(
      service.register({ nickname: 'dave', password: 'otherpassword' }),
    ).rejects.toThrow();
  });

  it('enforces a minimum password length', async () => {
    await expect(
      service.register({ nickname: 'shorty', password: 'abc' }),
    ).rejects.toThrow();
  });

  it('gives the same error for unknown user and wrong password', async () => {
    // Different messages would let an attacker enumerate valid nicknames.
    await service.register({ nickname: 'erin', password: 'password1234' });
    const unknown = await service
      .verifyCredentials('ghost', 'password1234')
      .catch((e) => e.message);
    const wrong = await service
      .verifyCredentials('erin', 'nope-nope-nope')
      .catch((e) => e.message);
    expect(unknown).toEqual(wrong);
  });

  it('hashes two identical passwords differently (salted)', async () => {
    const a = await service.register({ nickname: 'frank', password: 'samepassword' });
    const b = await service.register({ nickname: 'grace', password: 'samepassword' });
    const hashA = (await service.getUserEntity(a)).passwordHash;
    const hashB = (await service.getUserEntity(b)).passwordHash;
    expect(hashA).not.toEqual(hashB);
  });
});
