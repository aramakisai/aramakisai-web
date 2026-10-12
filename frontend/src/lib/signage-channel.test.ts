import { describe, expect, it } from 'vitest';
import {
  SIGNAGE_PING_INTERVAL_MS,
  SIGNAGE_PONG_TIMEOUT_MS,
  isExpired,
  parseClientMessage,
  parseServerMessage,
} from './signage-channel';

describe('isExpired', () => {
  const now = Date.parse('2026-10-12T00:00:00.000Z');

  it('expiresAt が null なら常に偽', () => {
    expect(isExpired({ expiresAt: null }, now)).toBe(false);
    expect(isExpired({ expiresAt: null }, Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  it('期限より前は偽、期限ちょうどと後は真', () => {
    expect(isExpired({ expiresAt: '2026-10-12T00:00:00.001Z' }, now)).toBe(
      false,
    );
    expect(isExpired({ expiresAt: '2026-10-12T00:00:00.000Z' }, now)).toBe(
      true,
    );
    expect(isExpired({ expiresAt: '2026-10-11T23:59:59.999Z' }, now)).toBe(
      true,
    );
  });

  it('解釈できない日時は期限切れ扱い', () => {
    expect(isExpired({ expiresAt: 'not-a-date' }, now)).toBe(true);
  });
});

describe('定数', () => {
  it('ping 間隔と pong の待ちは各 5 秒', () => {
    expect(SIGNAGE_PING_INTERVAL_MS).toBe(5_000);
    expect(SIGNAGE_PONG_TIMEOUT_MS).toBe(5_000);
  });
});

describe('parseServerMessage', () => {
  const broadcast = {
    kind: 'broadcast',
    feature: 'snapshot',
    payload: { version: 1 },
    expiresAt: null,
    sentAt: '2026-10-12T00:00:00.000Z',
  };

  it('pong を解釈する', () => {
    const raw = JSON.stringify({
      kind: 'pong',
      id: 3,
      serverNow: '2026-10-12T00:00:00.000Z',
    });
    expect(parseServerMessage(raw)).toEqual({
      kind: 'pong',
      id: 3,
      serverNow: '2026-10-12T00:00:00.000Z',
    });
  });

  it('broadcast を解釈する', () => {
    expect(parseServerMessage(JSON.stringify(broadcast))).toEqual(broadcast);
    const withExpiry = { ...broadcast, expiresAt: '2026-10-12T01:00:00.000Z' };
    expect(parseServerMessage(JSON.stringify(withExpiry))).toEqual(withExpiry);
  });

  it('未知の機能の broadcast は捨てずに返す', () => {
    const unknown = {
      ...broadcast,
      feature: 'future-feature',
      payload: { x: 1 },
    };
    expect(parseServerMessage(JSON.stringify(unknown))).toEqual(unknown);
  });

  it.each([
    ['JSON でない', 'not json'],
    ['空文字', ''],
    ['null', 'null'],
    ['配列', '[]'],
    ['数値', '1'],
    ['kind が無い', '{}'],
    ['未知の kind', JSON.stringify({ kind: 'ping', id: 1 })],
    [
      'pong の id が文字列',
      JSON.stringify({ kind: 'pong', id: '1', serverNow: 'x' }),
    ],
    ['pong の serverNow が無い', JSON.stringify({ kind: 'pong', id: 1 })],
    ['feature が文字列でない', JSON.stringify({ ...broadcast, feature: 1 })],
    [
      'expiresAt が undefined',
      JSON.stringify({ ...broadcast, expiresAt: undefined }),
    ],
    ['expiresAt が数値', JSON.stringify({ ...broadcast, expiresAt: 1 })],
    ['sentAt が無い', JSON.stringify({ ...broadcast, sentAt: undefined })],
    ['payload が無い', JSON.stringify({ ...broadcast, payload: undefined })],
    ['payload が null', JSON.stringify({ ...broadcast, payload: null })],
  ])('形の合わないものは null: %s', (_name, raw) => {
    expect(parseServerMessage(raw)).toBeNull();
  });
});

describe('parseClientMessage', () => {
  it('ping を解釈する', () => {
    expect(parseClientMessage('{"kind":"ping","id":7}')).toEqual({
      kind: 'ping',
      id: 7,
    });
  });

  it.each([
    ['JSON でない', '{'],
    ['null', 'null'],
    ['配列', '[1]'],
    ['id が無い', '{"kind":"ping"}'],
    ['id が文字列', '{"kind":"ping","id":"1"}'],
    ['未知の kind', '{"kind":"pong","id":1}'],
    [
      'broadcast は受け付けない',
      JSON.stringify({ kind: 'broadcast', feature: 'pin' }),
    ],
  ])('形の合わないものは null: %s', (_name, raw) => {
    expect(parseClientMessage(raw)).toBeNull();
  });
});
