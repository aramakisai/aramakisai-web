import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  normalizeMessage,
  parseJstTime,
  type EewReport,
  type EqlistReport,
  type ObservationReport,
} from './upstream';

const fx = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const live = { test: false };
const sandbox = { test: true };

const p2p = (name: string, ctx = live) =>
  normalizeMessage('p2p', fx(name), ctx);
const eew = (name: string, ctx = live) =>
  normalizeMessage('wolfxEew', fx(name), ctx);
const eqlist = (name: string, ctx = live) =>
  normalizeMessage('wolfxEqlist', fx(name), ctx);

const asEew = (r: unknown) => {
  const x = r as EewReport | null;
  if (x?.kind !== 'eew') throw new Error(`eew でない: ${JSON.stringify(x)}`);
  return x;
};
const asObs = (r: unknown) => {
  const x = r as ObservationReport | null;
  if (x?.kind !== 'observation') throw new Error('observation でない');
  return x;
};
const asEql = (r: unknown) => {
  const x = r as EqlistReport | null;
  if (x?.kind !== 'eqlist') throw new Error('eqlist でない');
  return x;
};

describe('parseJstTime', () => {
  it('+09:00 として解釈する', () => {
    expect(parseJstTime('2026/10/23 10:00:08')).toBe(
      Date.parse('2026-10-23T01:00:08Z'),
    );
  });
  it('秒が無い形も解釈する', () => {
    expect(parseJstTime('2026/10/23 10:00')).toBe(
      Date.parse('2026-10-23T01:00:00Z'),
    );
  });
  it('ミリ秒付きも解釈する', () => {
    expect(parseJstTime('2026/10/14 00:02:34.333')).toBe(
      Date.parse('2026-10-13T15:02:34.333Z'),
    );
  });
  it.each([
    '',
    'あした',
    '2026/13/45 25:00:00',
    '2026-10-23 10:00:00',
    undefined,
    5,
  ])('解釈できなければ null: %s', (v) => {
    expect(parseJstTime(v)).toBeNull();
  });
});

describe('P2P 556(警報)', () => {
  it('群馬県を含む警報を正規化する', () => {
    const r = asEew(p2p('hand-p2p-556-gunma-warning.json'));
    expect(r).toMatchObject({
      source: 'p2p',
      eventId: '20261023100005',
      serial: 1,
      cancelled: false,
      warning: true,
      gunma: true,
      training: false,
      issuedAt: Date.parse('2026-10-23T01:00:08Z'),
      originTime: Date.parse('2026-10-23T01:00:00Z'),
    });
    expect(r.detail).toMatchObject({
      final: null,
      hypocenter: '群馬県南部',
      magnitude: 6.1,
      depth: 10,
      originTimeText: '2026/10/23 10:00:00',
      issuedAtText: '2026/10/23 10:00:08',
    });
  });

  it('地域ごとの予想震度と到達予想時刻を受信値のまま持つ', () => {
    const { areas } = asEew(p2p('hand-p2p-556-gunma-warning.json')).detail;
    expect(areas).toEqual([
      {
        name: '群馬県南部',
        intensityFrom: '震度5強',
        intensityTo: '震度6弱',
        arrival: '2026/10/23 10:00:12',
      },
      {
        name: '埼玉県北部',
        intensityFrom: '震度5弱',
        intensityTo: '震度5強',
        arrival: '既に到達と予測',
      },
      {
        name: '栃木県南部',
        intensityFrom: '震度4',
        intensityTo: '以上',
        arrival: '到達予想なし',
      },
    ]);
  });

  it('群馬県を含まない警報は gunma が偽', () => {
    expect(asEew(p2p('hand-p2p-556-no-gunma.json')).gunma).toBe(false);
  });

  it('続報の番号を読む', () => {
    expect(asEew(p2p('hand-p2p-556-gunma-followup.json')).serial).toBe(2);
  });

  it('取消は cancelled で、発生時刻と地域を持たない', () => {
    const r = asEew(p2p('hand-p2p-556-gunma-cancel.json'));
    expect(r).toMatchObject({
      cancelled: true,
      serial: 3,
      originTime: null,
      gunma: false,
    });
    expect(r.detail.hypocenter).toBeNull();
    expect(r.detail.areas).toEqual([]);
  });

  it('test が真なら訓練', () => {
    expect(asEew(p2p('hand-p2p-556-gunma-training.json')).training).toBe(true);
  });

  it('試験モードの系統は訓練にする', () => {
    expect(
      asEew(p2p('hand-p2p-556-gunma-warning.json', sandbox)).training,
    ).toBe(true);
  });

  it('サンドボックスの実データ(WS の形、id なし)を読む', () => {
    const r = asEew(p2p('p2p-ws-556-warning.json', sandbox));
    expect(r.eventId).toBe('20230509051422');
    expect(r.gunma).toBe(false);
    expect(r.issuedAt).toBe(Date.parse('2023-05-08T20:14:30Z'));
    expect(r.detail.areas[0]).toMatchObject({
      name: '石川県能登',
      arrival: '既に到達と予測',
    });
  });

  it('/history 由来(id あり)の実データも読む', () => {
    const r = asEew(p2p('p2p-history-556-warning.json', sandbox));
    expect(r.eventId).toBe('20230505215718');
    expect(r.detail.areas[0]!.intensityTo).toBe('以上');
  });

  it('発表時刻が解釈できなければ捨てる', () => {
    const o = JSON.parse(fx('hand-p2p-556-gunma-warning.json'));
    o.issue.time = 'xxx';
    expect(normalizeMessage('p2p', JSON.stringify(o), live)).toBeNull();
  });

  it('警報で発生時刻が解釈できなければ捨てる', () => {
    const o = JSON.parse(fx('hand-p2p-556-gunma-warning.json'));
    o.earthquake.originTime = 'xxx';
    expect(normalizeMessage('p2p', JSON.stringify(o), live)).toBeNull();
  });

  it('マグニチュード・深さの -1 は null', () => {
    const o = JSON.parse(fx('hand-p2p-556-gunma-warning.json'));
    o.earthquake.hypocenter.magnitude = -1;
    o.earthquake.hypocenter.depth = -1;
    const r = asEew(normalizeMessage('p2p', JSON.stringify(o), live));
    expect(r.detail.magnitude).toBeNull();
    expect(r.detail.depth).toBeNull();
  });
});

