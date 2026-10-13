import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import {  } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { randomBytes } from 'crypto';
import { UsersService } from '../../../users/users.service';
import { UserEntity } from '../../../users/db/User.entity';

/** Profile fields read from the GitHub API that this app relies on. */
export interface GithubProfile {
  githubId: string;
  login: string;
}

const AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';
const TOKEN_URL = 'https://github.com/login/oauth/access_token';
const USER_URL = 'https://api.github.com/user';
const SCOPE = 'read:user';

/** How long an issued state stays usable, in milliseconds. */
const STATE_TTL_MS = 10 * 60 * 1000;

interface PendingState {
  createdAt: number;
}

@Injectable()
export class GithubOauthService {
  /**
   * Outstanding OAuth `state` values.
   *
   * A real deployment would keep these in Redis so they survive across
   * instances and restarts; an in-process map is sufficient for the single
   * -instance development setup and keeps the CSRF protection testable.
   */
  private pendingStates = new Map<string, PendingState>();

  constructor(
    private readonly usersService: UsersService,
    private readonly httpService: HttpService,
  ) {}

  /** Issues a fresh, unpredictable OAuth state value. */
  createState(): string {
    const state = randomBytes(24).toString('hex');
    this.pendingStates.set(state, { createdAt: Date.now() });
    return state;
  }

  /**
   * Validates and consumes an OAuth state value.
   *
   * Single-use: a replayed state is rejected, as is an unknown or empty one.
   */
  consumeState(state: string): boolean {
    if (!state || typeof state !== 'string') {
      return false;
    }
    const entry = this.pendingStates.get(state);
    if (!entry) {
      return false;
    }
    // Always delete, so a failed/expired attempt cannot be retried either.
    this.pendingStates.delete(state);
    if (Date.now() - entry.createdAt > STATE_TTL_MS) {
      return false;
    }
    return true;
  }

  /** Builds the GitHub authorize URL the user is redirected to. */
  buildAuthorizeUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.clientId(),
      redirect_uri: this.callbackUrl(),
      scope: SCOPE,
      state,
    });
    return `${AUTHORIZE_URL}?${params.toString()}`;
  }

  /** Exchanges an authorization code for a GitHub access token. */
  async exchangeCodeForToken(code: string): Promise<string> {
    let response;
    try {
      response = await this.httpService
      .post(
        TOKEN_URL,
        new URLSearchParams({
          client_id: this.clientId(),
          client_secret: this.clientSecret(),
          code,
          redirect_uri: this.callbackUrl(),
        }).toString(),
        {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      )
      .toPromise();
    } catch (e) {
      // A rejected or expired code is a client problem rather than a server
      // fault, so report 401 instead of letting it surface as a 500.
      throw new HttpException(
        'GitHub rejected the authorization code.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const accessToken = response?.data?.access_token;
    if (!accessToken) {
      throw new HttpException(
        'GitHub did not return an access token.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return accessToken;
  }

  /** Loads the authenticated GitHub profile. */
  async fetchProfile(accessToken: string): Promise<GithubProfile> {
    const response = await this.httpService
      .get(USER_URL, {
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${accessToken}`,
          'User-Agent': 'fbg-server',
        },
      })
      .toPromise();

    const data = response?.data;
    if (!data?.id) {
      throw new HttpException(
        'GitHub profile did not include an id.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    return { githubId: String(data.id), login: String(data.login ?? '') };
  }

  /**
   * Finds or creates the local user for a GitHub profile.
   *
   * Linking is by GitHub id, so nickname collisions are resolved by the
   * UsersService rather than by overwriting an existing account.
   */
  async findOrCreateUser(profile: GithubProfile): Promise<UserEntity> {
    return this.usersService.findOrCreateExternalUser({
      nickname: profile.login,
      githubId: profile.githubId,
    });
  }

  private clientId(): string {
    const id = process.env.GITHUB_OAUTH_CLIENT_ID;
    if (!id) {
      throw new HttpException(
        'GITHUB_OAUTH_CLIENT_ID is not configured.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return id;
  }

  private clientSecret(): string {
    const secret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
    if (!secret) {
      throw new HttpException(
        'GITHUB_OAUTH_CLIENT_SECRET is not configured.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    return secret;
  }

  private callbackUrl(): string {
    return (
      process.env.GITHUB_OAUTH_CALLBACK_URL ||
      'http://localhost:3001/auth/github/callback'
    );
  }
}
