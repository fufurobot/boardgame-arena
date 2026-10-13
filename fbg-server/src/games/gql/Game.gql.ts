import { Field, Int, ObjectType, InputType } from '@nestjs/graphql';

@ObjectType()
export class Game {
  @Field(() => Int)
  id: number;

  @Field()
  code: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Int)
  minPlayers: number;

  @Field(() => Int)
  maxPlayers: number;

  @Field()
  published: boolean;

  @Field(() => Int)
  ownerId: number;
}

@InputType()
export class PublishGameInput {
  @Field()
  code: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Int)
  minPlayers: number;

  @Field(() => Int)
  maxPlayers: number;
}

@InputType()
export class UpdateGameInput {
  @Field({ nullable: true })
  name?: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => Int, { nullable: true })
  minPlayers?: number;

  @Field(() => Int, { nullable: true })
  maxPlayers?: number;

  @Field({ nullable: true })
  published?: boolean;
}
