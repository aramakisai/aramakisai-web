import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { formatNotice } from './discord';
import type { QuakeNotice } from './relay-core';
import {
  normalizeMessage,
  type EewReport,
  type ObservationReport,
} from './upstream';
import type { SignageQuakePayload } from '../../src/lib/signage-quake';

const fx = (name: string) =>
  readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');
const eew = (ch: 'p2p' | 'wolfxEew', name: string, test = false) =>
  normalizeMessage(ch, fx(name), { test }) as EewReport;
const obs = (name: string, test = false) =>
  normalizeMessage('p2p', fx(name), { test }) as ObservationReport;

// 2026-10-23 10:00:09 JST
const RECEIVED = Date.parse('2026-10-23T01:00:09Z');
const FOOTER = '気象庁発表の転送・参考情報(公式の警報ではない)';

const eewNotice = (
  report: EewReport,
  op: 'post' | 'edit' = 'post',
): QuakeNotice => ({ kind: 'eew', op, report, receivedAt: RECEIVED });

const lines = (n: QuakeNotice) => formatNotice(n).content.split('\n');

describe('警報', () => {
  const warning = eew('p2p', 'hand-p2p-556-gunma-warning.json');

  it('第1報の文面', () => {
    expect(lines(eewNotice(warning))).toEqual([
      '【緊急地震速報(警報)】第1報',
      '震源地: 群馬県南部 / M6.1 / 深さ10km',
      '発生時刻: 2026/10/23 10:00:00 / 発表時刻: 2026/10/23 10:00:08',
      '予想震度・到達予想時刻',
      '・群馬県南部: 震度5強〜震度6弱、到達予想時刻 2026/10/23 10:00:12',
      '・埼玉県北部: 震度5弱〜震度5強、既に到達と予測',
      '・栃木県南部: 震度4以上、到達予想なし',
      '情報源: P2P地震情報(受信 2026/10/23 10:00:09)',
      FOOTER,
    ]);
  });

  it('第2報以降は続報', () => {
    const r = eew('p2p', 'hand-p2p-556-gunma-followup.json');
    expect(lines(eewNotice(r))[0]).toBe('【緊急地震速報(警報)】第2報(続報)');
  });

  it('Wolfx の最終報', () => {
    const r = eew('wolfxEew', 'hand-wolfx-eew-gunma-final.json');
    expect(lines(eewNotice(r))[0]).toBe('【緊急地震速報(警報)】第4報(最終報)');
  });

  it('Wolfx の文面は受信した震度の文字列と情報源を出す', () => {
    const r = eew('wolfxEew', 'hand-wolfx-eew-gunma-warning.json');
    const l = lines(eewNotice(r));
    expect(l).toContain(
      '・群馬県南部: 震度5-〜震度5+、到達予想時刻 2026/10/23 10:00:12',
    );
    expect(l).toContain('・埼玉県北部: 震度4〜震度5-、既に到達と予測');
    expect(l).toContain('情報源: Wolfx(受信 2026/10/23 10:00:09)');
  });

  it('取消', () => {
    const r = eew('p2p', 'hand-p2p-556-gunma-cancel.json');
    expect(lines(eewNotice(r))).toEqual([
      '【緊急地震速報(取消)】第3報',
      '震源地: 不明 / M不明 / 深さ不明',
      '発生時刻: 不明 / 発表時刻: 2026/10/23 10:00:30',
      '情報源: P2P地震情報(受信 2026/10/23 10:00:09)',
      FOOTER,
    ]);
  });

  it('群馬県南部を先頭にし、残りは受信順', () => {
    const o = JSON.parse(fx('hand-p2p-556-gunma-warning.json'));
    o.areas = [o.areas[1], o.areas[2], o.areas[0]];
    const r = normalizeMessage('p2p', JSON.stringify(o), {
      test: false,
    }) as EewReport;
    const names = lines(eewNotice(r))
      .filter((l) => l.startsWith('・'))
      .map((l) => l.slice(1, l.indexOf(':')));
    expect(names).toEqual(['群馬県南部', '埼玉県北部', '栃木県南部']);
  });

  it('編集は投稿と同じ文面', () => {
    expect(formatNotice(eewNotice(warning, 'edit'))).toEqual(
      formatNotice(eewNotice(warning, 'post')),
    );
  });

  it('値が無いものは「不明」', () => {
    const o = JSON.parse(fx('hand-p2p-556-gunma-warning.json'));
    o.earthquake.hypocenter.magnitude = -1;
    o.earthquake.hypocenter.depth = -1;
    o.areas[0].arrivalTime = null;
    o.areas[0].kindCode = '10';
    const r = normalizeMessage('p2p', JSON.stringify(o), {
      test: false,
    }) as EewReport;
    const l = lines(eewNotice(r));
    expect(l[1]).toBe('震源地: 群馬県南部 / M不明 / 深さ不明');
    expect(l).toContain('・群馬県南部: 震度5強〜震度6弱、到達予想時刻 不明');
  });

  it('訓練の報は先頭行に【訓練】', () => {
    const r = eew('p2p', 'hand-p2p-556-gunma-training.json');
    expect(lines(eewNotice(r))[0]).toBe('【訓練】');
    expect(lines(eewNotice(r))[1]).toBe('【緊急地震速報(警報)】第1報');
  });

  it('試験モードの系統の報は訓練', () => {
    const r = eew('p2p', 'hand-p2p-556-gunma-warning.json', true);
    expect(lines(eewNotice(r))[0]).toBe('【訓練】');
  });

  it('2000文字を超えるときは群馬県以外の地域を後ろから省く', () => {
    const o = JSON.parse(fx('hand-p2p-556-gunma-warning.json'));
    const others = Array.from({ length: 80 }, (_, i) => ({
      arrivalTime: '2026/10/23 10:00:30',
      kindCode: '10',
      name: `北海道テスト地域${i}${'あ'.repeat(10)}`,
      pref: '北海道',
      scaleFrom: 40,
      scaleTo: 50,
    }));
    o.areas = [others[0], o.areas[0], ...others.slice(1)];
    const r = normalizeMessage('p2p', JSON.stringify(o), {
      test: false,
    }) as EewReport;
    const { content } = formatNotice(eewNotice(r));
    expect(content.length).toBeLessThanOrEqual(2000);
    const l = content.split('\n');
    expect(l).toContain(
      '・群馬県南部: 震度5強〜震度6弱、到達予想時刻 2026/10/23 10:00:12',
    );
    expect(l.some((x) => /^・ほか\d+地域$/.test(x))).toBe(true);
    expect(l.at(-1)).toBe(FOOTER);
    const shown = l.filter(
      (x) => x.startsWith('・') && !x.startsWith('・ほか'),
    );
    const omitted = Number(/ほか(\d+)地域/.exec(content)![1]);
    expect(shown.length + omitted).toBe(81);
    expect(shown[1]).toContain('北海道テスト地域0');
  });

  it('メンションを起こさない', () => {
    const o = JSON.parse(fx('hand-p2p-556-gunma-warning.json'));
    o.earthquake.hypocenter.name = '@everyone';
    const r = normalizeMessage('p2p', JSON.stringify(o), {
      test: false,
    }) as EewReport;
    expect(formatNotice(eewNotice(r)).allowed_mentions).toEqual({ parse: [] });
  });
});

