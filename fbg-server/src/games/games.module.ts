import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameEntity } from './db/Game.entity';
import { GamesService } from './games.service';
import { GamesResolver } from './games.resolver';
import { AuthModule } from '../internal/auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([GameEntity]), AuthModule],
  providers: [GamesService, GamesResolver],
  exports: [GamesService],
})
export class GamesModule {}
