import { Resolver, Query, Mutation, Args, Int } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GamesService } from './games.service';
import { GameEntity } from './db/Game.entity';
import { Game, PublishGameInput, UpdateGameInput } from './gql/Game.gql';
import { CurrentUser, GqlAuthGuard } from '../internal/auth/GqlAuthGuard';
import { User } from '../users/gql/User.gql';

function toGql(entity: GameEntity): Game {
  return {
    id: entity.id,
    code: entity.code,
    name: entity.name,
    description: entity.description ?? undefined,
    minPlayers: entity.minPlayers,
    maxPlayers: entity.maxPlayers,
    published: entity.published,
    ownerId: entity.ownerId,
  };
}

@Resolver(() => Game)
export class GamesResolver {
  constructor(private gamesService: GamesService) {}

  /** Publishes a game owned by the calling user. */
  @Mutation(() => Game)
  @UseGuards(GqlAuthGuard)
  async publishGame(
    @CurrentUser() user: User,
    @Args({ name: 'game', type: () => PublishGameInput }) input: PublishGameInput,
  ): Promise<Game> {
    const entity = await this.gamesService.publish({
      ownerId: user.id,
      code: input.code,
      name: input.name,
      description: input.description,
      minPlayers: input.minPlayers,
      maxPlayers: input.maxPlayers,
    });
    return toGql(entity);
  }

  /** Updates a game; only its owner may do so. */
  @Mutation(() => Game)
  @UseGuards(GqlAuthGuard)
  async updateGame(
    @CurrentUser() user: User,
    @Args({ name: 'id', type: () => Int }) id: number,
    @Args({ name: 'game', type: () => UpdateGameInput }) input: UpdateGameInput,
  ): Promise<Game> {
    const entity = await this.gamesService.update(id, user.id, input);
    return toGql(entity);
  }

  /** Hides a game from listings; only its owner may do so. */
  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async unpublishGame(
    @CurrentUser() user: User,
    @Args({ name: 'id', type: () => Int }) id: number,
  ): Promise<boolean> {
    await this.gamesService.unpublish(id, user.id);
    return true;
  }

  /** All published games. */
  @Query(() => [Game])
  async games(): Promise<Game[]> {
    return (await this.gamesService.listPublished()).map(toGql);
  }

  /** A single published game by code. */
  @Query(() => Game)
  async game(@Args({ name: 'code', type: () => String }) code: string): Promise<Game> {
    return toGql(await this.gamesService.getByCode(code));
  }

  /** Games owned by the calling user, including unpublished ones. */
  @Query(() => [Game])
  @UseGuards(GqlAuthGuard)
  async myGames(@CurrentUser() user: User): Promise<Game[]> {
    return (await this.gamesService.listByOwner(user.id)).map(toGql);
  }
}
