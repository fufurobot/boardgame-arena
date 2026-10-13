import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { HttpService } from '@nestjs/axios';
import { uniqueNickname } from '../testing/userUtil';
import { ChatModule } from './chat.module';
import { RoomsModule } from '../rooms/rooms.module';
import { UsersModule } from '../users/users.module';
import { FakeDbModule } from '../testing/dbUtil';
import { UsersService } from '../users/users.service';
import { RoomsService } from '../rooms/rooms.service';
import { MatchService } from '../match/match.service';
import { PubSub } from 'graphql-subscriptions';
import { closeDbConnection } from '../testing/dbUtil';
import {  } from '@nestjs/common';
import { FBG_PUB_SUB } from '../internal/FbgPubSubModule';

describe('ChatService', () => {
  let module: TestingModule;
  let service: ChatService;
  let roomsService: RoomsService;
  let matchService: MatchService;
  let usersService: UsersService;
  let pubSub: PubSub;
  let httpService: HttpService;

  afterAll(async () => {
    closeDbConnection(module);
  });

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [FakeDbModule, UsersModule, RoomsModule, ChatModule],
    }).compile();

    service = module.get<ChatService>(ChatService);
    usersService = module.get<UsersService>(UsersService);
    roomsService = module.get<RoomsService>(RoomsService);
    matchService = module.get<MatchService>(MatchService);
    httpService = module.get<HttpService>(HttpService);
    pubSub = module.get<PubSub>(FBG_PUB_SUB);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('public room', () => {
    let bobId, room, aliceId, aliceIdNickname, channelId;
    const channelType = 'room';
    beforeAll(async () => {
      const bobIdNickname = uniqueNickname('bob');
      bobId = await usersService.newUser({ nickname: bobIdNickname });
      room = await roomsService.newRoom(
        {
          capacity: 2,
          gameCode: 'checkers',
          isPublic: true,
        },
        bobId,
      );
      channelId = room.id;
      aliceIdNickname = uniqueNickname('alice');
      aliceId = await usersService.newUser({ nickname: aliceIdNickname });
      await roomsService.joinRoom(aliceId, room.id);
    });

    it('should throw error for user not present', async () => {
      const message = 'Hello, bob!';
      const joeIdNickname = uniqueNickname('joe');
      const joeId = await usersService.newUser({ nickname: joeIdNickname });
      const result = service.sendMessage(joeId, { channelType, channelId, message });

      await expect(result).rejects.toThrow();
    });

    it('should transmit a message succesfully', async () => {
      const message = 'Hello, bob!';
      jest.clearAllMocks();
      const publish = jest.spyOn(pubSub, 'publish');
      await service.sendMessage(aliceId, { channelType, channelId, message });

      const args = publish.mock.calls[0];
      expect(args[0]).toEqual(`chat/room/${room.id}`);
      expect(args[1].chatMutated.userNickname).toEqual(aliceIdNickname);
      expect(args[1].chatMutated.message).toEqual(message);
    });

    it('should block bad words', async () => {
      const message = 'Fuck!';
      jest.clearAllMocks();
      const publish = jest.spyOn(pubSub, 'publish');
      await service.sendMessage(aliceId, { channelType, channelId, message });

      const args = publish.mock.calls[0];
      expect(args[1].chatMutated.message).toEqual('****!');
    });
  });

  describe('private room', () => {
    let bobId, room, aliceId, aliceIdNickname, channelId;
    const channelType = 'room';
    beforeAll(async () => {
      const bobIdNickname = uniqueNickname('bob');
      bobId = await usersService.newUser({ nickname: bobIdNickname });
      room = await roomsService.newRoom(
        {
          capacity: 2,
          gameCode: 'checkers',
          isPublic: false,
        },
        bobId,
      );
      channelId = room.id;
      aliceIdNickname = uniqueNickname('alice');
      aliceId = await usersService.newUser({ nickname: aliceIdNickname });
      await roomsService.joinRoom(aliceId, room.id);
    });

    it('should NOT block bad words', async () => {
      const message = 'Fuck!';
      jest.clearAllMocks();
      const publish = jest.spyOn(pubSub, 'publish');
      await service.sendMessage(aliceId, { channelType, channelId, message });

      const args = publish.mock.calls[0];
      expect(args[1].chatMutated.message).toEqual('Fuck!');
    });
  });

  describe('match', () => {
    let bobId, matchId, aliceId, aliceIdNickname, channelId;
    const channelType = 'match';
    beforeAll(async () => {
      const promiseMock = jest
        .fn()
        .mockReturnValueOnce(Promise.resolve({ data: { matchID: 'bgioGameId' } }))
        .mockReturnValueOnce(
          Promise.resolve({ data: { playerCredentials: '1stSecret' } }),
        )
        .mockReturnValueOnce(
          Promise.resolve({ data: { playerCredentials: '2ndSecret' } }),
        );
      jest
        .spyOn(httpService, 'post')
        .mockReturnValue({ toPromise: promiseMock } as any);
      const bobIdNickname = uniqueNickname('bob');
      bobId = await usersService.newUser({ nickname: bobIdNickname });
      const room = await roomsService.newRoom(
        {
          capacity: 2,
          gameCode: 'checkers',
          isPublic: true,
        },
        bobId,
      );
      aliceIdNickname = uniqueNickname('alice');
      aliceId = await usersService.newUser({ nickname: aliceIdNickname });
      await roomsService.joinRoom(aliceId, room.id);
      matchId = await matchService.startMatch(room.id, bobId);
      channelId = matchId;
    });

    it('should throw error for user not present', async () => {
      const message = 'Hello, bob!';
      const joeIdNickname = uniqueNickname('joe');
      const joeId = await usersService.newUser({ nickname: joeIdNickname });
      const result = service.sendMessage(joeId, { channelType, channelId, message });

      await expect(result).rejects.toThrow();
    });

    it('should transmit a message succesfully', async () => {
      const message = 'Hello, bob!';
      jest.clearAllMocks();
      const publish = jest.spyOn(pubSub, 'publish');
      await service.sendMessage(aliceId, { channelType, channelId, message });

      const args = publish.mock.calls[0];
      expect(args[0]).toEqual(`chat/match/${matchId}`);
      expect(args[1].chatMutated.userNickname).toEqual(aliceIdNickname);
      expect(args[1].chatMutated.message).toEqual(message);
    });
  })
});
