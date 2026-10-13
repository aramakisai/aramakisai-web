import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/cms', () => ({ cms: {} }));
vi.mock('@/env', () => ({
  env: { NEXT_PUBLIC_CMS_URL: 'http://localhost:3100' },
}));

import type { SignageSlide, SignageSnapshot } from '@/lib/signage';
import type { SignageQuakePayload } from '@/lib/signage-quake';
import { SignageQuakeOverlay } from './signage-quake-overlay';

type Active = Extract<SignageQuakePayload, { active: true }>;
const NOTE = '気象庁が発表した情報を転送した参考情報です。';
const now = new Date('2026-11-01T05:12:00Z');
const quake = (over: Partial<Active> = {}): Active => ({
  active: true,
  stage: 'warning',
  training: false,
  source: 'p2p',
  startedAt: '2026-11-01T05:12:00Z',
  updatedAt: '2026-11-01T05:12:00Z',
  observation: null,
  ...over,
});
const obs = {
  source: 'p2p' as const,
  originTime: '2026/11/01 14:12:00',
  hypocenter: '群馬県南部',
  maebashiIntensity: '震度5強' as string | null,
  maxIntensity: '震度6弱' as string | null,
};
const layoutSlide: SignageSlide = {
  id: 1,
  durationSec: 10,
  kind: 'layout',
  layout: 'title',
  tone: 'normal',
  title: '運営のスライド',
  subtext: null,
  content1Html: '',
  content2Html: '',
};
const snapshot = {} as SignageSnapshot;
const renderers = {
  layout: () => <div data-testid="slide">運営のスライド</div>,
};
const view = (q: Active, slide: SignageSlide | null = null) =>
  render(
    <SignageQuakeOverlay
      quake={q}
      slide={slide}
      snapshot={snapshot}
      now={now}
      renderers={renderers}
    />,
  );
const text = (c: HTMLElement) => c.textContent ?? '';

describe('SignageQuakeOverlay', () => {
  it('段階ごとに帯の地の色を変える(段階1・3は warning、段階2は bansai-sage、取消は gray-200)', () => {
    const cls = (stage: Active['stage']) => {
      const { container, unmount } = view(quake({ stage, observation: obs }));
      const c = container.querySelector('[data-quake-band]')!.className;
      unmount();
      return c;
    };
    expect(cls('warning')).toContain('bg-warning');
    expect(cls('calm')).toContain('bg-bansai-sage');
    expect(cls('evacuate')).toContain('bg-warning');
    expect(cls('cancelled')).toContain('bg-gray-200');
  });

  it('公式の警報でない旨を横長・縦長の両方の注記に常に出す', () => {
    const { container } = view(quake());
    const notes = container.querySelectorAll('[data-quake-note]');
    expect(notes).toHaveLength(2);
    for (const n of notes) {
      expect(text(n as HTMLElement)).toContain(
        NOTE + '公式の警報ではありません',
      );
    }
  });

  it('訓練のときは全段階で訓練の印を出し、そうでなければ出さない', () => {
    for (const stage of ['warning', 'calm', 'evacuate', 'cancelled'] as const) {
      const on = view(quake({ stage, training: true, observation: obs }));
      expect(
        on.container.querySelectorAll('[data-quake-training]').length,
      ).toBe(2);
      on.unmount();
    }
    const off = view(quake());
    expect(off.container.querySelector('[data-quake-training]')).toBeNull();
  });

  it('段階2・段階3は発生・震源・前橋市の震度と、地震情報の情報源を出す', () => {
    const { container } = view(
      quake({ stage: 'evacuate', observation: { ...obs, source: 'wolfx' } }),
    );
    const band = container.querySelector('[data-quake-band]') as HTMLElement;
    expect(text(band)).toContain('11/1 14:12頃');
    expect(text(band)).toContain('群馬県南部');
    expect(text(band)).toContain('震度5強');
    expect(text(band)).toContain('情報源 Wolfx');
  });

  it('前橋市が無いとき、P2Pは「前橋市の観測点の発表なし」、Wolfxは最大震度を出す', () => {
    const p2p = view(
      quake({
        stage: 'calm',
        observation: { ...obs, maebashiIntensity: null },
      }),
    );
    expect(text(p2p.container)).toContain('前橋市の観測点の発表なし');
    p2p.unmount();
    const wolfx = view(
      quake({
        stage: 'calm',
        observation: {
          ...obs,
          source: 'wolfx',
          maebashiIntensity: null,
          maxIntensity: '震度4',
        },
      }),
    );
    const band = wolfx.container.querySelector(
      '[data-quake-band]',
    ) as HTMLElement;
    expect(text(band)).toContain('最大震度');
    expect(text(band)).toContain('震度4');
    expect(text(band)).not.toContain('前橋市');
  });

  it('段階1・取消は受信値を出さず、警報の情報源を出す。予想値の語も出さない', () => {
    for (const stage of ['warning', 'cancelled'] as const) {
      const { container, unmount } = view(quake({ stage, source: 'wolfx' }));
      const band = container.querySelector('[data-quake-band]') as HTMLElement;
      expect(text(band)).toContain('情報源 Wolfx');
      expect(text(band)).not.toContain('発生');
      expect(text(container)).not.toMatch(/予想|猶予|秒後|到達/);
      unmount();
    }
  });

  it('スライドが無いときは段階の既定の文言を枠に出す', () => {
    const { container } = view(quake({ stage: 'calm' }));
    expect(
      text(container.querySelector('.signage-main') as HTMLElement),
    ).toContain('その場で落ち着いてお待ちください');
  });

  it('ページの無いスライドも既定の文言にする', () => {
    const { container } = view(quake(), {
      id: 2,
      durationSec: 10,
      kind: 'image',
      image: null,
    });
    expect(
      text(container.querySelector('.signage-main') as HTMLElement),
    ).toContain('頭を守ってください');
  });

  it('スライドがあれば枠にそのスライドを出す', () => {
    view(quake(), layoutSlide);
    expect(screen.getByTestId('slide')).toBeTruthy();
  });

  it('音を鳴らす要素を持たない', () => {
    const { container } = view(quake());
    expect(container.querySelector('audio, video, embed')).toBeNull();
  });
});