describe('P2P 551(地震情報)', () => {
  it('前橋市の震度5強を拾う', () => {
    const r = asObs(p2p('hand-p2p-551-maebashi-5strong.json'));
    expect(r).toMatchObject({
      id: '6ace000000000000000000b1',
      hasStations: true,
      maebashiMaxScale: 50,
      maebashiEstimated: false,
      gunmaStations: true,
      training: false,
      originTime: Date.parse('2026-10-23T01:00:00Z'),
      issuedAt: Date.parse('2026-10-23T01:04:00Z'),
    });
    expect(r.observation).toEqual({
      source: 'p2p',
      originTime: '2026/10/23 10:00:00',
      hypocenter: '群馬県南部',
      maebashiIntensity: '震度5強',
      maxIntensity: '震度5強',
    });
    expect(r.detail).toMatchObject({
      issueType: '各地の震度に関する情報',
      magnitude: 6.1,
      depth: 10,
      issuedAtText: '2026/10/23 10:04:00',
    });
  });

  it('前橋市が 5強未満なら最大をそのまま持つ', () => {
    const r = asObs(p2p('hand-p2p-551-maebashi-4.json'));
    expect(r.maebashiMaxScale).toBe(40);
    expect(r.observation.maebashiIntensity).toBe('震度4');
  });

  it('46(推定)を検出し、表示名にする', () => {
    const r = asObs(p2p('hand-p2p-551-maebashi-46.json'));
    expect(r.maebashiEstimated).toBe(true);
    expect(r.maebashiMaxScale).toBe(46);
    expect(r.observation.maebashiIntensity).toBe('震度5弱以上(推定)');
  });

  it('前橋市が載らなければ null、群馬県の観測点はある', () => {
    const r = asObs(p2p('hand-p2p-551-gunma-no-maebashi.json'));
    expect(r.maebashiMaxScale).toBeNull();
    expect(r.observation.maebashiIntensity).toBeNull();
    expect(r.gunmaStations).toBe(true);
  });

  it('群馬県以外の観測点だけなら gunmaStations が偽', () => {
    const r = asObs(p2p('p2p-ws-551-detailscale.json', sandbox));
    expect(r.hasStations).toBe(true);
    expect(r.gunmaStations).toBe(false);
    expect(r.training).toBe(true);
  });

  it('WS の形(_id のみ)と /history の形(id)の両方で ID を読む', () => {
    expect(asObs(p2p('p2p-ws-551-detailscale.json')).id).toBe(
      '6ace480ae72797fa8afb919a',
    );
    expect(asObs(p2p('p2p-history-551-detailscale.json')).id).toBe(
      '6ace4882e72797fa8afb919e',
    );
  });

  it('id と _id が両方あれば id を使う', () => {
    const o = JSON.parse(fx('p2p-ws-551-detailscale.json'));
    o.id = 'from-id';
    expect(asObs(normalizeMessage('p2p', JSON.stringify(o), live)).id).toBe(
      'from-id',
    );
  });

  it('ID が無ければ捨てる', () => {
    const o = JSON.parse(fx('p2p-ws-551-detailscale.json'));
    delete o._id;
    expect(normalizeMessage('p2p', JSON.stringify(o), live)).toBeNull();
  });

  it.each([
    ['p2p-history-551-scaleprompt.json', '震度速報'],
    ['p2p-history-551-destination.json', '震源に関する情報'],
  ])('%s は観測点なし', (name, issueType) => {
    const r = asObs(p2p(name));
    expect(r.hasStations).toBe(false);
    expect(r.gunmaStations).toBe(false);
    expect(r.detail.issueType).toBe(issueType);
  });

  it('震度速報(地域のみ)は前橋市の観測点を持たない', () => {
    const r = asObs(p2p('hand-p2p-551-areas-only.json'));
    expect(r.hasStations).toBe(false);
    expect(r.maebashiMaxScale).toBeNull();
  });

  it.each(['Foreign', 'Other'])('%s は観測点なし', (type) => {
    const o = JSON.parse(fx('hand-p2p-551-maebashi-5strong.json'));
    o.issue.type = type;
    const r = asObs(normalizeMessage('p2p', JSON.stringify(o), live));
    expect(r.hasStations).toBe(false);
  });

  it('震源が空の震度速報・深さと M が -1 でも読める', () => {
    const r = asObs(p2p('p2p-history-551-destination.json'));
    expect(r.detail.magnitude).not.toBe(-1);
    expect(r.detail.depth).not.toBe(-1);
  });

  it('発生時刻が解釈できなければ捨てる', () => {
    const o = JSON.parse(fx('hand-p2p-551-maebashi-5strong.json'));
    o.earthquake.time = '';
    expect(normalizeMessage('p2p', JSON.stringify(o), live)).toBeNull();
  });
});

