// @vitest-environment jsdom
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/cms', () => ({ cms: {} }));
vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_CMS_URL: 'http://localhost:3100',
    NEXT_PUBLIC_SITE_URL: 'https://example.test',
  },
}));

vi.mock('qrcode', () => ({
  default: {
    toString: vi.fn(async (url: string) => `<svg data-url="${url}"/>`),
  },
}));

import { MAP_READY_TIMEOUT_MS } from '@/lib/signage-touch';
import type { TouchSession } from './use-touch-session';
import { SignageTouchLayer } from './signage-touch-layer';

afterEach(() => vi.restoreAllMocks());

function session(state: TouchSession['state']): TouchSession {
  return {
    state,
    tap: vi.fn(),
    select: vi.fn(),
    back: vi.fn(),
    fadeEnd: vi.fn(),
    activity: vi.fn(),
    attachIframe: vi.fn(),
  };
}

const open = (destination: 'map' | 'topics' | 'parking' | null = null) =>
  ({ kind: 'open', destination, idleSince: 0 }) as const;

function renderLayer(s: TouchSession) {
  const props = {
    now: new Date('2026-11-01T05:17:00Z'),
    eventDays: [],
    rows: [],
    boards: [],
    telops: [],
    offsetMs: 0,
  };
  const r = render(<SignageTouchLayer session={s} {...props} />);
  return {
    ...r,
    again: (next: TouchSession) =>
      r.rerender(<SignageTouchLayer session={next} {...props} />),
  };
}

const navButton = (c: HTMLElement, label: string) =>
  Array.from(c.querySelectorAll('button')).find((b) =>
    b.textContent?.includes(label),
  ) as HTMLButtonElement;

const curtainEl = (c: HTMLElement) =>
  c.querySelector('[data-testid="touch-loading-spinner"]')!
    .parentElement as HTMLElement;

it('閉じているときは何も描画しない', () => {
  const { container } = renderLayer(session({ kind: 'closed' }));
  expect(container).toBeEmptyDOMElement();
});

it('トップでは iframe を描画せず、5つの行き先ボタンだけを出し、ナビも戻るも出さない', () => {
  const { container } = renderLayer(session(open()));
  expect(container.querySelector('iframe')).toBeNull();
  const texts = Array.from(container.querySelectorAll('button')).map(
    (b) => b.textContent ?? '',
  );
  expect(texts).toHaveLength(5);
  [
    '企画一覧',
    '構内マップ',
    'タイムテーブル',
    '駐車場空き情報',
    'トピック',
  ].forEach((l, i) => expect(texts[i]).toContain(l));
  expect(container.textContent).not.toContain('サイネージに戻る');
});

it('トップのボタンを押すと幕が fade-in し、終了するまで select を呼ばない', () => {
  const s = session(open());
  const r = renderLayer(s);
  fireEvent.click(navButton(r.container, '駐車場空き情報'));
  expect(r.getByText('読み込み中')).toBeTruthy();
  expect(curtainEl(r.container).className).toContain('fade-in');
  expect(s.select).not.toHaveBeenCalled();
  fireEvent.animationEnd(curtainEl(r.container));
  expect(s.select).toHaveBeenCalledWith('parking');
});

it('ナビのトップで select(null) を呼び、iframe を外して読み込み中と QR をトップに戻す', async () => {
  const s = session(open('map'));
  const r = renderLayer(s);
  const iframe = r.container.querySelector('iframe')!;
  post(iframe, { type: 'signage-touch-path', path: '/signage/touch/map' });
  fireEvent.click(navButton(r.container, 'トップ'));
  expect(s.select).toHaveBeenCalledWith(null);
  r.again(session(open()));
  fireEvent.animationEnd(navButton(r.container, '企画一覧').parentElement!);
  expect(r.container.querySelector('iframe')).toBeNull();
  expect(r.queryByText('読み込み中')).toBeNull();
  await waitFor(() => expect(decoded(r.container)).not.toContain('/map'));
  expect(navButton(r.container, '企画一覧')).toBeTruthy();
});

