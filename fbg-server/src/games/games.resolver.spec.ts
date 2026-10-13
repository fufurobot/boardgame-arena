import { Test, TestingModule } from '@nestjs/testing';
import { GamesService } from './games.service';
import { GamesResolver } from './games.resolver';
import { GamesModule } from './games.module';
import { FakeDbModule, closeDbConnection } from '../testing/dbUtil';
import { UsersModule } from '../users/users.module';
import { UsersService } from '../users/users.service';
import { RoomsModule } from '../rooms/rooms.module';
import { MatchModule } from '../match/match.module';
import { User } from '../users/gql/User.gql';

/**
 * Objective 2 (resolver half): published games must be reachable over
 * GraphQL, and mutations must act on behalf of the authenticated user.
 */
describe('GamesResolver', () => {
  let module: TestingModule;
  let resolver: GamesResolver;
  let users: UsersService;
  let seq = 0;

  async function makeUser(): Promise<User> {
    const id = await users.register({
      nickname: `owner${seq++}`,
      password: 'password1234',
    });
    return users.getById(id);
  }

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [FakeDbModule, GamesModule, UsersModule, RoomsModule, MatchModule],
    }).compile();

    resolver = module.get<GamesResolver>(GamesResolver);
    users = module.get<UsersService>(UsersService);
  });

  afterAll(async () => {
    closeDbConnection(module);
  });

  it('publishes a game for the calling user', async () => {
    const user = await makeUser();
    const game = await resolver.publishGame(user, {
      code: 'resolvergame',
      name: 'Resolver Game',
      minPlayers: 2,
      maxPlayers: 4,
    });

    expect(game.code).toEqual('resolvergame');
    expect(game.ownerId).toEqual(user.id);
    expect(game.published).toEqual(true);
  });

  it('lists published games', async () => {
    const all = await resolver.games();
    expect(all.map((g) => g.code)).toContain('resolvergame');
  });

  it('finds a game by code', async () => {
    const game = await resolver.game('resolvergame');
    expect(game.name).toEqual('Resolver Game');
  });

  it('updates a game for its owner', async () => {
    const user = await makeUser();
    const created = await resolver.publishGame(user, {
      code: 'resolverupdate',
      name: 'Before',
      minPlayers: 1,
      maxPlayers: 2,
    });
    const updated = await resolver.updateGame(user, created.id, {
      name: 'After',
    });
    expect(updated.name).toEqual('After');
  });

  it('refuses an update from a different user', async () => {
    const owner = await makeUser();
    const stranger = await makeUser();
    const created = await resolver.publishGame(owner, {
      code: 'resolverprotect',
      name: 'Protected',
      minPlayers: 1,
      maxPlayers: 2,
    });
    await expect(
      resolver.updateGame(stranger, created.id, { name: 'Hijacked' }),
    ).rejects.toThrow();
  });

  it('unpublishes a game for its owner', async () => {
    const user = await makeUser();
    const created = await resolver.publishGame(user, {
      code: 'resolverunpub',
      name: 'Temp',
      minPlayers: 1,
      maxPlayers: 2,
    });
    await resolver.unpublishGame(user, created.id);
    const all = await resolver.games();
    expect(all.map((g) => g.code)).not.toContain('resolverunpub');
  });

  it('lists only the calling user own games', async () => {
    const user = await makeUser();
    await resolver.publishGame(user, {
      code: 'resolvermine',
      name: 'Mine',
      minPlayers: 1,
      maxPlayers: 2,
    });
    const mine = await resolver.myGames(user);
    expect(mine.map((g) => g.code)).toContain('resolvermine');
    expect(mine.every((g) => g.ownerId === user.id)).toEqual(true);
  });
});
