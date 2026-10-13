import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  EEW_RECORD_LIMIT,
  acceptReport,
  eewPrecedence,
  putRecord,
  type EewRecord,
} from './relay-core';
import {
  normalizeMessage,
  type EewReport,
  type EqlistReport,
  type ObservationReport,
} from './upstream';

const fx = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const eew = (ch: 'p2p' | 'wolfxEew', name: string) =>
  normalizeMessage(ch, fx(name), { test: false }) as EewReport;
const obs = (name: string) =>
  normalizeMessage('p2p', fx(name), { test: false }) as ObservationReport;

const P2P_WARN = eew('p2p', 'hand-p2p-556-gunma-warning.json');
const WOLFX_WARN = eew('wolfxEew', 'hand-wolfx-eew-gunma-warning.json');

describe('選別', () => {
  it('警報は発表から2分以内だけ通す', () => {
    expect(acceptReport(P2P_WARN, P2P_WARN.issuedAt + 120_000, false)).toBe(
      true,
    );
    expect(acceptReport(P2P_WARN, P2P_WARN.issuedAt + 120_001, false)).toBe(
      false,
    );
  });

  it('取消は通し、予報(警報でも取消でもない)は通さない', () => {
    const cancel = eew('p2p', 'hand-p2p-556-gunma-cancel.json');
    expect(acceptReport(cancel, cancel.issuedAt + 1000, false)).toBe(true);
    expect(
      acceptReport({ ...P2P_WARN, warning: false }, P2P_WARN.issuedAt, false),
    ).toBe(false);
  });

  it('P2Pの地震情報は観測点ありで発表から10分以内だけ通す', () => {
    const o = obs('hand-p2p-551-maebashi-5strong.json');
    expect(acceptReport(o, o.issuedAt + 600_000, false)).toBe(true);
    expect(acceptReport(o, o.issuedAt + 600_001, false)).toBe(false);
    expect(acceptReport({ ...o, hasStations: false }, o.issuedAt, false)).toBe(
      false,
    );
  });

  it('Wolfxの地震情報は発生から20分以内だけ通す', () => {
    const e = normalizeMessage(
      'wolfxEqlist',
      fx('hand-wolfx-eqlist-shindo-4.json'),
      {
        test: false,
      },
    ) as EqlistReport;
    expect(acceptReport(e, e.originTime + 1_200_000, false)).toBe(true);
    expect(acceptReport(e, e.originTime + 1_200_001, false)).toBe(false);
  });

  it('試験モードの系統は鮮度を飛ばすが、予報は通さない', () => {
    const old = P2P_WARN.issuedAt + 86_400_000;
    expect(acceptReport(P2P_WARN, old, true)).toBe(true);
    expect(acceptReport({ ...P2P_WARN, warning: false }, old, true)).toBe(
      false,
    );
  });
});

describe('情報源の優先', () => {
  const rec = (over: Partial<EewRecord> = {}): EewRecord => ({
    eventId: P2P_WARN.eventId,
    serial: 2,
    cancelled: false,
    source: 'wolfx',
    notify: true,
    discordMessageId: null,
    ...over,
  });
  const rep = (over: Partial<EewReport>): EewReport => ({
    ...P2P_WARN,
    ...over,
  });

  it.each<[string, EewRecord | undefined, Partial<EewReport>, string]>([
    ['記録なし', undefined, { serial: 1 }, 'new'],
    ['新しい番号(P2P)', rec(), { serial: 3, source: 'p2p' }, 'new'],
    ['新しい番号(Wolfx→Wolfx)', rec(), { serial: 3, source: 'wolfx' }, 'new'],
    ['古い番号', rec(), { serial: 1, source: 'p2p' }, 'drop'],
    [
      '同じ番号でWolfxの記録にP2P',
      rec(),
      { serial: 2, source: 'p2p' },
      'replace',
    ],
    [
      '同じ番号でP2Pの記録にWolfx',
      rec({ source: 'p2p' }),
      { serial: 2, source: 'wolfx' },
      'drop',
    ],
    ['同じ系統の再送(Wolfx)', rec(), { serial: 2, source: 'wolfx' }, 'drop'],
    [
      '同じ系統の再送(P2P)',
      rec({ source: 'p2p' }),
      { serial: 2, source: 'p2p' },
      'drop',
    ],
    [
      '取消は同じ番号の警報より上',
      rec(),
      { serial: 2, source: 'wolfx', cancelled: true },
      'new',
    ],
    [
      '取消の記録に同じ番号の警報',
      rec({ cancelled: true }),
      { serial: 2, source: 'p2p', cancelled: false },
      'drop',
    ],
    [
      '取消の記録にWolfx→P2Pの取消',
      rec({ cancelled: true }),
      { serial: 2, source: 'p2p', cancelled: true },
      'replace',
    ],
    [
      '取消の記録に次の番号の警報',
      rec({ cancelled: true }),
      { serial: 3, source: 'wolfx' },
      'new',
    ],
  ])('%s', (_n, record, over, expected) => {
    expect(eewPrecedence(record, rep(over))).toBe(expected);
  });

  it('Wolfxの警報の実データでも同じ組が使える', () => {
    expect(
      eewPrecedence(
        { ...rec(), eventId: WOLFX_WARN.eventId, serial: WOLFX_WARN.serial },
        P2P_WARN,
      ),
    ).toBe('replace');
  });
});

describe('地震ごとの記録', () => {
  const r = (id: number, serial = 1): EewRecord => ({
    eventId: String(id),
    serial,
    cancelled: false,
    source: 'p2p',
    notify: false,
    discordMessageId: null,
  });

  it('同じ地震は1件に置き換え、末尾が最新', () => {
    const out = putRecord([r(1), r(2)], r(1, 2));
    expect(out.map((x) => x.eventId)).toEqual(['2', '1']);
    expect(out[1]?.serial).toBe(2);
  });

  it('上限を超えたら古いものから捨てる', () => {
    let list: readonly EewRecord[] = [];
    for (let i = 0; i < EEW_RECORD_LIMIT + 5; i++) list = putRecord(list, r(i));
    expect(list).toHaveLength(EEW_RECORD_LIMIT);
    expect(list[0]?.eventId).toBe('5');
  });
});
