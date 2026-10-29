import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ExchangeQrPanel } from './exchange-qr-panel';
import type { MypageStampTarget } from '@/lib/stamp-progress';
import type { StampRecord } from '@/lib/stamp-aggregate';

const VID = '11111111-1111-4111-8111-111111111111';
const TARGETS: MypageStampTarget[] = [
  { id: 10, category: 'exhibit', displayName: '展示A', areaId: 1 },
  { id: 11, category: 'vendor', displayName: 'クレープ', areaId: null },
];
const stamp = (exhibitionId: number, category: StampRecord['category']) => ({
  exhibitionId,
  category,
  acquiredAt: '2026-10-24T00:00:00.000Z',
});
const ALL = [stamp(10, 'exhibit'), stamp(11, 'vendor')];

let issued = 0;
function tokenResponse() {
  issued += 1;
  return {
    ok: true,
    status: 200,
    json: async () => ({
      url: `https://example.com/staff/visitors/${VID}?t=${issued}`,
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    }),
  };
}

function renderPanel(stamps: readonly StampRecord[] = ALL) {
  return render(
    <ExchangeQrPanel visitorId={VID} targets={TARGETS} stamps={stamps} />,
  );
}

describe('ExchangeQrPanel', () => {
  beforeEach(() => {
    issued = 0;
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('全対象が未取得なら節も見出しも描かず、署名も取らない', async () => {
    const fetchMock = vi.fn(async () => tokenResponse());
    vi.stubGlobal('fetch', fetchMock);
    const { container } = renderPanel([stamp(10, 'exhibit')]);
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('全対象を取得していれば署名を取ってQRを描く', async () => {
    const fetchMock = vi.fn(async () => tokenResponse());
    vi.stubGlobal('fetch', fetchMock);
    renderPanel();
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/stamps/exchange-token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ visitorId: VID }),
      }),
    );
    expect(
      screen.getByRole('heading', { level: 2, name: '景品交換' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('交換窓口でこのQRを見せてください'),
    ).toBeInTheDocument();
    const qr = screen.getByRole('img', { name: '交換用QR' });
    expect(qr.querySelector('svg')).not.toBeNull();
  });

  it('署名発行が403なら節を描かない', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) })),
    );
    const { container } = renderPanel();
    await act(async () => {});
    expect(container).toBeEmptyDOMElement();
  });

  it('発行に失敗したらQRを出さず状態行と再読み込みを出す', async () => {
    let fail = true;
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        fail
          ? { ok: false, status: 503, json: async () => ({}) }
          : tokenResponse(),
      ),
    );
    renderPanel();
    await act(async () => {});
    expect(
      screen.getByText('交換用QRを表示できませんでした'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: '交換用QR' })).toBeNull();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: '再読み込み' }));
    await act(async () => {});
    expect(screen.getByRole('img', { name: '交換用QR' })).toBeInTheDocument();
    expect(
      screen.queryByText('交換用QRを表示できませんでした'),
    ).not.toBeInTheDocument();
  });

  it('期限の60秒前に署名を取り直してQRを差し替える', async () => {
    const fetchMock = vi.fn(async () => tokenResponse());
    vi.stubGlobal('fetch', fetchMock);
    renderPanel();
    await act(async () => {});
    const first = screen.getByRole('img', { name: '交換用QR' }).innerHTML;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(239_000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_500);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('img', { name: '交換用QR' }).innerHTML).not.toBe(
      first,
    );
  });

  it('画面が再び表示されたとき、期限の60秒前を過ぎていれば取り直す', async () => {
    const fetchMock = vi.fn(async () => tokenResponse());
    vi.stubGlobal('fetch', fetchMock);
    renderPanel();
    await act(async () => {});
    // 非表示中はタイマーが止まる端末を模す: 時計だけ進めてタイマーを発火させない
    vi.setSystemTime(Date.now() + 250_000);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('画面が再び表示されても、まだ期限に余裕があれば取り直さない', async () => {
    const fetchMock = vi.fn(async () => tokenResponse());
    vi.stubGlobal('fetch', fetchMock);
    renderPanel();
    await act(async () => {});
    vi.setSystemTime(Date.now() + 100_000);
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
