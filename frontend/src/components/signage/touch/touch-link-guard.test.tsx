// @vitest-environment jsdom
/* eslint-disable @next/next/no-html-link-for-pages -- 生の a 要素のクリックを検証する */
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { isPublicPath } from '@/lib/phase';
import NotFound from '@/app/(fullscreen)/signage/touch/not-found';
import { TouchLinkGuard } from './touch-link-guard';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeEach(() => push.mockReset());

function setup() {
  render(
    <>
      <TouchLinkGuard />
      <a href="/exhibitions/3/stage">公開</a>
      <a href="/signage/touch/topics">端末</a>
      <a href="https://example.com" target="_blank">
        外部
      </a>
      <a href="mailto:a@b.c">メール</a>
      <a href="/faq">対象外</a>
      <a href="#top">アンカー</a>
    </>,
  );
}

it('公開パスのクリックは端末用パスへ移る', () => {
  setup();
  const ev = fireEvent.click(screen.getByText('公開'));
  expect(ev).toBe(false);
  expect(push).toHaveBeenCalledWith('/signage/touch/exhibitions/3/stage');
});

it('端末用パスはそのまま push する', () => {
  setup();
  fireEvent.click(screen.getByText('端末'));
  expect(push).toHaveBeenCalledWith('/signage/touch/topics');
});

it.each(['外部', 'メール', '対象外'])('%s は止まる', (text) => {
  setup();
  expect(fireEvent.click(screen.getByText(text))).toBe(false);
  expect(push).not.toHaveBeenCalled();
});

it('ページ内アンカーは通す', () => {
  setup();
  expect(fireEvent.click(screen.getByText('アンカー'))).toBe(true);
  expect(push).not.toHaveBeenCalled();
});

it('止めるリンクには data-touch-blocked が付き、読み替えるリンクには付かない', () => {
  setup();
  expect(screen.getByText('外部').hasAttribute('data-touch-blocked')).toBe(
    true,
  );
  expect(screen.getByText('対象外').hasAttribute('data-touch-blocked')).toBe(
    true,
  );
  expect(screen.getByText('公開').hasAttribute('data-touch-blocked')).toBe(
    false,
  );
});

it('後から描画されたリンクにも data-touch-blocked が付く', async () => {
  setup();
  const a = document.createElement('a');
  a.href = 'https://late.example';
  document.body.appendChild(a);
  await vi.waitFor(() =>
    expect(a.hasAttribute('data-touch-blocked')).toBe(true),
  );
});

it('端末用の見つかりませんにリンクが無い', () => {
  const { container } = render(<NotFound />);
  expect(container.querySelector('a')).toBeNull();
  expect(container.textContent).toContain('見つかりません');
});

it('/signage/touch/* は開催前に非公開、live で公開', () => {
  expect(isPublicPath('/signage/touch/map', 'pre_event')).toBe(false);
  expect(isPublicPath('/signage/touch/map', 'live')).toBe(true);
});
