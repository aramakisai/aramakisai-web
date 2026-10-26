// @vitest-environment jsdom
import { act, fireEvent, render } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import { TouchButton, TouchSegment } from './touch-segment';

const items = [
  { value: 'a', label: 'アー', color: 'bg-primary' },
  { value: 'b', label: 'ビー', color: 'bg-info' },
  { value: 'c', label: 'シー', color: 'bg-secondary' },
];

// jsdom はレイアウトしないので、ボタンの並び (幅 100・間隔 4・左余白 8) を再現する
beforeAll(() => {
  const index = (el: HTMLElement) =>
    Array.from(el.parentElement!.children).indexOf(el) - 1; // 先頭は背景
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return 100;
    },
  });
  Object.defineProperty(HTMLElement.prototype, 'offsetLeft', {
    configurable: true,
    get() {
      return 8 + index(this) * 104;
    },
  });
});
afterEach(() => vi.restoreAllMocks());

function Harness({ initial }: { initial: string | null }) {
  const [v, setV] = useState<string | null>(initial);
  return <TouchSegment size="page" items={items} value={v} onSelect={setV} />;
}

const bg = (c: HTMLElement) =>
  c.querySelector('[data-testid="touch-segment-bg"]') as HTMLElement;
const btn = (c: HTMLElement, label: string) =>
  Array.from(c.querySelectorAll('button')).find(
    (b) => b.textContent === label,
  )!;

it('選択を変えると背景が新しいボタンの位置と幅へ transform と width で移る', async () => {
  const { container, findByText } = render(<Harness initial="a" />);
  await findByText('アー');
  await vi.waitFor(() =>
    expect(bg(container).style.transform).toBe('translateX(8px)'),
  );
  fireEvent.click(btn(container, 'シー'));
  expect(bg(container).style.transform).toBe('translateX(216px)');
  expect(bg(container).style.width).toBe('100px');
  expect(bg(container).className).toContain('bg-secondary');
  expect(bg(container).style.transitionProperty).toContain('transform');
  expect(bg(container).style.transitionDuration).toContain('200ms');
});

it('最初の選択は移動させず不透明度だけを変える', async () => {
  const { container } = render(<Harness initial={null} />);
  await act(async () => {});
  expect(bg(container).style.opacity).toBe('0');
  fireEvent.click(btn(container, 'ビー'));
  expect(bg(container).style.opacity).toBe('1');
  expect(bg(container).style.transform).toBe('translateX(112px)');
  expect(bg(container).style.transitionProperty).not.toContain('transform');
  expect(bg(container).style.transitionProperty).toContain('opacity');
});

it('同じボタンの再押下では背景は動かない', async () => {
  const { container } = render(<Harness initial="b" />);
  await vi.waitFor(() =>
    expect(bg(container).style.transform).toBe('translateX(112px)'),
  );
  fireEvent.click(btn(container, 'ビー'));
  expect(bg(container).style.transform).toBe('translateX(112px)');
});

it('高さは nav が 88、page が 56', async () => {
  const a = render(
    <TouchSegment size="nav" items={items} value="a" onSelect={() => {}} />,
  );
  expect(bg(a.container).style.height).toBe('88px');
  const b = render(<Harness initial="a" />);
  await act(async () => {});
  expect(bg(b.container).style.height).toBe('56px');
});

it('trailing は同じ楕円の中に並び、アイコンだけのボタンは選択対象にならない', async () => {
  const onZoom = vi.fn();
  const { container, getByRole } = render(
    <TouchSegment
      size="page"
      items={items}
      value={null}
      onSelect={() => {}}
      trailing={<TouchButton icon="add" aria-label="拡大" onClick={onZoom} />}
    />,
  );
  await act(async () => {});
  fireEvent.click(getByRole('button', { name: '拡大' }));
  expect(onZoom).toHaveBeenCalled();
  expect(container.querySelectorAll('button')).toHaveLength(4);
  expect(bg(container).style.opacity).toBe('0');
});
