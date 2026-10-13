import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameEntity } from './db/Game.entity';
import { GamesService } from './games.service';

@Module({
  imports: [TypeOrmModule.forFeature([GameEntity])],
  providers: [GamesService],
  exports: [GamesService],
})
export class GamesModule {}
