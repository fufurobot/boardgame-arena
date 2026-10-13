import { Test, TestingModule } from '@nestjs/testing';
import {  } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { GithubOauthService } from './github-oauth.service';
import { UsersService } from '../../../users/users.service';
import { UsersModule } from '../../../users/users.module';
import { FakeDbModule, closeDbConnection } from '../../../testing/dbUtil';
import { RoomsModule } from '../../../rooms/rooms.module';
import { MatchModule } from '../../../match/match.module';
import { UserRole } from '../../../users/db/User.entity';

/**
 * Objective 4: log in with GitHub.
 *
 * The security-critical parts are the OAuth `state` check (which prevents
 * CSRF/login-CSRF) and account linking, so those are specified here.
 */
describe('GithubOauthService', () => {
  let module: TestingModule;
  let service: GithubOauthService;
  let users: UsersService;

  beforeAll(async () => {
    // The authorize URL is built from configuration; supply it so this test
    // does not depend on the ambient environment.
    process.env.GITHUB_OAUTH_CLIENT_ID = process.env.GITHUB_OAUTH_CLIENT_ID || 'test-client-id';
    process.env.GITHUB_OAUTH_CALLBACK_URL =
      process.env.GITHUB_OAUTH_CALLBACK_URL || 'http://localhost:3001/auth/github/callback';

    module = await Test.createTestingModule({
      imports: [FakeDbModule, UsersModule, RoomsModule, MatchModule, HttpModule],
      providers: [GithubOauthService],
    }).compile();
    service = module.get(GithubOauthService);
    users = module.get(UsersService);
  });

  afterAll(async () => {
    closeDbConnection(module);
  });

  it('issues a random state that differs per call', () => {
    const a = service.createState();
    const b = service.createState();
    expect(a).not.toEqual(b);
    expect(a.length).toBeGreaterThanOrEqual(16);
  });

  it('accepts a state it issued', () => {
    const state = service.createState();
    expect(service.consumeState(state)).toEqual(true);
  });

  it('rejects an unknown state', () => {
    expect(service.consumeState('forged-state-value')).toEqual(false);
  });

  it('rejects a state that was already used (no replay)', () => {
    const state = service.createState();
    expect(service.consumeState(state)).toEqual(true);
    expect(service.consumeState(state)).toEqual(false);
  });

  it('rejects an empty or missing state', () => {
    expect(service.consumeState('')).toEqual(false);
    expect(service.consumeState(undefined as unknown as string)).toEqual(false);
  });

  it('creates a local user on first GitHub login', async () => {
    const user = await service.findOrCreateUser({
      githubId: '12345',
      login: 'octocat',
    });
    expect(user.nickname).toEqual('octocat');
    expect(user.role).toEqual(UserRole.USER);
    const entity = await users.getUserEntity(user.id);
    expect(entity.githubId).toEqual('12345');
  });

  it('returns the same user on subsequent logins', async () => {
    const first = await service.findOrCreateUser({
      githubId: '999',
      login: 'repeat',
    });
    const second = await service.findOrCreateUser({
      githubId: '999',
      login: 'repeat',
    });
    expect(second.id).toEqual(first.id);
  });

  it('does not collide when two GitHub logins share a nickname', async () => {
    const a = await service.findOrCreateUser({ githubId: 'a1', login: 'same' });
    const b = await service.findOrCreateUser({ githubId: 'b1', login: 'same' });
    expect(a.id).not.toEqual(b.id);
    expect(a.nickname).not.toEqual(b.nickname);
  });

  it('sanitizes a GitHub login that is not a valid nickname', async () => {
    const user = await service.findOrCreateUser({
      githubId: 'weird',
      login: 'some-user!!name',
    });
    expect(user.nickname).toMatch(/^[A-Za-z0-9_]+$/);
    expect(user.nickname.length).toBeLessThanOrEqual(15);
  });

  it('never stores a password hash for an OAuth user', async () => {
    const user = await service.findOrCreateUser({
      githubId: 'nopass',
      login: 'nopassuser',
    });
    const entity = await users.getUserEntity(user.id);
    expect(entity.passwordHash ?? null).toBeNull();
  });

  it('builds an authorize URL containing the client id, redirect and state', () => {
    const url = service.buildAuthorizeUrl('the-state-value');
    expect(url).toContain('github.com/login/oauth/authorize');
    expect(url).toContain('state=the-state-value');
    expect(url).toContain('client_id=');
    expect(url).toContain('redirect_uri=');
    expect(url).toContain('scope=');
  });
});
