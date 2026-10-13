import { Injectable, HttpStatus, HttpException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GameEntity } from './db/Game.entity';

/** Game codes become part of URLs and room identifiers. */
const VALID_CODE_REGEX = /^[a-z][a-z0-9]{1,30}$/;

const MAX_NAME_LENGTH = 60;

/** Input for publishing a new game. */
export interface PublishGameInput {
  ownerId: number;
  code: string;
  name: string;
  description?: string;
  minPlayers: number;
  maxPlayers: number;
}

/** Fields a game owner may change after publishing. */
export interface UpdateGameInput {
  name?: string;
  description?: string;
  minPlayers?: number;
  maxPlayers?: number;
  published?: boolean;
}

@Injectable()
export class GamesService {
  constructor(
    @InjectRepository(GameEntity)
    private gamesRepository: Repository<GameEntity>,
  ) {}

  /** Publishes a new game owned by `ownerId`. */
  async publish(input: PublishGameInput): Promise<GameEntity> {
    this.checkValidCode(input.code);
    this.checkValidName(input.name);
    this.checkValidPlayerRange(input.minPlayers, input.maxPlayers);

    const existing = await this.gamesRepository.findOneBy({ code: input.code });
    if (existing) {
      throw new HttpException(
        `Game code is already taken: ${input.code}`,
        HttpStatus.CONFLICT,
      );
    }

    const game = new GameEntity();
    game.code = input.code;
    game.name = input.name;
    game.description = input.description ?? null;
    game.minPlayers = input.minPlayers;
    game.maxPlayers = input.maxPlayers;
    game.published = true;
    game.ownerId = input.ownerId;
    return this.gamesRepository.save(game);
  }

  /** All published games, newest first. */
  async listPublished(): Promise<GameEntity[]> {
    return this.gamesRepository.find({
      where: { published: true },
      order: { id: 'DESC' },
    });
  }

  /** Every game owned by a user, including unpublished ones. */
  async listByOwner(ownerId: number): Promise<GameEntity[]> {
    return this.gamesRepository.find({
      where: { ownerId },
      order: { id: 'DESC' },
    });
  }

  /** A published game by code. */
  async getByCode(code: string): Promise<GameEntity> {
    const game = await this.gamesRepository.findOneBy({ code, published: true });
    if (!game) {
      throw new HttpException(
        `Game "${code}" does not exist.`,
        HttpStatus.NOT_FOUND,
      );
    }
    return game;
  }

  /** A game by primary key, published or not. */
  async getById(id: number): Promise<GameEntity> {
    const game = await this.gamesRepository.findOneBy({ id });
    if (!game) {
      throw new HttpException(
        `Game id "${id}" does not exist.`,
        HttpStatus.NOT_FOUND,
      );
    }
    return game;
  }

  /** True when the given user owns the given game. */
  async isOwner(gameId: number, userId: number): Promise<boolean> {
    const game = await this.getById(gameId);
    return game.ownerId === userId;
  }

  /** Updates a game, but only when `userId` is its owner. */
  async update(
    gameId: number,
    userId: number,
    changes: UpdateGameInput,
  ): Promise<GameEntity> {
    const game = await this.getOwnedGame(gameId, userId);

    if (changes.name !== undefined) {
      this.checkValidName(changes.name);
      game.name = changes.name;
    }
    if (changes.description !== undefined) {
      game.description = changes.description;
    }
    if (
      changes.minPlayers !== undefined ||
      changes.maxPlayers !== undefined
    ) {
      const min = changes.minPlayers ?? game.minPlayers;
      const max = changes.maxPlayers ?? game.maxPlayers;
      this.checkValidPlayerRange(min, max);
      game.minPlayers = min;
      game.maxPlayers = max;
    }
    if (changes.published !== undefined) {
      game.published = changes.published;
    }

    return this.gamesRepository.save(game);
  }

  /** Hides a game from listings, but only for its owner. */
  async unpublish(gameId: number, userId: number): Promise<void> {
    await this.getOwnedGame(gameId, userId);
    await this.gamesRepository.update(gameId, { published: false });
  }

  /** Loads a game, enforcing ownership. */
  private async getOwnedGame(
    gameId: number,
    userId: number,
  ): Promise<GameEntity> {
    const game = await this.getById(gameId);
    if (game.ownerId !== userId) {
      // 403 rather than 404: the game's existence is public information,
      // but the caller is not allowed to modify it.
      throw new HttpException(
        'Only the game owner may modify this game.',
        HttpStatus.FORBIDDEN,
      );
    }
    return game;
  }

  private checkValidCode(code: string) {
    if (!code || !code.match(VALID_CODE_REGEX)) {
      throw new HttpException(
        `Invalid game code: ${code}. Use lowercase letters and digits, starting with a letter.`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private checkValidName(name: string) {
    if (!name || name.length < 1) {
      throw new HttpException('Game name is required', HttpStatus.BAD_REQUEST);
    }
    if (name.length > MAX_NAME_LENGTH) {
      throw new HttpException(
        `Game name is too long: ${name.length} > ${MAX_NAME_LENGTH}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private checkValidPlayerRange(min: number, max: number) {
    if (!Number.isInteger(min) || !Number.isInteger(max)) {
      throw new HttpException(
        'Player counts must be integers.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (min < 1) {
      throw new HttpException(
        `Minimum players must be at least 1: ${min}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (max < min) {
      throw new HttpException(
        `Maximum players (${max}) must be at least the minimum (${min}).`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