describe('地震情報', () => {
  const n = (r: ObservationReport): QuakeNotice => ({
    kind: 'observation',
    report: r,
    receivedAt: RECEIVED,
  });

  it('前橋市の震度を載せる', () => {
    expect(lines(n(obs('hand-p2p-551-maebashi-5strong.json')))).toEqual([
      '【地震情報】各地の震度に関する情報',
      '震源地: 群馬県南部 / M6.1 / 深さ10km',
      '発生時刻: 2026/10/23 10:00:00 / 発表時刻: 2026/10/23 10:04:00',
      '前橋市の震度: 震度5強',
      '情報源: P2P地震情報(受信 2026/10/23 10:00:09)',
      FOOTER,
    ]);
  });

  it('46 は推定の表示名', () => {
    expect(lines(n(obs('hand-p2p-551-maebashi-46.json')))).toContain(
      '前橋市の震度: 震度5弱以上(推定)',
    );
  });

  it('前橋市が載らないとき', () => {
    expect(lines(n(obs('hand-p2p-551-gunma-no-maebashi.json')))).toContain(
      '前橋市の観測点の発表なし',
    );
  });

  it('試験モードは訓練', () => {
    expect(lines(n(obs('hand-p2p-551-maebashi-5strong.json', true)))[0]).toBe(
      '【訓練】',
    );
  });
});

