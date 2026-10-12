import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StampCollector } from './stamp-collector';
import * as storage from '@/lib/mypage-storage';
import * as analytics from '@/lib/analytics';

vi.mock('@/lib/analytics', () => ({ sendGaEvent: vi.fn() }));
vi.mock('@/lib/mypage-storage', async (orig) => {
  const actual = await orig<typeof import('@/lib/mypage-storage')>();
  return { ...actual, addStamp: vi.fn(actual.addStamp) };
});

const SIG = 'a'.repeat(43);

function mockVerify(valid: boolean) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ valid }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('StampCollector', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/exhibitions/3/exhibit');
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('フラグメントが無ければ検証APIを呼ばず何も描画しない', () => {
    const fetchMock = mockVerify(true);
    const { container } = render(
      <StampCollector exhibitionId={3} category="exhibit" />,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('s 以外のフラグメントでは検証APIを呼ばない', () => {
    window.location.hash = '#x=1';
    const fetchMock = mockVerify(true);
    render(<StampCollector exhibitionId={3} category="exhibit" />);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('フラグメントを消してから検証APIへ送り、一致で記録しトーストを出す', async () => {
    window.location.hash = `#s=${SIG}`;
    const fetchMock = mockVerify(true);
    const ga = vi.mocked(analytics.sendGaEvent);
    const add = vi.mocked(storage.addStamp);
    render(<StampCollector exhibitionId={3} category="exhibit" />);

    expect(window.location.hash).toBe('');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      id: 3,
      category: 'exhibit',
      signature: SIG,
    });
    expect(await screen.findByRole('status')).toHaveTextContent(
      'スタンプを取得しました',
    );
    expect(screen.getByRole('link', { name: 'マイページ' })).toHaveAttribute(
      'href',
      '/mypage',
    );
    expect(ga).toHaveBeenCalledWith('qr_stamp', {
      exhibition_id: 3,
      exhibition_category: 'exhibit',
    });
    expect(ga.mock.invocationCallOrder[0]).toBeLessThan(
      add.mock.invocationCallOrder[0],
    );
  });

  it('取得済みなら取得済みのトーストを出す', async () => {
    storage.addStamp(3, 'exhibit');
    window.location.hash = `#s=${SIG}`;
    mockVerify(true);
    vi.mocked(analytics.sendGaEvent);
    render(<StampCollector exhibitionId={3} category="exhibit" />);
    expect(await screen.findByRole('status')).toHaveTextContent(
      '取得済みのスタンプです',
    );
  });

  it('不一致では記録せず何も表示しないが、フラグメントは消す', async () => {
    window.location.hash = `#s=${SIG}`;
    const fetchMock = mockVerify(false);
    const add = vi.mocked(storage.addStamp);
    render(<StampCollector exhibitionId={3} category="exhibit" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await Promise.resolve();
    expect(window.location.hash).toBe('');
    expect(add).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('通信失敗では何も表示しない', async () => {
    window.location.hash = `#s=${SIG}`;
    const fetchMock = vi.fn().mockRejectedValue(new Error('net'));
    vi.stubGlobal('fetch', fetchMock);
    render(<StampCollector exhibitionId={3} category="exhibit" />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await Promise.resolve();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('保存不可では何も表示しない', async () => {
    window.location.hash = `#s=${SIG}`;
    mockVerify(true);
    vi.mocked(analytics.sendGaEvent);
    vi.mocked(storage.addStamp).mockReturnValueOnce('unavailable');
    render(<StampCollector exhibitionId={3} category="exhibit" />);
    await waitFor(() => expect(storage.addStamp).toHaveBeenCalled());
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