it('トップへ戻るときは旧 iframe を残してボタン列を fade-in で重ね、完了で iframe を外す', () => {
  const r = renderLayer(session(open('map')));
  fireEvent.click(navButton(r.container, 'トップ'));
  r.again(session(open()));
  const buttons = navButton(r.container, '企画一覧').parentElement!;
  expect(r.container.querySelector('iframe')).not.toBeNull();
  expect(buttons.className).toContain('fade-in');
  fireEvent.animationEnd(buttons);
  expect(r.container.querySelector('iframe')).toBeNull();
  expect(buttons.className).not.toContain('fade-in');
});

it('トップへ戻るフェード中に別の行き先を押すと iframe を使い回す', () => {
  const r = renderLayer(session(open('map')));
  const iframe = r.container.querySelector('iframe')!;
  fireEvent.click(navButton(r.container, 'トップ'));
  r.again(session(open()));
  const replace = vi.fn();
  Object.defineProperty(iframe, 'contentWindow', {
    configurable: true,
    value: { location: { replace } },
  });
  fireEvent.click(navButton(r.container, 'トピック'));
  fireEvent.animationEnd(curtainEl(r.container));
  expect(replace).toHaveBeenCalledWith('/signage/touch/topics');
  r.again(session(open('topics')));
  expect(r.container.querySelector('iframe')).toBe(iframe);
});

it('幕が不透明になってから遷移し、iframe の load で fade-out、終了で幕を外す', () => {
  const s = session(open());
  const r = renderLayer(s);
  fireEvent.click(navButton(r.container, '駐車場'));
  fireEvent.animationEnd(curtainEl(r.container));
  expect(s.select).toHaveBeenCalledWith('parking');
  r.again(session(open('parking')));
  const iframe = r.container.querySelector('iframe')!;
  expect(iframe.title).toBe('駐車場');
  expect(iframe.getAttribute('src')).toBe('/signage/touch/parking');
  expect(r.getByText('読み込み中')).toBeTruthy();
  // 回転軸が字形の中心に一致するよう、回す箱は 64px 正方形で行の余白を持たない
  const spinner = r.getByTestId('touch-loading-spinner');
  expect(spinner.className).toContain('size-16');
  expect(spinner.className).toContain('flex');
  expect(spinner.className).toContain('text-info');
  fireEvent.load(iframe);
  expect(curtainEl(r.container).className).toContain('fade-out');
  fireEvent.animationEnd(curtainEl(r.container));
  expect(r.queryByText('読み込み中')).toBeNull();
});

function openMapAndLoad() {
  const s = session(open());
  const r = renderLayer(s);
  fireEvent.click(navButton(r.container, '構内マップ'));
  fireEvent.animationEnd(curtainEl(r.container));
  r.again(session(open('map')));
  const iframe = r.container.querySelector('iframe')!;
  fireEvent.load(iframe);
  return { r, iframe };
}

it('構内マップでは load だけでは fade-out せず、描画完了の知らせで fade-out する', () => {
  const { r, iframe } = openMapAndLoad();
  expect(curtainEl(r.container).className).not.toContain('fade-out');
  post(iframe, { type: 'signage-touch-ready', path: '/signage/touch/other' });
  expect(curtainEl(r.container).className).not.toContain('fade-out');
  post(iframe, { type: 'signage-touch-ready', path: '/signage/touch/map' });
  expect(curtainEl(r.container).className).toContain('fade-out');
});

it('構内マップの描画完了が load より先に届いても load で fade-out する', () => {
  const s = session(open());
  const r = renderLayer(s);
  fireEvent.click(navButton(r.container, '構内マップ'));
  fireEvent.animationEnd(curtainEl(r.container));
  r.again(session(open('map')));
  const iframe = r.container.querySelector('iframe')!;
  post(iframe, { type: 'signage-touch-ready', path: '/signage/touch/map' });
  expect(curtainEl(r.container).className).not.toContain('fade-out');
  fireEvent.load(iframe);
  expect(curtainEl(r.container).className).toContain('fade-out');
});

