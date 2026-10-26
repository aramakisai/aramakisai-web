import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  DISMISSED_LIMIT,
  EEW_RECORD_LIMIT,
  SEEN_OBSERVATION_LIMIT,
  SILENCE_LIMIT_MS,
  acceptReport,
  applyDismiss,
  eewPrecedence,
  emptyRelayState,
  isReceiving,
  isReceptionLost,
  processReport,
  putRecord,
  recordDiscordMessage,
  toPayload,
  type EewRecord,
  type QuakeNotice,
  type RelayState,
} from './relay-core';
import {
  normalizeMessage,
  type EewReport,
  type EqlistReport,
  type ObservationReport,
  type QuakeReport,
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

describe('段階の遷移', () => {
  const eqlist = (name: string) =>
    normalizeMessage('wolfxEqlist', fx(name), { test: false }) as EqlistReport;
  const at = (r: QuakeReport) =>
    (r.kind === 'eqlist' ? r.originTime : r.issuedAt) + 5000;
  const feed = (state: RelayState, r: QuakeReport, test = false): RelayState =>
    processReport(state, r, at(r), test).state;
  const stageOf = (s: RelayState) =>
    s.alert ? s.alert.stage : ('idle' as const);

  const CANCEL = eew('p2p', 'hand-p2p-556-gunma-cancel.json');
  const FOLLOW = eew('p2p', 'hand-p2p-556-gunma-followup.json');
  const OTHER: EewReport = {
    ...P2P_WARN,
    eventId: '20261023100099',
    originTime: P2P_WARN.originTime! + 3_600_000,
    issuedAt: P2P_WARN.issuedAt + 3_600_000,
  };
  const HI = obs('hand-p2p-551-maebashi-5strong.json');
  const LOW = obs('hand-p2p-551-maebashi-4.json');
  const NONE = obs('hand-p2p-551-gunma-no-maebashi.json');
  const EST = obs('hand-p2p-551-maebashi-46.json');
  const EQ4 = eqlist('hand-wolfx-eqlist-shindo-4.json');
  const EQ5 = eqlist('hand-wolfx-eqlist-shindo-5minus.json');
  const EQ_UNKNOWN = eqlist('hand-wolfx-eqlist-shindo-unknown.json');

  const reach = (stage: string): RelayState => {
    const s0 = emptyRelayState();
    if (stage === 'idle') return s0;
    const w = feed(s0, P2P_WARN);
    if (stage === 'warning') return w;
    if (stage === 'calm') return feed(w, LOW);
    if (stage === 'evacuate') return feed(w, HI);
    return feed(w, CANCEL);
  };

  it('前提の状態に到達できる', () => {
    for (const s of ['idle', 'warning', 'calm', 'evacuate', 'cancelled'])
      expect(stageOf(reach(s))).toBe(s);
  });

  const inputs: Record<string, QuakeReport> = {
    別の地震の警報: OTHER,
    続報: FOLLOW,
    取消: CANCEL,
    前橋市5強: HI,
    前橋市4: LOW,
    前橋市なし: NONE,
    前橋市46: EST,
    Wolfx4: EQ4,
    Wolfx5弱: EQ5,
  };
  // 行: 現在の段階、列: 入力の名前
  const table: Record<string, Record<string, string>> = {
    idle: {
      別の地震の警報: 'warning',
      続報: 'warning',
      取消: 'idle',
      前橋市5強: 'evacuate',
      前橋市4: 'idle',
      前橋市なし: 'idle',
      前橋市46: 'idle',
      Wolfx4: 'idle',
      Wolfx5弱: 'idle',
    },
    warning: {
      別の地震の警報: 'warning',
      続報: 'warning',
      取消: 'cancelled',
      前橋市5強: 'evacuate',
      前橋市4: 'calm',
      前橋市なし: 'calm',
      前橋市46: 'warning',
      Wolfx4: 'calm',
      Wolfx5弱: 'warning',
    },
    calm: {
      別の地震の警報: 'warning',
      続報: 'calm',
      取消: 'cancelled',
      前橋市5強: 'evacuate',
      前橋市4: 'calm',
      前橋市なし: 'calm',
      前橋市46: 'calm',
      Wolfx4: 'calm',
      Wolfx5弱: 'calm',
    },
    evacuate: {
      別の地震の警報: 'warning',
      続報: 'evacuate',
      取消: 'evacuate',
      前橋市5強: 'evacuate',
      前橋市4: 'evacuate',
      前橋市なし: 'evacuate',
      前橋市46: 'evacuate',
      Wolfx4: 'evacuate',
      Wolfx5弱: 'evacuate',
    },
    cancelled: {
      別の地震の警報: 'warning',
      続報: 'cancelled',
      取消: 'cancelled',
      前橋市5強: 'evacuate',
      前橋市4: 'cancelled',
      前橋市なし: 'cancelled',
      前橋市46: 'cancelled',
      Wolfx4: 'cancelled',
      Wolfx5弱: 'cancelled',
    },
  };

  for (const [from, row] of Object.entries(table))
    for (const [input, to] of Object.entries(row))
      it(`${from} + ${input} -> ${to}`, () => {
        // 続報はserial 2、idleでの続報は初報として扱う
        expect(stageOf(feed(reach(from), inputs[input]!))).toBe(to);
      });

  for (const from of ['warning', 'calm', 'evacuate', 'cancelled'])
    it(`${from} + 解除 -> idle`, () => {
      const out = applyDismiss(reach(from), 0, 'a@example.com');
      expect(stageOf(out.state)).toBe('idle');
    });

  it('続報・置き換えは段階も更新時刻も変えない', () => {
    const w = reach('warning');
    expect(feed(w, FOLLOW).alert).toEqual(w.alert);
    const wolfx = feed(emptyRelayState(), WOLFX_WARN);
    const replaced = feed(wolfx, P2P_WARN);
    expect(replaced.alert?.stage).toBe('warning');
    expect(replaced.alert?.source).toBe('p2p');
    expect(toPayload(replaced)).toMatchObject({ active: true, source: 'p2p' });
    // Wolfxの再送は捨てる
    expect(feed(replaced, WOLFX_WARN).alert?.source).toBe('p2p');
  });

  it('別の地震の警報を段階1の表示中に受けたら、表示を変えず地震を足す', () => {
    const w = reach('warning');
    const out = feed(w, OTHER);
    expect(out.alert?.events).toHaveLength(2);
    expect(out.alert?.startedAt).toBe(w.alert?.startedAt);
  });

  it('2つの地震を表示中は、片方の取消だけでは取消の表示にしない', () => {
    const both = feed(reach('warning'), OTHER);
    const one = feed(both, CANCEL);
    expect(stageOf(one)).toBe('warning');
    const cancelOther: EewReport = {
      ...CANCEL,
      eventId: OTHER.eventId,
      issuedAt: OTHER.issuedAt + 20_000,
    };
    expect(stageOf(feed(one, cancelOther))).toBe('cancelled');
  });

  it('群馬県を含まない警報では表示を始めない(試験モードは始める)', () => {
    const none = eew('p2p', 'hand-p2p-556-no-gunma.json');
    expect(stageOf(feed(emptyRelayState(), none))).toBe('idle');
    expect(stageOf(feed(emptyRelayState(), none, true))).toBe('warning');
  });

  it('選別を通らない古い警報・予報は遷移の入力にならない', () => {
    const s = emptyRelayState();
    const late = processReport(s, P2P_WARN, P2P_WARN.issuedAt + 121_000, false);
    expect(late.state).toBe(s);
  });

  it('段階3は下げず、取消を無視する', () => {
    const ev = reach('evacuate');
    expect(feed(ev, LOW).alert?.observation?.maebashiIntensity).toBe('震度5強');
    expect(stageOf(feed(ev, CANCEL))).toBe('evacuate');
  });

  it('46だけでは段階を変えない。段階2では受信値だけ置き換える', () => {
    const calm = feed(reach('warning'), EQ4);
    expect(calm.alert?.observation?.source).toBe('wolfx');
    const out = feed(calm, EST);
    expect(out.alert?.stage).toBe('calm');
    expect(out.alert?.observation?.source).toBe('p2p');
    expect(out.alert?.observation?.maebashiIntensity).toBe('震度5弱以上(推定)');
  });

  it('Wolfxの地震情報は最大震度1〜4のときだけ段階2へ進め、5弱・不明では進めない', () => {
    expect(stageOf(feed(reach('warning'), EQ4))).toBe('calm');
    expect(stageOf(feed(reach('warning'), EQ5))).toBe('warning');
    expect(stageOf(feed(reach('warning'), EQ_UNKNOWN))).toBe('warning');
  });

  it('警報なしの5強以上で段階3、observationは受信値のまま', () => {
    const s = feed(emptyRelayState(), HI);
    expect(s.alert).toMatchObject({
      stage: 'evacuate',
      reachedEvacuate: true,
      events: [{ eventId: null }],
    });
    expect(toPayload(s)).toMatchObject({
      observation: { source: 'p2p', maebashiIntensity: '震度5強' },
    });
  });

  it('P2Pの地震情報を根拠にした地震ではWolfxの地震情報を捨てる', () => {
    const calm = feed(reach('warning'), LOW);
    expect(calm.alert?.observation?.source).toBe('p2p');
    const out = feed(calm, EQ4);
    expect(out.alert).toBe(calm.alert);
    // 警報なしの段階3でも、時刻の一致で捨てる
    const ev = feed(emptyRelayState(), HI);
    expect(feed(ev, EQ4).alert).toBe(ev.alert);
  });

  it('Wolfxを根拠にした地震ではP2Pの地震情報で受信値と情報源を置き換える', () => {
    const calm = feed(reach('warning'), EQ4);
    const out = feed(calm, LOW);
    expect(out.alert?.observation?.source).toBe('p2p');
    expect(stageOf(feed(calm, HI))).toBe('evacuate');
  });

  describe('訓練', () => {
    const TRAIN = eew('p2p', 'hand-p2p-556-gunma-training.json');
    const trainObs: ObservationReport = { ...HI, training: true };

    it('本物の表示中は訓練の警報・地震情報を捨てる', () => {
      const real = reach('warning');
      const other: EewReport = { ...TRAIN, eventId: OTHER.eventId };
      expect(feed(real, other).alert).toBe(real.alert);
      expect(feed(real, trainObs).alert).toBe(real.alert);
    });

    it('訓練の表示中に本物の警報が来たら本物の表示を始める', () => {
      const train = feed(emptyRelayState(), TRAIN);
      expect(train.alert?.training).toBe(true);
      const out = feed(train, OTHER);
      expect(out.alert).toMatchObject({ stage: 'warning', training: false });
    });

    it('訓練の表示中に、本物の表示が始まらない報なら訓練の表示を保つ', () => {
      const train = feed(emptyRelayState(), TRAIN);
      expect(feed(train, LOW).alert).toBe(train.alert);
      expect(feed(train, CANCEL).alert).toBe(train.alert);
    });

    it('訓練の印はpayloadに載る', () => {
      expect(toPayload(feed(emptyRelayState(), TRAIN))).toMatchObject({
        active: true,
        training: true,
      });
    });
  });

  describe('解除', () => {
    it('解除した地震の続報・取消では再表示しない', () => {
      const d = applyDismiss(reach('warning'), 0, 'a@example.com').state;
      expect(stageOf(feed(d, FOLLOW))).toBe('idle');
      expect(stageOf(feed(d, CANCEL))).toBe('idle');
      expect(stageOf(feed(d, P2P_WARN))).toBe('idle');
    });

    it('別の地震の警報は解除後でも表示する', () => {
      const d = applyDismiss(reach('warning'), 0, 'a@example.com').state;
      expect(stageOf(feed(d, OTHER))).toBe('warning');
    });

    it('段階3に達していなかった地震で5強以上が分かれば段階3を出す', () => {
      for (const from of ['warning', 'calm', 'cancelled']) {
        const d = applyDismiss(reach(from), 0, 'a@example.com').state;
        expect(stageOf(feed(d, HI))).toBe('evacuate');
        expect(stageOf(feed(d, LOW))).toBe('idle');
      }
    });

    it('段階3に達していた地震は、解除後に5強以上が来ても再表示しない', () => {
      const d = applyDismiss(reach('evacuate'), 0, 'a@example.com').state;
      expect(stageOf(feed(d, HI))).toBe('idle');
    });

    it('再表示のあとの解除では、同じ地震を再び抑止する', () => {
      const d = applyDismiss(reach('warning'), 0, 'a@example.com').state;
      const shown = feed(d, HI);
      const again = applyDismiss(shown, 0, 'a@example.com').state;
      expect(stageOf(feed(again, HI))).toBe('idle');
    });

    it('表示していないときの解除は何もしない', () => {
      const s = emptyRelayState();
      expect(applyDismiss(s, 0, 'a@example.com').state).toBe(s);
    });

    it('解除済みの記録は上限を超えたら古いものから捨てる', () => {
      let s = emptyRelayState();
      for (let i = 0; i < DISMISSED_LIMIT + 3; i++) {
        const r: EewReport = {
          ...P2P_WARN,
          eventId: `2026102310${String(i).padStart(4, '0')}`,
        };
        s = applyDismiss(feed(s, r), 0, 'a@example.com').state;
      }
      expect(s.dismissed).toHaveLength(DISMISSED_LIMIT);
    });
  });

  describe('payload', () => {
    it('表示なしは active:false', () => {
      expect(toPayload(emptyRelayState())).toEqual({ active: false });
    });

    it('段階1・取消はobservationを持たず、有効期限に関わる項目も持たない', () => {
      const p = toPayload(reach('cancelled'));
      expect(p).toMatchObject({ active: true, stage: 'cancelled' });
      expect(p).toHaveProperty('observation', null);
      expect(Object.keys(p).sort()).toEqual(
        [
          'active',
          'observation',
          'source',
          'stage',
          'startedAt',
          'training',
          'updatedAt',
        ].sort(),
      );
    });

    it('段階2は受信値を載せる', () => {
      expect(toPayload(reach('calm'))).toMatchObject({
        stage: 'calm',
        observation: { source: 'p2p', maebashiIntensity: '震度4' },
      });
    });
  });
});

describe('通知の判定', () => {
  const at = (r: QuakeReport) =>
    (r.kind === 'eqlist' ? r.originTime : r.issuedAt) + 5000;
  const run = (s: RelayState, r: QuakeReport, test = false) =>
    processReport(s, r, at(r), test);
  const kinds = (o: { notices: readonly QuakeNotice[] }) =>
    o.notices.map((n) => (n.kind === 'eew' ? `eew:${n.op}` : n.kind));
  const NO_GUNMA = eew('p2p', 'hand-p2p-556-no-gunma.json');
  const CANCEL = eew('p2p', 'hand-p2p-556-gunma-cancel.json');
  const HI = obs('hand-p2p-551-maebashi-5strong.json');
  const LOW = obs('hand-p2p-551-maebashi-4.json');
  const eqlist = normalizeMessage(
    'wolfxEqlist',
    fx('hand-wolfx-eqlist-shindo-4.json'),
    { test: false },
  ) as EqlistReport;

  it('群馬県を含む新しい警報は投稿し、段階1の通知が続く', () => {
    const o = run(emptyRelayState(), P2P_WARN);
    expect(kinds(o)).toEqual(['eew:post', 'stage']);
    expect(o.notices[0]).toMatchObject({ receivedAt: at(P2P_WARN) });
    expect(o.state.eew[0]?.notify).toBe(true);
  });

  it('群馬県を含まない警報は、試験モード以外では投稿しない', () => {
    const o = run(emptyRelayState(), NO_GUNMA);
    expect(o.notices).toEqual([]);
    expect(o.state.eew[0]?.notify).toBe(false);
    expect(kinds(run(emptyRelayState(), NO_GUNMA, true))).toEqual([
      'eew:post',
      'stage',
    ]);
  });

  it('投稿した地震の続報・取消は群馬県外でも投稿する', () => {
    const s = run(emptyRelayState(), P2P_WARN).state;
    const nonGunmaFollow: EewReport = { ...P2P_WARN, serial: 2, gunma: false };
    expect(kinds(run(s, nonGunmaFollow))).toEqual(['eew:post']);
    expect(kinds(run(s, CANCEL))).toEqual(['eew:post', 'stage']);
  });

  it('投稿していない地震の群馬県外の続報は投稿しない', () => {
    const s = run(emptyRelayState(), NO_GUNMA).state;
    expect(run(s, { ...NO_GUNMA, serial: 2 }).notices).toEqual([]);
  });

  it('置き換えは先の投稿の編集。段階の通知は出さない', () => {
    const s = run(emptyRelayState(), WOLFX_WARN).state;
    const o = run(s, P2P_WARN);
    expect(kinds(o)).toEqual(['eew:edit']);
    expect(o.notices[0]).toMatchObject({ report: { source: 'p2p' } });
  });

  it('投稿していない地震の置き換えは編集も投稿もしない', () => {
    const w = eew('wolfxEew', 'hand-wolfx-eew-no-gunma.json');
    const s = run(emptyRelayState(), w).state;
    expect(run(s, NO_GUNMA).notices).toEqual([]);
  });

  it('捨てた報は通知も状態の変化も出さない', () => {
    const s = run(emptyRelayState(), P2P_WARN).state;
    const o = run(s, WOLFX_WARN);
    expect(o.notices).toEqual([]);
    expect(o.state).toBe(s);
  });

  it('選別を通らない報は投稿しない', () => {
    const o = processReport(
      emptyRelayState(),
      P2P_WARN,
      P2P_WARN.issuedAt + 200_000,
      false,
    );
    expect(o.notices).toEqual([]);
  });

  it('解除済みの地震の続報・取消も投稿する(表示は出さない)', () => {
    const s = applyDismiss(
      run(emptyRelayState(), P2P_WARN).state,
      0,
      'a@example.com',
    ).state;
    const o = run(s, { ...P2P_WARN, serial: 2 });
    expect(kinds(o)).toEqual(['eew:post']);
    expect(o.state.alert).toBeNull();
  });

  describe('地震情報', () => {
    it('群馬県の観測点を含むP2Pの地震情報を、同じIDで1回だけ投稿する', () => {
      const o1 = run(emptyRelayState(), LOW);
      expect(kinds(o1)).toEqual(['observation']);
      const o2 = run(o1.state, LOW);
      expect(o2.notices).toEqual([]);
      expect(o2.state.seenObservation).toEqual([LOW.id]);
    });

    it('5強以上なら地震情報の投稿に段階3の通知が続く', () => {
      expect(kinds(run(emptyRelayState(), HI))).toEqual([
        'observation',
        'stage',
      ]);
    });

    it('群馬県の観測点が無い地震情報は投稿しない', () => {
      const o = run(emptyRelayState(), { ...LOW, gunmaStations: false });
      expect(o.notices).toEqual([]);
    });

    it('Wolfxの地震情報は投稿しない(段階2への通知だけ)', () => {
      const s = run(emptyRelayState(), P2P_WARN).state;
      expect(kinds(run(s, eqlist))).toEqual(['stage']);
    });

    it('解除済みの地震の地震情報も投稿する', () => {
      const s = applyDismiss(
        run(emptyRelayState(), P2P_WARN).state,
        0,
        'a@example.com',
      ).state;
      expect(kinds(run(s, LOW))).toEqual(['observation']);
    });

    it('投稿済みのIDは上限を超えたら古いものから捨てる', () => {
      let s = emptyRelayState();
      for (let i = 0; i < SEEN_OBSERVATION_LIMIT + 2; i++)
        s = run(s, { ...LOW, id: `id${i}` }).state;
      expect(s.seenObservation).toHaveLength(SEEN_OBSERVATION_LIMIT);
      expect(s.seenObservation[0]).toBe('id2');
    });
  });

  describe('段階の通知', () => {
    it('表示の有無・段階・訓練が変わったときだけ出す', () => {
      let o = run(emptyRelayState(), P2P_WARN);
      o = run(o.state, LOW);
      expect(o.notices.at(-1)).toMatchObject({
        kind: 'stage',
        payload: { active: true, stage: 'calm' },
      });
      // 受信値だけの変化では出さない
      const est = run(o.state, obs('hand-p2p-551-maebashi-46.json'));
      expect(kinds(est)).toEqual(['observation']);
    });

    it('続報では出さない', () => {
      const s = run(emptyRelayState(), P2P_WARN).state;
      expect(kinds(run(s, { ...P2P_WARN, serial: 2 }))).toEqual(['eew:post']);
    });

    it('訓練から本物へ変わるときは出す', () => {
      const train = run(
        emptyRelayState(),
        eew('p2p', 'hand-p2p-556-gunma-training.json'),
      );
      expect(train.notices.at(-1)).toMatchObject({
        payload: { training: true },
      });
      const other: EewReport = { ...P2P_WARN, eventId: '20261023100099' };
      expect(run(train.state, other).notices.at(-1)).toMatchObject({
        kind: 'stage',
        payload: { training: false },
      });
    });

    it('通知の訓練の別は報に従う(試験モードの報を含む)', () => {
      const o = run(emptyRelayState(), P2P_WARN, true);
      expect(o.notices[0]).toMatchObject({ report: { training: false } });
      const t = normalizeMessage('p2p', fx('hand-p2p-556-gunma-warning.json'), {
        test: true,
      }) as EewReport;
      const o2 = run(emptyRelayState(), t, true);
      expect(o2.notices[0]).toMatchObject({ report: { training: true } });
      expect(o2.notices[1]).toMatchObject({ payload: { training: true } });
    });
  });

  describe('解除の通知', () => {
    it('表示中だけ、解除した実行委員を載せて出す', () => {
      const s = run(emptyRelayState(), P2P_WARN).state;
      const o = applyDismiss(s, 1234, 'a@example.com');
      expect(o.notices).toEqual([
        { kind: 'dismissed', by: 'a@example.com', training: false, at: 1234 },
      ]);
      expect(applyDismiss(o.state, 1, 'b@example.com').notices).toEqual([]);
    });

    it('訓練の表示の解除は訓練として通知する', () => {
      const s = run(
        emptyRelayState(),
        eew('p2p', 'hand-p2p-556-gunma-training.json'),
      ).state;
      expect(applyDismiss(s, 0, 'a').notices[0]).toMatchObject({
        training: true,
      });
    });
  });
});

describe('メッセージIDの保存', () => {
  const key = (r: EewReport) => ({
    eventId: r.eventId,
    serial: r.serial,
    cancelled: r.cancelled,
  });
  const s1 = processReport(
    emptyRelayState(),
    P2P_WARN,
    P2P_WARN.issuedAt + 1000,
    false,
  ).state;

  it('同じ報の記録に保存する', () => {
    const s = recordDiscordMessage(s1, key(P2P_WARN), 'm1');
    expect(s.eew[0]?.discordMessageId).toBe('m1');
  });

  it('記録が新しい報に進んでいれば書き換えない', () => {
    const s2 = processReport(
      s1,
      { ...P2P_WARN, serial: 2 },
      P2P_WARN.issuedAt + 2000,
      false,
    ).state;
    expect(recordDiscordMessage(s2, key(P2P_WARN), 'm1')).toBe(s2);
    const c = processReport(
      s2,
      { ...P2P_WARN, serial: 2, cancelled: true },
      P2P_WARN.issuedAt + 3000,
      false,
    ).state;
    expect(recordDiscordMessage(c, { ...key(P2P_WARN), serial: 2 }, 'm')).toBe(
      c,
    );
  });

  it('記録の無い地震には何もしない', () => {
    expect(
      recordDiscordMessage(
        s1,
        { eventId: 'x', serial: 1, cancelled: false },
        'm',
      ),
    ).toBe(s1);
  });
});

describe('受信状態', () => {
  const T0 = 1_000_000_000_000;
  const input = (lastReceivedAt: number | null, bootedAt = T0) => ({
    connected: true,
    lastReceivedAt,
    bootedAt,
    missed: false,
  });

  it('閾値はWolfxのみ3分', () => {
    expect(SILENCE_LIMIT_MS).toEqual({
      wolfxEew: 180_000,
      wolfxEqlist: 180_000,
    });
    expect(isReceiving('wolfxEew', input(T0), T0 + 180_000)).toBe(true);
    expect(isReceiving('wolfxEew', input(T0), T0 + 180_001)).toBe(false);
  });

  it('P2Pは無受信が50分でも、取りこぼしが無ければ受信中', () => {
    expect(isReceiving('p2p', input(T0), T0 + 50 * 60_000)).toBe(true);
    expect(isReceiving('p2p', { ...input(T0), missed: true }, T0 + 1)).toBe(
      false,
    );
  });

  it('起動直後は未受信でも、閾値まで受信できているとみなす', () => {
    expect(isReceiving('wolfxEew', input(null), T0 + 179_000)).toBe(true);
    expect(isReceiving('wolfxEew', input(null), T0 + 181_000)).toBe(false);
  });

  it('起動より前の受信時刻は猶予の基準にしない', () => {
    expect(isReceiving('wolfxEew', input(T0 - 600_000), T0 + 1000)).toBe(true);
  });

  it('受信すると戻る', () => {
    expect(isReceiving('wolfxEew', input(T0 + 1_000_000), T0 + 1_001_000)).toBe(
      true,
    );
  });

  it('P2PとWolfx(緊急地震速報)がともに受信できないときだけ受信不能', () => {
    const r = (p2p: boolean, wolfxEew: boolean, wolfxEqlist = true) => ({
      p2p,
      wolfxEew,
      wolfxEqlist,
    });
    expect(isReceptionLost(r(false, false))).toBe(true);
    expect(isReceptionLost(r(false, true))).toBe(false);
    expect(isReceptionLost(r(true, false))).toBe(false);
    expect(isReceptionLost(r(false, true, false))).toBe(false);
    expect(isReceptionLost(r(true, true, false))).toBe(false);
  });
});
