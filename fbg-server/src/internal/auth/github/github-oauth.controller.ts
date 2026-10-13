import { Controller, Get, Query, Res, HttpStatus, HttpException } from '@nestjs/common';
import { Response } from 'express';
import { GithubOauthService } from './github-oauth.service';
import { FbgJwtService } from '../FbgJwtService';

/**
 * GitHub OAuth endpoints.
 *
 * `/auth/github` redirects to GitHub; `/auth/github/callback` completes the
 * flow and hands the client a jwt token.
 */
@Controller('auth/github')
export class GithubOauthController {
  constructor(
    private readonly githubOauth: GithubOauthService,
    private readonly fbgJwtService: FbgJwtService,
  ) {}

  /** Starts the OAuth flow by redirecting to GitHub. */
  @Get()
  start(@Res() res: Response): void {
    const state = this.githubOauth.createState();
    res.redirect(this.githubOauth.buildAuthorizeUrl(state));
  }

  /**
   * Completes the OAuth flow.
   *
   * Verifies `state` before exchanging the code, so a forged callback cannot
   * log the caller in as somebody else.
   */
  @Get('callback')
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Res() res: Response,
  ): Promise<void> {
    if (!this.githubOauth.consumeState(state)) {
      throw new HttpException('Invalid OAuth state.', HttpStatus.BAD_REQUEST);
    }
    if (!code) {
      throw new HttpException('Missing OAuth code.', HttpStatus.BAD_REQUEST);
    }

    const accessToken = await this.githubOauth.exchangeCodeForToken(code);
    const profile = await this.githubOauth.fetchProfile(accessToken);
    const user = await this.githubOauth.findOrCreateUser(profile);
    const jwtToken = this.fbgJwtService.getToken({ userId: user.id });

    // Redirect back to the web app with the token in the fragment, which is
    // not sent to servers in Referer headers.
    const target = process.env.OAUTH_SUCCESS_REDIRECT || '/';
    res.redirect(`${target}#jwtToken=${encodeURIComponent(jwtToken)}`);
  }
}