it('構内マップの描画完了が来なくても上限時間で fade-out する', () => {
  vi.useFakeTimers();
  try {
    const { r } = openMapAndLoad();
    act(() => {
      vi.advanceTimersByTime(MAP_READY_TIMEOUT_MS - 1);
    });
    expect(curtainEl(r.container).className).not.toContain('fade-out');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(curtainEl(r.container).className).toContain('fade-out');
  } finally {
    vi.useRealTimers();
  }
});

it('iframe の load ごとに attachIframe を呼ぶ', () => {
  const s = session(open('map'));
  const { container } = renderLayer(s);
  fireEvent.load(container.querySelector('iframe')!);
  expect(s.attachIframe).toHaveBeenCalledWith(
    container.querySelector('iframe'),
  );
});

it('トップでトピックを押すと topics を選ぶ', () => {
  const s = session(open());
  const { container } = renderLayer(s);
  fireEvent.click(navButton(container, 'トピック'));
  fireEvent.animationEnd(curtainEl(container));
  expect(s.select).toHaveBeenCalledWith('topics');
});

it('別の行き先を押すと幕の fade-in 後に location.replace で切り替える。連打は最後の行き先だけ有効', () => {
  const s = session(open('map'));
  const r = renderLayer(s);
  const iframe = r.container.querySelector('iframe')!;
  fireEvent.load(iframe);
  const replace = vi.fn();
  Object.defineProperty(iframe, 'contentWindow', {
    configurable: true,
    value: { location: { replace } },
  });
  fireEvent.click(navButton(r.container, '企画一覧'));
  expect(replace).not.toHaveBeenCalled();
  expect(r.getByText('読み込み中')).toBeTruthy();
  // 幕が不透明になる前の押下は、最後の行き先に置き換わる
  fireEvent.click(navButton(r.container, 'トピック'));
  fireEvent.animationEnd(curtainEl(r.container));
  expect(replace).toHaveBeenCalledTimes(1);
  expect(replace).toHaveBeenCalledWith('/signage/touch/topics');
  // 幕が不透明になった後の押下は、すぐ遷移する
  fireEvent.click(navButton(r.container, 'タイムテーブル'));
  expect(replace).toHaveBeenLastCalledWith('/signage/touch/timetable');
  expect(r.getByText('読み込み中')).toBeTruthy();
});

it('押した直後(幕の fade-in 終了前)にナビの選択が新しい行き先へ移る', () => {
  const r = renderLayer(session(open('map')));
  const pressed = (label: string) =>
    navButton(r.container, label).getAttribute('aria-pressed');
  expect(pressed('構内マップ')).toBe('true');
  fireEvent.click(navButton(r.container, '企画一覧'));
  expect(pressed('企画一覧')).toBe('true');
  expect(pressed('構内マップ')).toBe('false');
  fireEvent.click(navButton(r.container, 'トピック'));
  expect(pressed('トピック')).toBe('true');
});

it('閉じるフェードでは fade-out で消し、完了で fadeEnd を呼ぶ。読み込み中は出さない', () => {
  const s = session({ kind: 'closing' });
  const r = renderLayer(session(open('map')));
  r.again(s);
  const { container } = r;
  expect(container.querySelector('iframe')).not.toBeNull();
  const root = container.firstElementChild as HTMLElement;
  expect(root.className).toContain('fade-out');
  fireEvent.animationEnd(root);
  expect(s.fadeEnd).toHaveBeenCalled();
});

it('閉じた後に開き直すと読み込み中が残らない', () => {
  const s = session(open());
  const r = renderLayer(s);
  fireEvent.click(navButton(r.container, '構内マップ'));
  r.again(session(open('map')));
  expect(r.getByText('読み込み中')).toBeTruthy();
  r.again(session({ kind: 'closed' }));
  r.again(session(open()));
  expect(r.queryByText('読み込み中')).toBeNull();
  expect(r.container.querySelector('iframe')).toBeNull();
});

