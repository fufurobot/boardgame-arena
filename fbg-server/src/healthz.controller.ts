import { Controller, Get } from '@nestjs/common';
import { PORT } from './constants';
import { HttpService } from '@nestjs/axios';

const LOBBY_QUERY = `
  query GetLobby {
    lobby {
      rooms {
        gameCode,
        capacity,
        userMemberships {
          isCreator,
          position,
          __typename
        },
        __typename
      },
      __typename
    }
  }
`;

@Controller('healthz')
export class HealthzController {
  constructor(private httpService: HttpService) {}

  @Get()
  async healthz(): Promise<string> {
    const postData = {
      query: LOBBY_QUERY
    };
    await this.httpService.post(`http://localhost:${PORT}/graphql`, postData, { timeout: 5e3 }).toPromise();
    return 'OK';
  }
}
