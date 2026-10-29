import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { StageStartNotice } from '@/lib/signage-stage-notice';
import { SignageStageNotice } from './signage-stage-notice';

const NOW = new Date('2026-11-14T03:00:00.000Z');
const startIn = (sec: number) =>
  new Date(NOW.getTime() + sec * 1000).toISOString();

const notice = (
  id: number,
  name: string,
  stageName: string,
  colorIndex: number,
  sec = 150,
): StageStartNotice => ({
  performanceId: id,
  name,
  stageName,
  colorIndex,
  startAt: startIn(sec),
});

const one = [notice(1, '吹奏楽部 定期演奏会', 'メインステージ', 0)];
const four = [
  notice(1, '吹奏楽部', 'メインステージ', 0),
  notice(2, 'ダンスサークル FLOW', '中庭ステージ', 1),
  notice(3, '合唱団', '講義棟ステージ', 2),
  notice(4, '軽音部', 'GB155', 3),
];

const shapes = (c: HTMLElement) =>
  Array.from(c.querySelectorAll<HTMLElement>('[data-notice-shape]'));
const beatOf = (shape: HTMLElement) =>
  shape.querySelector<HTMLElement>('[data-notice-beat]')!;

describe('SignageStageNotice', () => {
  it('1件はチップ・まもなく・出演名・が始まりますの順に出す', () => {
    const { container } = render(
      <SignageStageNotice notices={one} now={NOW} leaving={false} />,
    );
    const text = container.querySelector('[data-notice-text]')!;
    expect(Array.from(text.children).map((c) => c.textContent)).toEqual([
      'メインステージ',
      'まもなく',
      '吹奏楽部 定期演奏会',
      'が始まります',
    ]);
    expect(text.querySelector('.line-clamp-2')?.textContent).toBe(
      '吹奏楽部 定期演奏会',
    );
  });

  it('4件はまもなく・行(チップ+出演名)の並び・が始まりますの順に出す', () => {
    const { container } = render(
      <SignageStageNotice notices={four} now={NOW} leaving={false} />,
    );
    const text = container.querySelector('[data-notice-text]')!;
    const rows = Array.from(text.querySelectorAll('[data-notice-row]'));
    expect(rows.map((r) => r.textContent)).toEqual([
      'メインステージ吹奏楽部',
      '中庭ステージダンスサークル FLOW',
      '講義棟ステージ合唱団',
      'GB155軽音部',
    ]);
    expect(text.children[0].textContent).toBe('まもなく');
    expect(text.lastElementChild?.textContent).toBe('が始まります');
  });

  it('チップの色は colorIndex の割り当てに従う', () => {
    const { container } = render(
      <SignageStageNotice notices={four} now={NOW} leaving={false} />,
    );
    const chips = Array.from(
      container.querySelectorAll('[data-notice-chip]'),
    ).map((c) => c.className);
    expect(chips[0]).toContain('bg-bansai-ochre');
    expect(chips[1]).toContain('bg-bansai-sage');
    expect(chips[2]).toContain('bg-bansai-salmon');
    expect(chips[3]).toContain('bg-bansai-wisteria');
  });

  it('図形は9個、輪は2つ描く', () => {
    const { container } = render(
      <SignageStageNotice notices={one} now={NOW} leaving={false} />,
    );
    expect(shapes(container)).toHaveLength(9);
    expect(container.querySelectorAll('[data-bg-ring]')).toHaveLength(2);
  });

  it('leaving で文字・白の地・図形が退場の動きに切り替わる', () => {
    const { container, rerender } = render(
      <SignageStageNotice notices={one} now={NOW} leaving={false} />,
    );
    const text = container.querySelector<HTMLElement>('[data-notice-text]')!;
    const back = container.querySelector<HTMLElement>(
      '[data-notice-backdrop]',
    )!;
    expect(text.style.animation).toContain('fade-in');
    expect(shapes(container)[0].style.animation).toContain('notice-gather');
    rerender(<SignageStageNotice notices={one} now={NOW} leaving />);
    expect(text.style.animation).toContain('fade-out');
    expect(text.style.animation).toContain('0.3s');
    expect(back.style.animation).toContain('0.4s');
    expect(back.style.animation).toContain('0.5s');
    expect(shapes(container)[0].style.animation).toContain('notice-leave');
  });

  it('notices の件数が変わっても図形は再マウントされない', () => {
    const { container, rerender } = render(
      <SignageStageNotice notices={one} now={NOW} leaving={false} />,
    );
    const before = shapes(container);
    rerender(<SignageStageNotice notices={four} now={NOW} leaving={false} />);
    const after = shapes(container);
    expect(after).toHaveLength(9);
    after.forEach((el, i) => expect(el).toBe(before[i]));
  });

  it('拍は集合が終わってから始まり、BPM が変わったときだけ animation-delay を取り直す', () => {
    const { container, rerender } = render(
      <SignageStageNotice notices={one} now={NOW} leaving={false} />,
    );
    const first = shapes(container)[3];
    expect(beatOf(first).style.animation).toBe('');
    // jsdom に AnimationEvent が無く animationName が渡らないため、素の Event に足す
    fireEvent(
      first,
      Object.assign(new Event('animationend', { bubbles: true }), {
        animationName: 'notice-gather',
      }),
    );
    // 残り150秒 → 100BPM (周期 0.6s)
    const a = beatOf(first).style.animation;
    expect(a).toContain('0.6s');

    rerender(
      <SignageStageNotice
        notices={one}
        now={new Date(NOW.getTime() + 1234)}
        leaving={false}
      />,
    );
    expect(beatOf(first).style.animation).toBe(a);

    // 残り30秒未満 → 140BPM
    const near = [notice(1, '吹奏楽部 定期演奏会', 'メインステージ', 0, 20)];
    rerender(
      <SignageStageNotice
        notices={near}
        now={new Date(NOW.getTime() + 1234)}
        leaving={false}
      />,
    );
    expect(beatOf(first).style.animation).not.toBe(a);
    expect(beatOf(first).style.animation).toContain('0.428');
  });
});
