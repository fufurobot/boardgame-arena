import { Test, TestingModule } from '@nestjs/testing';
import { GamesService } from './games.service';
import { FakeDbModule, closeDbConnection } from '../testing/dbUtil';
import { GamesModule } from './games.module';
import { UsersModule } from '../users/users.module';
import { RoomsModule } from '../rooms/rooms.module';
import { MatchModule } from '../match/match.module';

/**
 * Objective 2: `fbg-server` must not serve only bundled games; registered
 * users may publish their own games.
 */
describe('GamesService', () => {
  let module: TestingModule;
  let games: GamesService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [FakeDbModule, GamesModule, UsersModule, RoomsModule, MatchModule],
    }).compile();

    games = module.get<GamesService>(GamesService);
  });

  afterAll(async () => {
    closeDbConnection(module);
  });

  it('publishes a game owned by the publishing user', async () => {
    const game = await games.publish({
      ownerId: 1,
      code: 'mygame',
      name: 'My Game',
      minPlayers: 2,
      maxPlayers: 4,
    });

    expect(game.code).toEqual('mygame');
    expect(game.ownerId).toEqual(1);
    expect(game.published).toEqual(true);
  });

  it('rejects a duplicate game code', async () => {
    await games.publish({
      ownerId: 1,
      code: 'dupe',
      name: 'Dupe',
      minPlayers: 1,
      maxPlayers: 2,
    });
    await expect(
      games.publish({
        ownerId: 2,
        code: 'dupe',
        name: 'Dupe Again',
        minPlayers: 1,
        maxPlayers: 2,
      }),
    ).rejects.toThrow();
  });

  it('rejects an invalid game code', async () => {
    await expect(
      games.publish({
        ownerId: 1,
        code: 'Not Valid!',
        name: 'Bad',
        minPlayers: 1,
        maxPlayers: 2,
      }),
    ).rejects.toThrow();
  });

  it('rejects an invalid player count range', async () => {
    await expect(
      games.publish({
        ownerId: 1,
        code: 'badrange',
        name: 'Bad Range',
        minPlayers: 5,
        maxPlayers: 2,
      }),
    ).rejects.toThrow();
  });

  it('lists published games', async () => {
    await games.publish({
      ownerId: 1,
      code: 'listed',
      name: 'Listed',
      minPlayers: 2,
      maxPlayers: 2,
    });
    const all = await games.listPublished();
    expect(all.map((g) => g.code)).toContain('listed');
  });

  it('looks up a game by code', async () => {
    await games.publish({
      ownerId: 1,
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
    const g = await games.publish({
      ownerId: 7,
      code: 'updatable',
      name: 'Old Name',
      minPlayers: 1,
      maxPlayers: 2,
    });
    await games.update(g.id, 7, { name: 'New Name' });
    expect((await games.getByCode('updatable')).name).toEqual('New Name');
  });

  it('refuses updates from a non-owner', async () => {
    const g = await games.publish({
      ownerId: 8,
      code: 'protected',
      name: 'Protected',
      minPlayers: 1,
      maxPlayers: 2,
    });
    await expect(games.update(g.id, 9, { name: 'Hijacked' })).rejects.toThrow();
  });

  it('lets the owner unpublish their game', async () => {
    const g = await games.publish({
      ownerId: 10,
      code: 'tempgame',
      name: 'Temp',
      minPlayers: 1,
      maxPlayers: 2,
    });
    await games.unpublish(g.id, 10);
    const all = await games.listPublished();
    expect(all.map((x) => x.code)).not.toContain('tempgame');
  });

  it('refuses unpublish from a non-owner', async () => {
    const g = await games.publish({
      ownerId: 11,
      code: 'keepgame',
      name: 'Keep',
      minPlayers: 1,
      maxPlayers: 2,
    });
    await expect(games.unpublish(g.id, 12)).rejects.toThrow();
  });

  it('lists games owned by a given user', async () => {
    await games.publish({
      ownerId: 42,
      code: 'mine1',
      name: 'Mine 1',
      minPlayers: 1,
      maxPlayers: 2,
    });
    const mine = await games.listByOwner(42);
    expect(mine.map((g) => g.code)).toContain('mine1');
    expect(mine.every((g) => g.ownerId === 42)).toEqual(true);
  });
});
