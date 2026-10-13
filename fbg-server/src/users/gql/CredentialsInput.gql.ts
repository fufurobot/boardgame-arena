import { InputType, Field } from '@nestjs/graphql';

/** Credentials submitted for registration or login. */
@InputType()
export class CredentialsInput {
  @Field()
  nickname: string;

  @Field()
  password: string;
}
