import { UserEntity, UserRole } from './db/User.entity';
import { User } from './gql/User.gql';

/**
 * Converts a DB entity to its public DTO.
 *
 * Only public fields are copied, so `passwordHash` can never leak into a
 * GraphQL response even if it is loaded on the entity.
 */
export function userEntityToUser(userEntity: UserEntity): User {
  return {
    id: userEntity.id,
    nickname: userEntity.nickname,
    role: userEntity.role ?? UserRole.USER,
  };
}
