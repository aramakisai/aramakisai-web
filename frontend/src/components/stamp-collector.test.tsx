import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StampCollector } from './stamp-collector';
import * as storage from '@/lib/mypage-storage';
import * as analytics from '@/lib/analytics';

vi.mock('@/lib/analytics', () => ({ sendGaEvent: vi.fn() }));

const SIG = 'a'.repeat(43);
const ID = '11111111-1111-4111-8111-111111111111';
const PARAMS = { exhibition_id: 3, exhibition_category: 'exhibit' };

function mockVerify(result: unknown) {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ result }),
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function stored() {
  return JSON.parse(window.localStorage.getItem('aramakisai_mypage') ?? 'null');
}

describe('StampCollector', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/exhibitions/3/exhibit');
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it('フラグメントが無ければ検証APIを呼ばず何も描画しない', () => {
    const fetchMock = mockVerify('added');
    const { container } = render(
      <StampCollector exhibitionId={3} category="exhibit" />,
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
    expect(analytics.sendGaEvent).not.toHaveBeenCalled();
  });

  it('s 以外のフラグメントでは検証APIを呼ばない', () => {
    window.location.hash = '#x=1';
    const fetchMock = mockVerify('added');
    render(<StampCollector exhibitionId={3} category="exhibit" />);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('匿名IDが無ければ作って送り、取得が返ってから保存してトーストを出す', async () => {
    window.location.hash = `#s=${SIG}`;
    vi.spyOn(crypto, 'randomUUID').mockReturnValue(ID);
    const fetchMock = mockVerify('added');
    render(<StampCollector exhibitionId={3} category="exhibit" />);

    expect(window.location.hash).toBe('');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      id: 3,
      category: 'exhibit',
      signature: SIG,
      visitorId: ID,
    });
    expect(stored()).toBeNull();
    expect(await screen.findByRole('status')).toHaveTextContent(
      'スタンプを取得しました',
    );
    expect(screen.getByRole('link', { name: 'マイページ' })).toHaveAttribute(
      'href',
      '/mypage',
    );
    expect(stored().visitorId).toBe(ID);
    expect(analytics.sendGaEvent).toHaveBeenCalledWith('qr_stamp', {
      ...PARAMS,
      result: 'added',
    });
    expect(
      JSON.stringify(vi.mocked(analytics.sendGaEvent).mock.calls),
    ).not.toContain(ID);
  });

  it('保存済みの匿名IDを送り、既存なら取得済みのトーストを出す', async () => {
    storage.saveVisitorId(ID);
    window.location.hash = `#s=${SIG}`;
    const fetchMock = mockVerify('exists');
    render(<StampCollector exhibitionId={3} category="exhibit" />);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).visitorId).toBe(ID);
    expect(await screen.findByRole('status')).toHaveTextContent(
      '取得済みのスタンプです',
    );
    expect(analytics.sendGaEvent).toHaveBeenCalledWith('qr_stamp', {
      ...PARAMS,
      result: 'exists',
    });
  });

  it('未取得では何も表示せず匿名IDも保存しないが、フラグメントは消す', async () => {
    window.location.hash = `#s=${SIG}`;
    const fetchMock = mockVerify('invalid');
    render(<StampCollector exhibitionId={3} category="exhibit" />);
    await waitFor(() =>
      expect(analytics.sendGaEvent).toHaveBeenCalledWith('qr_stamp', {
        ...PARAMS,
        result: 'invalid',
      }),
    );
    expect(fetchMock).toHaveBeenCalled();
    expect(window.location.hash).toBe('');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(stored()).toBeNull();
  });

  it('result が無い応答 (旧形式) は未取得として扱う', async () => {
    window.location.hash = `#s=${SIG}`;
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue({ ok: true, json: async () => ({ valid: true }) }),
    );
    render(<StampCollector exhibitionId={3} category="exhibit" />);
    await waitFor(() =>
      expect(analytics.sendGaEvent).toHaveBeenCalledWith('qr_stamp', {
        ...PARAMS,
        result: 'invalid',
      }),
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('failed では失敗のトーストを出し、匿名IDを保存しない', async () => {
    window.location.hash = `#s=${SIG}`;
    mockVerify('failed');
    render(<StampCollector exhibitionId={3} category="exhibit" />);
    const status = await screen.findByRole('status');
    expect(status.textContent).toContain(
      'スタンプを記録できませんでした。\nもう一度読み取ってください',
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(stored()).toBeNull();
    expect(analytics.sendGaEvent).toHaveBeenCalledWith('qr_stamp', {
      ...PARAMS,
      result: 'failed',
    });
  });

  it('通信失敗と失敗応答(!ok)は失敗のトーストと network_error', async () => {
    window.location.hash = `#s=${SIG}`;
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('net')));
    const { unmount } = render(
      <StampCollector exhibitionId={3} category="exhibit" />,
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'スタンプを記録できませんでした。',
    );
    expect(analytics.sendGaEvent).toHaveBeenCalledWith('qr_stamp', {
      ...PARAMS,
      result: 'network_error',
    });
    unmount();

    window.location.hash = `#s=${SIG}`;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    render(<StampCollector exhibitionId={3} category="exhibit" />);
    expect(await screen.findByRole('status')).toHaveTextContent(
      'スタンプを記録できませんでした。',
    );
  });

  it('保存領域が使えなければ送らず、保存不可のトーストを出す', async () => {
    window.location.hash = `#s=${SIG}`;
    const fetchMock = mockVerify('added');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    render(<StampCollector exhibitionId={3} category="exhibit" />);
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent('この端末ではスタンプを集められません');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
    expect(analytics.sendGaEvent).toHaveBeenCalledWith('qr_stamp', {
      ...PARAMS,
      result: 'unavailable',
    });
  });
});