it('開いた直後は操作層に fade-in が付き、終了で外れる。閉じるときは fade-out になる', () => {
  const r = renderLayer(session(open()));
  const root = r.container.firstElementChild as HTMLElement;
  expect(root.className).toContain('fade-in');
  fireEvent.animationEnd(root);
  expect(root.className).not.toContain('fade-in');
  r.again(session({ kind: 'closing' }));
  expect(root.className).toContain('fade-out');
});

it('開く途中に閉じ始めても fade-out になり、fade-in は残らない', () => {
  const s = session({ kind: 'closing' });
  const r = renderLayer(session(open()));
  r.again(s);
  const root = r.container.firstElementChild as HTMLElement;
  expect(root.className).toContain('fade-out');
  expect(root.className).not.toContain('fade-in');
  fireEvent.animationEnd(root);
  expect(s.fadeEnd).toHaveBeenCalled();
});

it('操作層の押下で activity を呼ぶ', () => {
  const s = session(open());
  const { container } = renderLayer(s);
  act(() => {
    fireEvent.pointerDown(container.firstElementChild!);
  });
  expect(s.activity).toHaveBeenCalled();
});

const qrImg = (c: HTMLElement) =>
  c.querySelector<HTMLImageElement>('img[src^="data:image/svg+xml"]');
const decoded = (c: HTMLElement) =>
  decodeURIComponent(qrImg(c)!.getAttribute('src')!);

function post(
  iframe: HTMLIFrameElement,
  data: unknown,
  init: { origin?: string; source?: unknown } = {},
) {
  act(() => {
    window.dispatchEvent(
      new MessageEvent('message', {
        data,
        origin: init.origin ?? window.location.origin,
        source: (init.source ?? iframe.contentWindow) as MessageEventSource,
      }),
    );
  });
}

it('行き先未選択ではトップのURLのQRと見出し「この画面をスマホで見る」を出す', async () => {
  const { container, getByText } = renderLayer(session(open()));
  expect(getByText('▼この画面をスマホで見る')).toBeTruthy();
  await waitFor(() => expect(qrImg(container)).not.toBeNull());
  expect(decoded(container)).toContain(
    'https://example.test/?utm_source=signage&utm_medium=qr&utm_campaign=touch_navigation&utm_content=home',
  );
});

it('iframe から届いたパスと絞り込みで QR を作り直し、遷移で絞り込みを捨てる', async () => {
  const { container } = renderLayer(session(open('map')));
  const iframe = container.querySelector('iframe')!;
  post(iframe, { type: 'signage-touch-path', path: '/signage/touch/map' });
  post(iframe, {
    type: 'signage-touch-filters',
    path: '/signage/touch/map',
    filters: { q: '', categories: ['stage'], selectedAreaId: 4 },
  });
  await waitFor(() => expect(decoded(container)).toContain('area=4'));
  expect(decoded(container)).toContain('utm_content=map');
  post(iframe, {
    type: 'signage-touch-path',
    path: '/signage/touch/exhibitions/7/stage',
  });
  await waitFor(() =>
    expect(decoded(container)).toContain('/exhibitions/7/stage?'),
  );
  expect(decoded(container)).not.toContain('area=4');
});

it('別オリジン・別 window・形の違う知らせは無視する', async () => {
  const { container } = renderLayer(session(open('map')));
  const iframe = container.querySelector('iframe')!;
  const msg = { type: 'signage-touch-path', path: '/signage/touch/parking' };
  post(iframe, msg, { origin: 'https://evil.test' });
  post(iframe, msg, { source: window });
  post(iframe, { type: 'x', path: '/signage/touch/parking' });
  await waitFor(() => expect(qrImg(container)).not.toBeNull());
  expect(decoded(container)).not.toContain('/parking');
});
