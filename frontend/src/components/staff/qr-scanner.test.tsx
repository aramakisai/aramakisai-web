import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const detect = vi.fn();
const detectorInit = vi.fn();
vi.mock('barcode-detector/ponyfill', () => ({
  prepareZXingModule: vi.fn(),
  BarcodeDetector: class {
    constructor(o: unknown) {
      detectorInit(o);
    }
    detect = detect;
  },
}));

import { QrScanner } from './qr-scanner';

const ID = '3f2a9c1e-1111-4111-8111-111111111111';
const stop = vi.fn();

function stubCamera(getUserMedia: () => Promise<unknown>) {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia },
  });
}

beforeEach(() => {
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  stubCamera(async () => ({ getTracks: () => [{ stop }] }));
  detect.mockResolvedValue([]);
});
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

const scanTick = () => act(() => vi.advanceTimersByTimeAsync(300));

describe('QrScanner', () => {
  it('背面カメラを要求し、案内を出す', async () => {
    const gum = vi.fn().mockResolvedValue({ getTracks: () => [{ stop }] });
    stubCamera(gum);
    render(<QrScanner />);
    await waitFor(() => expect(gum).toHaveBeenCalled());
    expect(gum.mock.calls[0][0]).toEqual({
      video: { facingMode: 'environment' },
    });
    expect(detectorInit).toHaveBeenCalledWith({ formats: ['qr_code'] });
    expect(screen.getByText('交換用QRを枠に合わせてください')).toBeTruthy();
  });

  it('交換用 QR を読み取ると照会画面へ移る', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    detect.mockResolvedValue([
      { rawValue: `${location.origin}/staff/visitors/${ID}?t=abc` },
    ]);
    render(<QrScanner />);
    await scanTick();
    expect(push).toHaveBeenCalledWith(`/staff/visitors/${ID}?t=abc`);
  });

  it('それ以外の QR は案内を出して読み取りを続ける', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    detect.mockResolvedValue([{ rawValue: 'https://example.com/' }]);
    render(<QrScanner />);
    await scanTick();
    expect(screen.getByText('交換用QRではありません')).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    const calls = detect.mock.calls.length;
    await scanTick();
    expect(detect.mock.calls.length).toBeGreaterThan(calls);
  });

  it('カメラが許可されなければ標準カメラでの読み取りを案内する', async () => {
    stubCamera(() =>
      Promise.reject(new DOMException('denied', 'NotAllowedError')),
    );
    render(<QrScanner />);
    expect(
      await screen.findByText(
        'カメラを使用できません。スマートフォンのカメラで交換用QRを読み取ってください',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('交換用QRを枠に合わせてください')).toBeNull();
  });

  it('mediaDevices が無い端末でも案内する', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: undefined,
    });
    render(<QrScanner />);
    expect(await screen.findByText(/カメラを使用できません/)).toBeTruthy();
  });

  it('アンマウントでカメラを止める', async () => {
    const { unmount } = render(<QrScanner />);
    await waitFor(() =>
      expect(HTMLMediaElement.prototype.play).toHaveBeenCalled(),
    );
    unmount();
    expect(stop).toHaveBeenCalled();
  });
});
