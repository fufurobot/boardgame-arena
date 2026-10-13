import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { FakeDbModule, closeDbConnection } from '../testing/dbUtil';
import { UsersModule } from './users.module';
import { UsersResolver } from './users.resolver';
import { JwtService } from '@nestjs/jwt';
import { JwtPayload } from '../internal/auth/definitions';
import { RoomsModule } from '../rooms/rooms.module';
import { MatchModule } from '../match/match.module';

/**
 * Objective 2 (resolver half): the register/login flow must be reachable over
 * GraphQL, not just from the service layer.
 */
describe('UsersResolver auth mutations', () => {
  let module: TestingModule;
  let resolver: UsersResolver;
  let service: UsersService;
  let jwtService: JwtService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [FakeDbModule, UsersModule, RoomsModule, MatchModule],
    }).compile();

    resolver = module.get<UsersResolver>(UsersResolver);
    service = module.get<UsersService>(UsersService);
    jwtService = module.get<JwtService>(JwtService);
  });

  afterAll(async () => {
    closeDbConnection(module);
  });

  it('registers a user and returns a usable jwt token', async () => {
    const result = await resolver.register({
      nickname: 'reguser',
      password: 'password1234',
    });

    expect(typeof result.jwtToken).toEqual('string');
    const payload = jwtService.decode(result.jwtToken) as JwtPayload;
    expect((await service.getById(payload.userId)).nickname).toEqual('reguser');
  });

  it('refuses to register a duplicate nickname', async () => {
    await resolver.register({ nickname: 'dupreg', password: 'password1234' });
    await expect(
      resolver.register({ nickname: 'dupreg', password: 'password1234' }),
    ).rejects.toThrow();
  });

  it('logs in with correct credentials and returns a jwt token', async () => {
    await resolver.register({ nickname: 'loginuser', password: 'password1234' });
    const result = await resolver.login({
      nickname: 'loginuser',
      password: 'password1234',
    });

    const payload = jwtService.decode(result.jwtToken) as JwtPayload;
    expect((await service.getById(payload.userId)).nickname).toEqual('loginuser');
  });

  it('refuses to log in with a bad password', async () => {
    await resolver.register({ nickname: 'badlogin', password: 'password1234' });
    await expect(
      resolver.login({ nickname: 'badlogin', password: 'wrongpassword' }),
    ).rejects.toThrow();
  });

  it('never exposes the password hash through the user query', async () => {
    await resolver.register({ nickname: 'hidden', password: 'password1234' });
    const token = (
      await resolver.login({ nickname: 'hidden', password: 'password1234' })
    ).jwtToken;
    const payload = jwtService.decode(token) as JwtPayload;
    const user = await resolver.user(await service.getById(payload.userId));
    expect(JSON.stringify(user)).not.toContain('passwordHash');
  });
});
