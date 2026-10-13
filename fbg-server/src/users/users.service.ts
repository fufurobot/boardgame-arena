import { Injectable, HttpStatus, HttpException } from '@nestjs/common';
import { NewUserInput } from './gql/NewUserInput.gql';
import { User } from './gql/User.gql';
import { UserEntity, UserRole } from '../users/db/User.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { userEntityToUser } from './UserUtil';
import { hashPassword, verifyPassword, MIN_PASSWORD_LENGTH } from './password';
import { isKnownRole, roleSatisfies } from '../internal/auth/roles';

const VALID_NICKNAME_REGEX = /^[A-Za-z0-9_]*$/;

/** Input for registering a new account with a password. */
export interface RegisterInput {
  nickname: string;
  password: string;
}

/**
 * Error message shared by every failed login.
 *
 * Deliberately identical for "no such nickname" and "wrong password":
 * distinguishing them would let an attacker enumerate valid accounts.
 */
const INVALID_CREDENTIALS = 'Invalid nickname or password.';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(UserEntity)
    private usersRepository: Repository<UserEntity>,
  ) {}

  /** Creates a new user, returns its id. */
  async newUser(user: NewUserInput): Promise<number> {
    this.checkValidUser(user);
    const userEntity = new UserEntity();
    userEntity.nickname = user.nickname;
    userEntity.role = UserRole.USER;
    userEntity.githubId = null;
    await this.usersRepository.insert(userEntity);
    return userEntity.id;
  }

  /**
   * Registers a new account with a password, returning its id.
   *
   * The password is stored only as a salted scrypt hash.
   */
  async register(input: RegisterInput): Promise<number> {
    this.checkValidUser(input);
    this.checkValidPassword(input);

    const existing = await this.usersRepository.findOneBy({
      nickname: input.nickname,
    });
    if (existing) {
      throw new HttpException(
        `Nickname is already taken: ${input.nickname}`,
        HttpStatus.CONFLICT,
      );
    }

    const userEntity = new UserEntity();
    userEntity.nickname = input.nickname;
    userEntity.passwordHash = await hashPassword(input.password);
    userEntity.role = UserRole.USER;
    userEntity.githubId = null;
    await this.usersRepository.insert(userEntity);
    return userEntity.id;
  }

  /**
   * Verifies a nickname/password pair, returning the user on success.
   *
   * Throws the same error for an unknown nickname and a bad password.
   */
  async verifyCredentials(nickname: string, password: string): Promise<User> {
    const entity = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.nickname = :nickname', { nickname })
      .getOne();

    const stored = entity?.passwordHash ?? null;
    // Hash anyway when the user is missing so that a missing user and a wrong
    // password take comparable time, avoiding a timing oracle.
    const ok = stored
      ? await verifyPassword(password, stored)
      : await this.dummyVerify(password);

    if (!entity || !ok) {
      throw new HttpException(INVALID_CREDENTIALS, HttpStatus.UNAUTHORIZED);
    }
    return userEntityToUser(entity);
  }

  /** Burns comparable CPU to a real verification, always returning false. */
  private async dummyVerify(password: string): Promise<boolean> {
    await hashPassword(password);
    return false;
  }

  /** Gets a user DTO by id. */
  async getById(id: number): Promise<User> {
    const userEntity = await this.getUserEntity(id);
    return userEntityToUser(userEntity);
  }

  /**
   * Gets a user DB entity by id.
   *
   * Includes the password hash, unlike the default column selection.
   */
  async getUserEntity(id: number): Promise<UserEntity> {
    const userEntity = await this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id })
      .getOne();
    if (!userEntity) {
      throw new HttpException(
        `User id "${id}" does not exist.`,
        HttpStatus.BAD_REQUEST,
      );
    }
    return userEntity;
  }

  /** Gets a user DB entity by nickname, or null when absent. */
  async findByNickname(nickname: string): Promise<UserEntity | null> {
    return this.usersRepository.findOneBy({ nickname });
  }

  /** Gets a user DB entity by linked GitHub id, or null when absent. */
  async findByGithubId(githubId: string): Promise<UserEntity | null> {
    return this.usersRepository.findOneBy({ githubId });
  }

  /**
   * Creates a user for an external identity (e.g. GitHub OAuth), or returns
   * the existing one already linked to that identity.
   */
  async findOrCreateExternalUser(params: {
    nickname: string;
    githubId: string;
  }): Promise<UserEntity> {
    const linked = await this.findByGithubId(params.githubId);
    if (linked) {
      return linked;
    }

    // Nicknames are unique-indexed, so pick one that is actually free.
    const nickname = await this.availableNickname(params.nickname);

    const userEntity = new UserEntity();
    userEntity.nickname = nickname;
    userEntity.passwordHash = null;
    userEntity.role = UserRole.USER;
    userEntity.githubId = params.githubId;
    return this.usersRepository.save(userEntity);
  }

  /** Appends a numeric suffix until the nickname is free. */
  private async availableNickname(desired: string): Promise<string> {
    const cleaned = (desired || 'user').replace(/[^A-Za-z0-9_]/g, '');
    const base = cleaned.slice(0, 15) || 'user';
    let candidate = base;
    let suffix = 1;
    while (await this.findByNickname(candidate)) {
      const tag = String(suffix++);
      candidate = `${base.slice(0, 15 - tag.length)}${tag}`;
    }
    return candidate;
  }

  /** Updates user information. */
  async updateUser(userId: number, user: NewUserInput): Promise<void> {
    this.checkValidUser(user);
    const partialEntity = new UserEntity();
    partialEntity.nickname = user.nickname;
    await this.usersRepository.update(userId, partialEntity);
  }

  /** Sets a user's role. Used by role-based authorization (objective 3). */
  async setRole(userId: number, role: UserRole): Promise<void> {
    if (!isKnownRole(role)) {
      throw new HttpException(`Unknown role: ${role}`, HttpStatus.BAD_REQUEST);
    }
    await this.usersRepository.update(userId, { role });
  }

  /**
   * True when the user's role satisfies `required`.
   *
   * Uses the role hierarchy, so an admin satisfies a moderator requirement.
   */
  async hasRole(userId: number, required: UserRole): Promise<boolean> {
    const entity = await this.getUserEntity(userId);
    return roleSatisfies(entity.role, required);
  }

  /**
   * Changes another user's role, authorized as `actorId`.
   *
   * Enforces admin in the service layer so the rule cannot be bypassed by a
   * caller that forgets the guard.
   */
  async setUserRoleAs(
    actorId: number,
    targetUserId: number,
    role: UserRole,
  ): Promise<void> {
    if (!(await this.hasRole(actorId, UserRole.ADMIN))) {
      throw new HttpException(
        'Only an admin may change user roles.',
        HttpStatus.FORBIDDEN,
      );
    }
    if (!isKnownRole(role)) {
      throw new HttpException(`Unknown role: ${role}`, HttpStatus.BAD_REQUEST);
    }
    await this.setRole(targetUserId, role);
  }

  /** Update user's information. */
  private checkValidUser(user: NewUserInput) {
    if (!user) {
      throw new HttpException('User is required', HttpStatus.BAD_REQUEST);
    }
    if (!user.nickname || user.nickname.length < 1) {
      throw new HttpException(
        `Nickname is too short: ${user.nickname}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (user.nickname.length > 15) {
      throw new HttpException(
        `Nickname is too long: ${user.nickname}`,
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!user.nickname.match(VALID_NICKNAME_REGEX)) {
      throw new HttpException(
        `Only alphanumerics are allowed: ${user.nickname}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  private checkValidPassword(input: RegisterInput) {
    if (!input.password || input.password.length < MIN_PASSWORD_LENGTH) {
      throw new HttpException(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
