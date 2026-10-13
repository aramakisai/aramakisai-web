import { describe, expect, it } from 'vitest';
import {
  QUAKE_DEFAULT_COPY,
  p2pScaleLabel,
  parseQuakePayload,
} from './signage-quake';

const observation = {
  source: 'p2p',
  originTime: '2023/05/26 19:03:00',
  hypocenter: '千葉県東方沖',
  maebashiIntensity: '震度2',
  maxIntensity: '震度4',
};

const active = {
  active: true,
  stage: 'calm',
  training: false,
  source: 'p2p',
  startedAt: '2026-10-23T00:00:00.000Z',
  updatedAt: '2026-10-23T00:01:00.000Z',
  observation,
};

describe('parseQuakePayload', () => {
  it('active:false を通す', () => {
    expect(parseQuakePayload({ active: false })).toEqual({ active: false });
  });

  it('段階2の完全な形を通す', () => {
    expect(parseQuakePayload(active)).toEqual(active);
  });

  it('observation が null の段階1を通す', () => {
    const p = { ...active, stage: 'warning', observation: null };
    expect(parseQuakePayload(p)).toEqual(p);
  });

  it('震度が null の observation を通す', () => {
    const p = {
      ...active,
      observation: {
        ...observation,
        maebashiIntensity: null,
        maxIntensity: null,
      },
    };
    expect(parseQuakePayload(p)).toEqual(p);
  });

  it.each([
    ['null', null],
    ['文字列', 'x'],
    ['配列', []],
    ['active が真偽値でない', { active: 1 }],
    ['未知の段階', { ...active, stage: 'panic' }],
    ['training が真偽値でない', { ...active, training: 'no' }],
    ['未知の情報源', { ...active, source: 'jma' }],
    ['startedAt が無い', { ...active, startedAt: undefined }],
    ['startedAt が日時でない', { ...active, startedAt: 'あした' }],
    ['updatedAt が数値', { ...active, updatedAt: 1 }],
    ['observation が無い', { ...active, observation: undefined }],
    [
      'observation の震源が数値',
      { ...active, observation: { ...observation, hypocenter: 1 } },
    ],
    [
      'observation の情報源が不正',
      { ...active, observation: { ...observation, source: 'x' } },
    ],
    [
      'observation の震度が数値',
      { ...active, observation: { ...observation, maxIntensity: 4 } },
    ],
  ])('形が合わなければ null: %s', (_name, value) => {
    expect(parseQuakePayload(value)).toBeNull();
  });

  it('予想震度・到達予想時刻・猶予秒数は結果に残さない', () => {
    const parsed = parseQuakePayload({
      ...active,
      expectedIntensity: '震度5強',
      arrivalTime: '19:03:10',
      graceSeconds: 10,
    });
    expect(parsed).toEqual(active);
  });
});

describe('p2pScaleLabel', () => {
  it.each([
    [10, '震度1'],
    [20, '震度2'],
    [30, '震度3'],
    [40, '震度4'],
    [45, '震度5弱'],
    [46, '震度5弱以上(推定)'],
    [50, '震度5強'],
    [55, '震度6弱'],
    [60, '震度6強'],
    [70, '震度7'],
  ])('%i は %s', (code, label) => {
    expect(p2pScaleLabel(code)).toBe(label);
  });

  it.each([-1, 0, 15, 99, NaN])('未知のコード %s は null', (code) => {
    expect(p2pScaleLabel(code)).toBeNull();
  });
});

describe('QUAKE_DEFAULT_COPY', () => {
  it('4段階すべてに見出しと箇条を持つ', () => {
    for (const stage of ['warning', 'calm', 'evacuate', 'cancelled'] as const) {
      expect(QUAKE_DEFAULT_COPY[stage].heading).not.toBe('');
      expect(QUAKE_DEFAULT_COPY[stage].lines.length).toBeGreaterThan(0);
    }
    expect(QUAKE_DEFAULT_COPY.warning.heading).toBe(
      '地震です。落ち着いて身を守ってください',
    );
    expect(QUAKE_DEFAULT_COPY.warning.lines).toEqual([
      '頭を守ってください',
      '窓や吊り下げ物から離れてください',
      '出口に走らないでください',
    ]);
  });
});