describe('P2P その他', () => {
  it('555・554 など段階に関係しない種類は null', () => {
    expect(p2p('p2p-ws-554.json')).toBeNull();
    expect(
      normalizeMessage('p2p', '{"code":555,"_id":"a","time":"x"}', live),
    ).toBeNull();
  });
});

describe('Wolfx jma_eew', () => {
  it('群馬県の警報を正規化する', () => {
    const r = asEew(eew('hand-wolfx-eew-gunma-warning.json'));
    expect(r).toMatchObject({
      source: 'wolfx',
      eventId: '20261023100005',
      serial: 1,
      cancelled: false,
      warning: true,
      gunma: true,
      training: false,
      issuedAt: Date.parse('2026-10-23T01:00:08Z'),
      originTime: Date.parse('2026-10-23T01:00:00Z'),
    });
    expect(r.detail).toMatchObject({
      final: false,
      hypocenter: '群馬県南部',
      magnitude: 6.1,
      depth: 10,
      originTimeText: '2026/10/23 10:00:00',
      issuedAtText: '2026/10/23 10:00:08',
    });
    expect(r.detail.areas).toEqual([
      {
        name: '群馬県南部',
        intensityFrom: '5-',
        intensityTo: '5+',
        arrival: '2026/10/23 10:00:12',
      },
      {
        name: '埼玉県北部',
        intensityFrom: '4',
        intensityTo: '5-',
        arrival: '既に到達と予測',
      },
      {
        name: '栃木県南部',
        intensityFrom: '3',
        intensityTo: '4',
        arrival: '2026/10/23 10:00:20',
      },
    ]);
  });

  it('最終報は final が真', () => {
    const r = asEew(eew('hand-wolfx-eew-gunma-final.json'));
    expect(r.detail.final).toBe(true);
    expect(r.serial).toBe(4);
  });

  it('取消は警報でなく cancelled', () => {
    const r = asEew(eew('hand-wolfx-eew-gunma-cancel.json'));
    expect(r).toMatchObject({ cancelled: true, warning: false, gunma: false });
    expect(r.detail.hypocenter).toBeNull();
  });

  it('isTraining は訓練', () => {
    expect(asEew(eew('hand-wolfx-eew-gunma-training.json')).training).toBe(
      true,
    );
  });

  it('試験モードの系統は訓練にする', () => {
    expect(
      asEew(eew('hand-wolfx-eew-gunma-warning.json', sandbox)).training,
    ).toBe(true);
  });

  it('群馬県を含まない警報は gunma が偽', () => {
    expect(asEew(eew('hand-wolfx-eew-no-gunma.json')).gunma).toBe(false);
  });

  it('群馬県が予報(Forecast)の地域にだけあるときは gunma が偽', () => {
    // isWarn が偽なので、そもそも報にしない
    expect(eew('hand-wolfx-eew-gunma-forecast-only.json')).toBeNull();
  });

  it('警報の報で群馬県が Forecast の区域だけなら gunma が偽', () => {
    const o = JSON.parse(fx('hand-wolfx-eew-gunma-warning.json'));
    o.WarnArea = [
      {
        Chiiki: '群馬県南部',
        Shindo1: '3',
        Shindo2: '4',
        Time: '',
        Type: 'Forecast',
        Arrive: false,
      },
    ];
    expect(
      asEew(normalizeMessage('wolfxEew', JSON.stringify(o), live)).gunma,
    ).toBe(false);
  });

  it('実データの予報は捨てる', () => {
    expect(eew('wolfx-eew-forecast.json')).toBeNull();
  });

  it('heartbeat は捨てる', () => {
    expect(eew('wolfx-heartbeat.json')).toBeNull();
  });

  it('Magnitude が無ければ Magunitude を読む', () => {
    const o = JSON.parse(fx('hand-wolfx-eew-gunma-warning.json'));
    delete o.Magnitude;
    o.Magunitude = 5.5;
    const r = asEew(normalizeMessage('wolfxEew', JSON.stringify(o), live));
    expect(r.detail.magnitude).toBe(5.5);
  });

  it('発表時刻が解釈できなければ捨てる', () => {
    const o = JSON.parse(fx('hand-wolfx-eew-gunma-warning.json'));
    o.AnnouncedTime = '';
    expect(normalizeMessage('wolfxEew', JSON.stringify(o), live)).toBeNull();
  });

  it('EventID が無ければ捨てる', () => {
    const o = JSON.parse(fx('hand-wolfx-eew-gunma-warning.json'));
    delete o.EventID;
    expect(normalizeMessage('wolfxEew', JSON.stringify(o), live)).toBeNull();
  });

  it('同じ報の Wolfx 版と P2P 版は同じ eventId・serial', () => {
    const a = asEew(eew('hand-wolfx-eew-gunma-warning.json'));
    const b = asEew(p2p('hand-p2p-556-gunma-warning.json'));
    expect([a.eventId, a.serial, a.issuedAt, a.originTime]).toEqual([
      b.eventId,
      b.serial,
      b.issuedAt,
      b.originTime,
    ]);
  });
});

