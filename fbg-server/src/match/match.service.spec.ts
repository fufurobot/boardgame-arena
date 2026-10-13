import { Test, TestingModule } from '@nestjs/testing';
import { MatchService } from './match.service';
import { HttpService } from '@nestjs/axios';
import { uniqueNickname } from '../testing/userUtil';
import { MatchModule } from './match.module';
import { RoomsModule } from '../rooms/rooms.module';
import { UsersModule } from '../users/users.module';
import { FakeDbModule, closeDbConnection } from '../testing/dbUtil';
import { getRepositoryToken } from '@nestjs/typeorm';
import { MatchEntity } from './db/Match.entity';
import { Repository } from 'typeorm';
import { MatchMembershipEntity } from './db/MatchMembership.entity';
import { UsersService } from '../users/users.service';
import { RoomsService } from '../rooms/rooms.service';
import {  } from '@nestjs/common';

describe('MatchService', () => {
  let module: TestingModule;
  let service: MatchService;
  let usersService: UsersService;
  let roomsService: RoomsService;
  let matchRepository: Repository<MatchEntity>;
  let matchMembershipRepository: Repository<MatchMembershipEntity>;
  let httpService: HttpService;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [FakeDbModule, UsersModule, RoomsModule, MatchModule],
    }).compile();

    service = module.get<MatchService>(MatchService);
    usersService = module.get<UsersService>(UsersService);
    roomsService = module.get<RoomsService>(RoomsService);
    matchRepository = module.get(getRepositoryToken(MatchEntity));
    httpService = module.get<HttpService>(HttpService);
    matchMembershipRepository = module.get(
      getRepositoryToken(MatchMembershipEntity),
    );
  });

  afterAll(async () => {
    closeDbConnection(module);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should get match succesfully', async () => {
    const matchEntity = new MatchEntity();
    matchEntity.id = 'fooMock';
    matchEntity.gameCode = 'chess';
    matchEntity.bgioServerInternalUrl = 'fooInternalUrl';
    matchEntity.bgioServerExternalUrl = 'fooExternalUrl';
    matchEntity.bgioMatchId = 'fooMatchId';
    await matchRepository.save(matchEntity);
    const aliceIdNickname = uniqueNickname('alice');
    const aliceId = await usersService.newUser({ nickname: aliceIdNickname });
    const alice = await usersService.getUserEntity(aliceId);
    const aliceMatchMembership = new MatchMembershipEntity();
    aliceMatchMembership.user = alice;
    aliceMatchMembership.match = matchEntity;
    aliceMatchMembership.bgioSecret = 'aliceSecret';
    aliceMatchMembership.bgioPlayerId = 1;
    await matchMembershipRepository.save(aliceMatchMembership);
    const bobIdNickname = uniqueNickname('bob');
    const bobId = await usersService.newUser({ nickname: bobIdNickname });
    const bob = await usersService.getUserEntity(bobId);
    const bobMatchMembership = new MatchMembershipEntity();
    bobMatchMembership.user = bob;
    bobMatchMembership.match = matchEntity;
    bobMatchMembership.bgioSecret = 'bobSecret';
    bobMatchMembership.bgioPlayerId = 0;
    await matchMembershipRepository.save(bobMatchMembership);

    const match = await service.getMatch('fooMock', aliceId);

    // Match the fields under test rather than the exact object shape: users
    // carry additional public fields (e.g. role) that are not this test's
    // concern.
    expect(match).toMatchObject({
      gameCode: 'chess',
      bgioServerUrl: 'fooExternalUrl',
      bgioMatchId: 'fooMatchId',
      bgioSecret: 'aliceSecret',
      bgioPlayerId: '1',
    });
    expect(match.playerMemberships.map((m) => m.user)).toMatchObject([
      { id: bobId, nickname: bobIdNickname },
      { id: aliceId, nickname: aliceIdNickname },
    ]);
  });

  it('should get next room succesfully', async () => {
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
    const bobId = await usersService.newUser({ nickname: bobIdNickname });
    const room = await roomsService.newRoom(
      {
        capacity: 2,
        gameCode: 'checkers',
        isPublic: false,
      },
      bobId,
    );
    const aliceIdNickname = uniqueNickname('alice');
    const aliceId = await usersService.newUser({ nickname: aliceIdNickname });
    await roomsService.joinRoom(aliceId, room.id);
    const matchId = await service.startMatch(room.id, bobId);
    const newRoomId = await service.getNextRoom(matchId, bobId);
    const sameRoomId = await service.getNextRoom(matchId, bobId);

    const newRoom = await roomsService.getRoomEntity(newRoomId);
    expect(newRoom).toMatchObject({
      capacity: 2,
      gameCode: 'checkers',
      isPublic: false,
    });
    expect(sameRoomId).toEqual(newRoomId);
  });

  it('should fail to get next room if user is not in the match', async () => {
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
    const bobId = await usersService.newUser({ nickname: bobIdNickname });
    const room = await roomsService.newRoom(
      {
        capacity: 2,
        gameCode: 'checkers',
        isPublic: false,
      },
      bobId,
    );
    const aliceIdNickname = uniqueNickname('alice');
    const aliceId = await usersService.newUser({ nickname: aliceIdNickname });
    await roomsService.joinRoom(aliceId, room.id);
    const matchId = await service.startMatch(room.id, bobId);

    const joeIdNickname = uniqueNickname('joe');
    const joeId = await usersService.newUser({ nickname: joeIdNickname });
    const result = service.getNextRoom(matchId, joeId);

    await expect(result).rejects.toThrow();
  });

  it('should fail to start match if room is not full', async () => {
    const bobIdNickname = uniqueNickname('bob');
    const bobId = await usersService.newUser({ nickname: bobIdNickname });
    const room = await roomsService.newRoom(
      {
        capacity: 2,
        gameCode: 'checkers',
        isPublic: false,
      },
      bobId,
    );

    const result = service.startMatch(room.id, bobId);
    await expect(result).rejects.toThrow();
  });

  it('should fail to start match if not the creator', async () => {
    const bobIdNickname = uniqueNickname('bob');
    const bobId = await usersService.newUser({ nickname: bobIdNickname });
    const room = await roomsService.newRoom(
      {
        capacity: 2,
        gameCode: 'checkers',
        isPublic: false,
      },
      bobId,
    );
    const aliceIdNickname = uniqueNickname('bob');
    const aliceId = await usersService.newUser({ nickname: aliceIdNickname });
    await roomsService.joinRoom(aliceId, room.id);

    const result = service.startMatch(room.id, aliceId);
    await expect(result).rejects.toThrow();
  });

  it('should start match', async () => {
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
    const bobId = await usersService.newUser({ nickname: bobIdNickname });
    const room = await roomsService.newRoom(
      {
        capacity: 2,
        gameCode: 'checkers',
        isPublic: false,
      },
      bobId,
    );

    const aliceIdNickname = uniqueNickname('alice');
    const aliceId = await usersService.newUser({ nickname: aliceIdNickname });
    await roomsService.joinRoom(aliceId, room.id);

    const matchId = await service.startMatch(room.id, bobId);
    const match = await service.getMatchEntity(matchId);

    expect(match.bgioMatchId).toEqual('bgioGameId');
    expect(match.playerMemberships[0].bgioSecret).toEqual('1stSecret');
    expect(match.playerMemberships[1].bgioSecret).toEqual('2ndSecret');
  });
});