describe('段階・解除', () => {
  const payload = (
    stage: 'warning' | 'calm' | 'evacuate' | 'cancelled',
    training = false,
  ): SignageQuakePayload => ({
    active: true,
    stage,
    training,
    source: 'p2p',
    startedAt: '2026-10-23T01:00:09.000Z',
    updatedAt: '2026-10-23T01:00:09.000Z',
    observation: null,
  });
  const stage = (p: SignageQuakePayload): QuakeNotice => ({
    kind: 'stage',
    payload: p,
    at: RECEIVED,
  });

  it.each([
    ['warning', '【サイネージ】段階1(身を守る)を表示しました'],
    ['calm', '【サイネージ】段階2(揺れは収まりました)を表示しました'],
    ['evacuate', '【サイネージ】段階3(スタッフの指示待ち)を表示しました'],
    ['cancelled', '【サイネージ】取消の表示にしました'],
  ] as const)('%s', (s, text) => {
    expect(lines(stage(payload(s)))).toEqual([text, FOOTER]);
  });

  it('訓練の表示は先頭行に【訓練】', () => {
    expect(lines(stage(payload('warning', true)))).toEqual([
      '【訓練】',
      '【サイネージ】段階1(身を守る)を表示しました',
      FOOTER,
    ]);
  });

  it('表示が終わった payload', () => {
    expect(lines(stage({ active: false }))).toEqual([
      '【サイネージ】速報の表示を終了しました',
      FOOTER,
    ]);
  });

  it('解除', () => {
    expect(
      lines({
        kind: 'dismissed',
        by: 'a@example.com',
        training: false,
        at: RECEIVED,
      }),
    ).toEqual([
      '【サイネージ】速報の表示を解除しました(解除: a@example.com)',
      FOOTER,
    ]);
  });

  it('訓練の解除は先頭行に【訓練】', () => {
    expect(
      lines({
        kind: 'dismissed',
        by: 'a@example.com',
        training: true,
        at: RECEIVED,
      })[0],
    ).toBe('【訓練】');
  });
});

describe('受信状態', () => {
  const ch = (
    channel: 'p2p' | 'wolfxEew' | 'wolfxEqlist',
    receiving: boolean,
    lastReceivedAt: number | null = Date.parse('2026-10-23T00:40:00Z'),
  ): QuakeNotice => ({
    kind: 'channel',
    channel,
    receiving,
    lastReceivedAt,
    at: RECEIVED,
  });

  it('P2P が受信できないときは段階3の判定ができない旨を足す', () => {
    expect(lines(ch('p2p', false))).toEqual([
      '【受信状態】P2P地震情報を受信できていません(最後の受信: 2026/10/23 09:40:00)',
      '前橋市の震度による段階3の判定ができません',
      FOOTER,
    ]);
  });

  it('Wolfx の緊急地震速報・地震情報', () => {
    expect(lines(ch('wolfxEew', false))[0]).toBe(
      '【受信状態】Wolfx緊急地震速報を受信できていません(最後の受信: 2026/10/23 09:40:00)',
    );
    expect(lines(ch('wolfxEqlist', false))[0]).toContain('Wolfx地震情報');
    expect(lines(ch('wolfxEew', false))).toHaveLength(2);
  });

  it('受信の記録が無いとき', () => {
    expect(lines(ch('wolfxEew', false, null))[0]).toBe(
      '【受信状態】Wolfx緊急地震速報を受信できていません(最後の受信: なし)',
    );
  });

  it('戻ったとき', () => {
    expect(lines(ch('p2p', true))).toEqual([
      '【受信状態】P2P地震情報の受信を再開しました',
      FOOTER,
    ]);
  });
});

describe('すべての文面', () => {
  it('最終行は公式でない旨、本文は 2000 文字以内', () => {
    const notices: QuakeNotice[] = [
      eewNotice(eew('p2p', 'hand-p2p-556-gunma-warning.json')),
      { kind: 'stage', payload: { active: false }, at: RECEIVED },
      { kind: 'dismissed', by: 'a@example.com', training: false, at: RECEIVED },
    ];
    for (const n of notices) {
      const { content } = formatNotice(n);
      expect(content.endsWith(FOOTER)).toBe(true);
      expect(content.length).toBeLessThanOrEqual(2000);
    }
  });
});
