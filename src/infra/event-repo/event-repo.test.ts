import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect, test,
} from 'bun:test';
import { ConsoleLogger } from 'rilata/src/common/logger/console-logger';
import { storeDispatcher } from 'rilata/src/app/async-store/store-dispatcher';
import { StorePayload } from 'rilata/src/app/async-store/types';
import { EventRepository } from './event-repo';
import { ModuleResolverMock, eventDOD, typeormDatabase } from './fixture';
import { Event } from '../event-repo/entities/event';

let eventRepo: EventRepository;
let globalUnitOfWorkId: string | undefined;

beforeAll(async () => {
  await typeormDatabase.init();
  eventRepo = new EventRepository(typeormDatabase, new ConsoleLogger());
});

beforeEach(async () => {
  globalUnitOfWorkId = await typeormDatabase.startTransaction();
  const alsMock = {
    run<F, Fargs extends unknown[]>(store: T, fn: (...args: Fargs) => F, ...args: Fargs): F {
      throw new Error();
    },
    getStore(): StorePayload {
      return {
        actionId: crypto.randomUUID(),
        moduleResolver: new ModuleResolverMock(),
        caller: {
          type: 'ModuleCaller',
          name: 'SubjectModule',
          user: {
            type: 'AnonymousUser',
          },
        },
        unitOfWorkId: globalUnitOfWorkId,
      };
    },
  };
  storeDispatcher.setThreadStore(alsMock);
});

afterEach(async () => {
  await typeormDatabase.rollback(globalUnitOfWorkId);
  globalUnitOfWorkId = undefined;
});

describe('event repo test', () => {
  describe('addEvent tests', () => {
    test('success, event entity added to the repo', async () => {
      await eventRepo.addEvent(eventDOD);
      const eventEntity = await typeormDatabase.createEntityManager()
        .findOne(Event, { where: { actionId: 'c7ab5938-ac52-47d6-b831-62fbd3cbc288' } });

      expect(eventEntity.actionId).toBe('c7ab5938-ac52-47d6-b831-62fbd3cbc288');
      expect(eventEntity.isPublished).toBe(false);
      expect(eventEntity.attrs).toBe('{"attrs":{"username":"azat","age":19},"meta":{"eventId":"d00103e8-eb18-4694-9efd-ce0b2dcbf0d7","actionId":"c7ab5938-ac52-47d6-b831-62fbd3cbc288","name":"UserAdded","moduleName":"subject","domainType":"event"},'
      + '"caller":{"type":"DomainUser","userId":"034e14d1-eabd-4491-b922-77b72f83590d"},"aRootAttrs":{"attrs":{"username":"azat","age":19},"meta":{"name":"UserAR","domainType":"aggregate","version":0}}}');
    });
  });

  describe('markAsPublished tests', () => {
    test('success, event entity marked as published', async () => {
      await eventRepo.addEvent(eventDOD);
      expect((await typeormDatabase.createEntityManager()
        .findOne(Event, { where: { actionId: 'c7ab5938-ac52-47d6-b831-62fbd3cbc288' } })).isPublished).toBe(false);

      await eventRepo.markAsPublished('c7ab5938-ac52-47d6-b831-62fbd3cbc288');
      expect((await typeormDatabase.createEntityManager()
        .findOne(Event, { where: { actionId: 'c7ab5938-ac52-47d6-b831-62fbd3cbc288' } })).isPublished).toBe(true);
    });
  });

  describe('getNotPusblishedEvents tests', () => {
    test('success, event repo returned not published events', async () => {
      await eventRepo.addEvent(eventDOD);
      await eventRepo.addEvent({
        attrs: {
          username: 'john',
          age: 37,
        },
        meta: {
          eventId: crypto.randomUUID(),
          actionId: 'c7ab5938-ac52-47d6-b645-625b73cb4266',
          name: 'UserAdded',
          moduleName: 'subject',
          domainType: 'event',
        },
        caller: {
          type: 'DomainUser',
          userId: '034e14d1-eabd-4491-b922-77b72f83590d',
        },
        aRootAttrs: {
          attrs: {
            username: 'john',
            age: 37,
          },
          meta: {
            name: 'UserAR',
            domainType: 'aggregate',
            version: 0,
          },
        },
      });
      await eventRepo.markAsPublished('c7ab5938-ac52-47d6-b645-625b73cb4266');

      expect(await eventRepo.getNotPublishedEvents()).toEqual([
        '{"attrs":{"username":"azat","age":19},'
        + '"meta":{"eventId":"d00103e8-eb18-4694-9efd-ce0b2dcbf0d7","actionId":"c7ab5938-ac52-47d6-b831-62fbd3cbc288","name":"UserAdded",'
        + '"moduleName":"subject","domainType":"event"},"caller":{"type":"DomainUser","userId":"034e14d1-eabd-4491-b922-77b72f83590d"},'
        + '"aRootAttrs":{"attrs":{"username":"azat","age":19},"meta":{"name":"UserAR","domainType":"aggregate","version":0}}}']);
    });

    test('fail, not published events not found', async () => {
      await eventRepo.addEvent(eventDOD);
      await eventRepo.markAsPublished('c7ab5938-ac52-47d6-b831-62fbd3cbc288');
      expect(await eventRepo.getNotPublishedEvents()).toEqual([]);
    });
  });

  describe('isEventExist tests', () => {
    test('success, event is not exist', async () => {
      await eventRepo.addEvent(eventDOD);
      expect(await eventRepo.isEventExist('c3ab7777-ac77-77g7-a777-77fsd7cbc777')).toBe(false);
    });

    test('fail, event is exist', async () => {
      await eventRepo.addEvent(eventDOD);
      expect(await eventRepo.isEventExist('c7ab5938-ac52-47d6-b831-62fbd3cbc288')).toBe(true);
    });
  });
});
