import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { RoomMembershipEntity } from '../../rooms/db/RoomMembership.entity';

/** Roles a user can hold. */
export enum UserRole {
  USER = 'user',
  MODERATOR = 'moderator',
  ADMIN = 'admin',
}

@Entity()
export class UserEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column()
  nickname: string;

  /**
   * Salted scrypt hash. Nullable because users created through the legacy
   * nickname-only path (and future OAuth-only users) have no password.
   * `select: false` keeps the hash out of ordinary queries so it is not
   * accidentally serialized into a GraphQL response.
   */
  @Column({ type: 'varchar', nullable: true, select: false })
  passwordHash: string | null;

  /** Role granted to this user. Defaults to the least-privileged role. */
  @Column({ type: 'varchar', default: UserRole.USER })
  role: UserRole;

  /**
   * GitHub numeric id, when the account was linked via GitHub OAuth.
   * Unique-when-present, so one GitHub account maps to one local user.
   */
  @Index({ unique: true, where: 'githubId IS NOT NULL' })
  @Column({ type: 'varchar', nullable: true })
  githubId: string | null;

  @OneToMany(() => RoomMembershipEntity, (membership) => membership.user)
  public roomMemberships!: RoomMembershipEntity[];
}