describe('Wolfx jma_eqlist', () => {
  it('No1 だけを地震情報にする', () => {
    const r = asEql(eqlist('wolfx-eqlist.json'));
    expect(r).toMatchObject({
      source: 'wolfx',
      eventId: '20261013220530',
      originTime: Date.parse('2026-10-13T13:05:00Z'),
      belowFiveLower: true,
      training: false,
    });
    expect(r.observation).toEqual({
      source: 'wolfx',
      originTime: '2026/10/13 22:05:00',
      hypocenter: '宮城県沖',
      maebashiIntensity: null,
      maxIntensity: '震度1',
    });
  });

  it.each([
    ['hand-wolfx-eqlist-shindo-4.json', true, '震度4'],
    ['hand-wolfx-eqlist-shindo-5minus.json', false, '震度5弱'],
    ['hand-wolfx-eqlist-shindo-unknown.json', false, null],
  ])('%s の最大震度', (name, below, label) => {
    const r = asEql(eqlist(name));
    expect(r.belowFiveLower).toBe(below);
    expect(r.observation.maxIntensity).toBe(label);
  });

  it('試験モードの系統は訓練', () => {
    expect(asEql(eqlist('wolfx-eqlist.json', sandbox)).training).toBe(true);
  });

  it('heartbeat は捨てる', () => {
    expect(eqlist('wolfx-heartbeat.json')).toBeNull();
  });

  it('No1 が無い・時刻が解釈できない形は捨てる', () => {
    expect(normalizeMessage('wolfxEqlist', '{"md5":"x"}', live)).toBeNull();
    const o = JSON.parse(fx('wolfx-eqlist.json'));
    o.No1.time_full = '';
    expect(normalizeMessage('wolfxEqlist', JSON.stringify(o), live)).toBeNull();
  });
});

describe('壊れた入力', () => {
  it.each(['p2p', 'wolfxEew', 'wolfxEqlist'] as const)(
    '%s: 壊れた JSON・JSON でない値は null',
    (ch) => {
      expect(normalizeMessage(ch, fx('broken.txt'), live)).toBeNull();
      expect(normalizeMessage(ch, 'null', live)).toBeNull();
      expect(normalizeMessage(ch, '[]', live)).toBeNull();
      expect(normalizeMessage(ch, '"x"', live)).toBeNull();
      expect(normalizeMessage(ch, '', live)).toBeNull();
    },
  );
});
