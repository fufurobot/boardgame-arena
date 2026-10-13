import { Resolver, Mutation, Args, Query } from '@nestjs/graphql';
import { User } from './gql/User.gql';
import { NewUserInput } from './gql/NewUserInput.gql';
import { NewUser } from './gql/NewUser.gql';
import { CredentialsInput } from './gql/CredentialsInput.gql';
import { UsersService } from './users.service';
import { CurrentUser, GqlAuthGuard } from '../internal/auth/GqlAuthGuard';
import { UseGuards } from '@nestjs/common';
import { Int } from '@nestjs/graphql';
import { UserRole } from './db/User.entity';
import { FbgJwtService } from '../internal/auth/FbgJwtService';
import { RoomsService } from '../rooms/rooms.service';

@Resolver(() => User)
export class UsersResolver {
  constructor(
    private usersService: UsersService,
    private roomsService: RoomsService,
    private readonly fbgJwtService: FbgJwtService,
  ) {}

  @Mutation(() => NewUser)
  async newUser(
    @Args({ name: 'user', type: () => NewUserInput }) userInput: NewUserInput,
  ): Promise<NewUser> {
    const userId = await this.usersService.newUser(userInput);
    const jwtToken = this.fbgJwtService.getToken({ userId });
    const newUser: NewUser = { jwtToken };
    return newUser;
  }

  /** Registers a new account with a password and logs it in. */
  @Mutation(() => NewUser)
  async register(
    @Args({ name: 'credentials', type: () => CredentialsInput })
    credentials: CredentialsInput,
  ): Promise<NewUser> {
    const userId = await this.usersService.register({
      nickname: credentials.nickname,
      password: credentials.password,
    });
    const jwtToken = this.fbgJwtService.getToken({ userId });
    return { jwtToken };
  }

  /** Exchanges a nickname and password for a jwt token. */
  @Mutation(() => NewUser)
  async login(
    @Args({ name: 'credentials', type: () => CredentialsInput })
    credentials: CredentialsInput,
  ): Promise<NewUser> {
    const user = await this.usersService.verifyCredentials(
      credentials.nickname,
      credentials.password,
    );
    const jwtToken = this.fbgJwtService.getToken({ userId: user.id });
    return { jwtToken };
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async updateUser(
    @CurrentUser() currentUser: User,
    @Args({ name: 'user', type: () => NewUserInput }) userInput: NewUserInput,
  ): Promise<boolean> {
    await this.usersService.updateUser(currentUser.id, userInput);
    await this.roomsService.notifyUserUpdated(currentUser.id);
    return true;
  }

  /**
   * Changes another user's role. Requires admin.
   *
   * Authorization is enforced in the service layer as well as by the guard,
   * so the rule holds even if this method is called from elsewhere.
   */
  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async setUserRole(
    @CurrentUser() currentUser: User,
    @Args({ name: 'userId', type: () => Int }) userId: number,
    @Args({ name: 'role', type: () => String }) role: string,
  ): Promise<boolean> {
    await this.usersService.setUserRoleAs(currentUser.id, userId, role as UserRole);
    return true;
  }

  @Query(() => User)
  @UseGuards(GqlAuthGuard)
  async user(@CurrentUser() user: User): Promise<User> {
    return this.usersService.getById(user.id);
  }
}
