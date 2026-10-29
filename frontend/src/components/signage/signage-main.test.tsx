import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PlaylistEntry, SignageSnapshot } from '@/lib/signage';
import type { StageStartNotice } from '@/lib/signage-stage-notice';
import { SignageHeadingChip } from './signage-heading-chip';
import { SignageMain } from './signage-main';

const entry: PlaylistEntry = {
  key: '1:0',
  page: 0,
  slide: { id: 1, durationSec: 10, kind: 'parking' },
};
const snapshot = {} as SignageSnapshot;
const now = new Date('2026-11-14T00:00:00Z');

describe('SignageMain', () => {
  it('種別に対応する部品へ entry・snapshot・now を渡す', () => {
    render(
      <SignageMain
        entry={entry}
        snapshot={snapshot}
        now={now}
        renderers={{
          parking: (p) => (
            <div data-testid="parking">{`${p.entry.key}|${p.now.toISOString()}`}</div>
          ),
        }}
      />,
    );
    expect(screen.getByTestId('parking').textContent).toBe(
      '1:0|2026-11-14T00:00:00.000Z',
    );
  });

  it('項目が0件、または部品が未登録なら空の地だけを出す', () => {
    const { container, rerender } = render(
      <SignageMain entry={null} snapshot={snapshot} now={now} renderers={{}} />,
    );
    expect(container.querySelector('.signage-main')?.childElementCount).toBe(0);
    rerender(
      <SignageMain
        entry={entry}
        snapshot={snapshot}
        now={now}
        renderers={{}}
      />,
    );
    expect(container.querySelector('.signage-main')?.childElementCount).toBe(0);
  });
});

describe('SignageMain transition', () => {
  const renderers = { parking: () => <div data-testid="parking" /> };
  const layer = (transition?: boolean) => {
    const { getByTestId } = render(
      <SignageMain
        entry={entry}
        snapshot={snapshot}
        now={now}
        renderers={renderers}
        transition={transition}
      />,
    );
    return getByTestId('parking').parentElement!;
  };

  it('既定ではフェードインのレイヤーで包む', () => {
    expect(layer().classList.contains('fade-in')).toBe(true);
  });

  it('transition=false ではアニメーションを付けない', () => {
    expect(layer(false).classList.contains('fade-in')).toBe(false);
  });

  it('スライドが切り替わると旧スライドを残して重ね、transition=false では残さない', () => {
    const next: PlaylistEntry = { ...entry, key: '2:0' };
    const ui = (e: PlaylistEntry, transition: boolean) => (
      <SignageMain
        entry={e}
        snapshot={snapshot}
        now={now}
        renderers={{ parking: (p) => <div>{p.entry.key}</div> }}
        transition={transition}
      />
    );
    const { rerender, queryByText } = render(ui(entry, true));
    rerender(ui(next, true));
    expect(queryByText('1:0')).toBeTruthy();
    expect(queryByText('2:0')).toBeTruthy();
    rerender(ui(entry, false));
    expect(queryByText('2:0')).toBeNull();
  });
});

describe('SignageHeadingChip', () => {
  it('アイコンと文字を出す', () => {
    render(<SignageHeadingChip icon="handshake" label="ご協賛" />);
    expect(screen.getByText('handshake').className).toContain(
      'material-symbols-sharp',
    );
    expect(screen.getByText('ご協賛')).toBeTruthy();
  });
});

describe('SignageMain 告知の層', () => {
  const renderers = { parking: () => <div data-testid="parking" /> };
  const n = (id: number): StageStartNotice => ({
    performanceId: id,
    name: `出演${id}`,
    stageName: 'ステージ',
    colorIndex: 0,
    startAt: new Date(now.getTime() + 120_000).toISOString(),
  });
  const ui = (notices?: readonly StageStartNotice[]) => (
    <SignageMain
      entry={entry}
      snapshot={snapshot}
      now={now}
      renderers={renderers}
      notices={notices}
    />
  );
  const layer = (c: HTMLElement) =>
    c.querySelector<HTMLElement>('[data-stage-notice]');

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('告知が無ければ層を出さない', () => {
    const { container } = render(ui());
    expect(layer(container)).toBeNull();
  });

  it('告知があればスライドを残したまま、その後の子として層を重ねる', () => {
    const { container, getByTestId } = render(ui([n(1)]));
    const main = container.querySelector('.signage-main')!;
    expect(getByTestId('parking')).toBeTruthy();
    expect(main.lastElementChild).toBe(layer(container));
    expect(layer(container)!.dataset.leaving).toBe('false');
  });

  it('空になってから0.9秒は退場中で残り、その後に外れる', () => {
    const { container, rerender } = render(ui([n(1)]));
    rerender(ui([]));
    expect(layer(container)!.dataset.leaving).toBe('true');
    expect(layer(container)!.textContent).toContain('出演1');
    act(() => {
      vi.advanceTimersByTime(899);
    });
    expect(layer(container)).not.toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(layer(container)).toBeNull();
  });

  it('退場中に告知が戻ったら層をマウントし直して入場から出し直す', () => {
    const { container, rerender } = render(ui([n(1)]));
    const first = layer(container);
    rerender(ui([]));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender(ui([n(2)]));
    const second = layer(container)!;
    expect(second).not.toBe(first);
    expect(second.dataset.leaving).toBe('false');
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(layer(container)).toBe(second);
  });

  it('退場中でなく告知が増減しただけなら層を作り直さない', () => {
    const { container, rerender } = render(ui([n(1)]));
    const first = layer(container);
    rerender(ui([n(1), n(2)]));
    expect(layer(container)).toBe(first);
    rerender(ui([n(2)]));
    expect(layer(container)).toBe(first);
  });

  it('内容が同じ新しい配列を毎回渡しても状態更新が止まらなくならない', () => {
    const { container, rerender } = render(ui([n(1)]));
    for (let i = 0; i < 5; i++) rerender(ui([n(1)]));
    expect(layer(container)).not.toBeNull();
  });
});
