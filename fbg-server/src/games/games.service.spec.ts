import { Test, TestingModule } from '@nestjs/testing';
import { GamesService } from './games.service';
import { FakeDbModule, closeDbConnection } from '../testing/dbUtil';
import { GamesModule } from './games.module';
import { UsersModule } from '../users/users.module';
import { UsersService } from '../users/users.service';
import { RoomsModule } from '../rooms/rooms.module';
import { MatchModule } from '../match/match.module';

/**
 * Objective 2: `fbg-server` must not serve only bundled games; registered
 * users may publish their own games.
 *
 * Games carry a foreign key to their owner, so these tests create real users
 * rather than inventing ids.
 */
describe('GamesService', () => {
  let module: TestingModule;
  let games: GamesService;
  let users: UsersService;
  let userSeq = 0;

  /** Creates a distinct real user and returns its id. */
  async function makeUser(): Promise<number> {
    const nickname = `player${userSeq++}`;
    return users.register({ nickname, password: 'password1234' });
  }

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        FakeDbModule,
        GamesModule,
        UsersModule,
        RoomsModule,
        MatchModule,
      ],
    }).compile();

    games = module.get<GamesService>(GamesService);
    users = module.get<UsersService>(UsersService);
  });

  afterAll(async () => {
    closeDbConnection(module);
  });

  it('publishes a game owned by the publishing user', async () => {
    const ownerId = await makeUser();
    const game = await games.publish({
      ownerId,
      code: 'mygame',
      name: 'My Game',
      minPlayers: 2,
      maxPlayers: 4,
    });

    expect(game.code).toEqual('mygame');
    expect(game.ownerId).toEqual(ownerId);
    expect(game.published).toEqual(true);
  });

  it('rejects a duplicate game code', async () => {
    const ownerId = await makeUser();
    await games.publish({
      ownerId,
      code: 'dupe',
      name: 'Dupe',
      minPlayers: 1,
      maxPlayers: 2,
    });
    await expect(
      games.publish({
        ownerId,
        code: 'dupe',
        name: 'Dupe Again',
        minPlayers: 1,
        maxPlayers: 2,
      }),
    ).rejects.toThrow();
  });

  it('rejects an invalid game code', async () => {
    const ownerId = await makeUser();
    await expect(
      games.publish({
        ownerId,
        code: 'Not Valid!',
        name: 'Bad',
        minPlayers: 1,
        maxPlayers: 2,
      }),
    ).rejects.toThrow();
  });

  it('rejects an invalid player count range', async () => {
    const ownerId = await makeUser();
    await expect(
      games.publish({
        ownerId,
        code: 'badrange',
        name: 'Bad Range',
        minPlayers: 5,
        maxPlayers: 2,
      }),
    ).rejects.toThrow();
  });

  it('lists published games', async () => {
    const ownerId = await makeUser();
    await games.publish({
      ownerId,
      code: 'listed',
      name: 'Listed',
      minPlayers: 2,
      maxPlayers: 2,
    });
    const all = await games.listPublished();
    expect(all.map((g) => g.code)).toContain('listed');
  });

  it('looks up a game by code', async () => {
    const ownerId = await makeUser();
    await games.publish({
      ownerId,
      code: 'findme',
      name: 'Find Me',
      minPlayers: 1,
      maxPlayers: 6,
    });
    const found = await games.getByCode('findme');
    expect(found.name).toEqual('Find Me');
  });

  it('throws for an unknown game code', async () => {
    await expect(games.getByCode('doesnotexist')).rejects.toThrow();
  });

  it('lets the owner update their game', async () => {
    const ownerId = await makeUser();
    const g = await games.publish({
      ownerId,
      code: 'updatable',
      name: 'Old Name',
      minPlayers: 1,
      maxPlayers: 2,
    });
    await games.update(g.id, ownerId, { name: 'New Name' });
    expect((await games.getByCode('updatable')).name).toEqual('New Name');
  });

  it('refuses updates from a non-owner', async () => {
    const ownerId = await makeUser();
    const strangerId = await makeUser();
    const g = await games.publish({
      ownerId,
      code: 'protected',
      name: 'Protected',
      minPlayers: 1,
      maxPlayers: 2,
    });
    await expect(
      games.update(g.id, strangerId, { name: 'Hijacked' }),
    ).rejects.toThrow();
  });

  it('lets the owner unpublish their game', async () => {
    const ownerId = await makeUser();
    const g = await games.publish({
      ownerId,
      code: 'tempgame',
      name: 'Temp',
      minPlayers: 1,
      maxPlayers: 2,
    });
    await games.unpublish(g.id, ownerId);
    const all = await games.listPublished();
    expect(all.map((x) => x.code)).not.toContain('tempgame');
  });

  it('refuses unpublish from a non-owner', async () => {
    const ownerId = await makeUser();
    const strangerId = await makeUser();
    const g = await games.publish({
      ownerId,
      code: 'keepgame',
      name: 'Keep',
      minPlayers: 1,
      maxPlayers: 2,
    });
    await expect(games.unpublish(g.id, strangerId)).rejects.toThrow();
  });

  it('lists games owned by a given user', async () => {
    const ownerId = await makeUser();
    await games.publish({
      ownerId,
      code: 'mine1',
      name: 'Mine 1',
      minPlayers: 1,
      maxPlayers: 2,
    });
    const mine = await games.listByOwner(ownerId);
    expect(mine.map((g) => g.code)).toContain('mine1');
    expect(mine.every((g) => g.ownerId === ownerId)).toEqual(true);
  });
});
