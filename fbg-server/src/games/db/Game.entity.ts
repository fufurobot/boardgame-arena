import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  Index,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/db/User.entity';

/**
 * A game published by a registered user.
 *
 * Before this existed `fbg-server` only recognised the games bundled into the
 * web client; `gameCode` on a room was an unvalidated free-form string. A row
 * here means "this code is a real, published game, owned by this user".
 */
@Entity()
export class GameEntity {
  @PrimaryGeneratedColumn()
  id: number;

  /** Short identifier used by rooms, e.g. `chess`. */
  @Index({ unique: true })
  @Column()
  code: string;

  @Column()
  name: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ type: 'int', default: 2 })
  minPlayers: number;

  @Column({ type: 'int', default: 2 })
  maxPlayers: number;

  /** Whether the game is visible to other users. */
  @Column({ type: 'boolean', default: true })
  published: boolean;

  @Column()
  ownerId: number;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: UserEntity;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
