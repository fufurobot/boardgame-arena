import { Module } from '@nestjs/common';
import { GithubOauthService } from './github-oauth.service';
import { HttpModule } from '@nestjs/axios';
import { GithubOauthController } from './github-oauth.controller';
import { AuthModule } from '../auth.module';
import { UsersModule } from '../../../users/users.module';

/**
 * GitHub OAuth (objective 4).
 *
 * Kept separate from AuthModule so the local-password auth path does not
 * depend on network access to GitHub.
 */
@Module({
  imports: [HttpModule, AuthModule, UsersModule],
  controllers: [GithubOauthController],
  providers: [GithubOauthService],
  exports: [GithubOauthService],
})
export class GithubOauthModule {}
