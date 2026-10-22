import { fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMotionPreference } from '@/lib/use-motion-preference';
import { MotionToggle } from './motion-toggle';
import { MapErrorBoundary } from './exhibition-location-map/map-error-boundary';
import { RichTextImageViewer } from './rich-text-image-viewer';

const { sendGaEvent } = vi.hoisted(() => ({ sendGaEvent: vi.fn() }));
vi.mock('@/lib/analytics', () => ({ sendGaEvent }));
vi.mock('@/lib/use-motion-preference', () => ({
  useMotionPreference: vi.fn(),
  prefersReducedMotion: () =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
}));
vi.mock('@/lib/cms-asset-url', () => ({
  toAssetUrl: (id: string | null) => (id ? `https://example.com/${id}` : null),
}));

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
});
let osReduce = false;
beforeEach(() => {
  sendGaEvent.mockReset();
  osReduce = false;
  window.matchMedia = ((q: string) =>
    ({
      matches: osReduce,
      media: q,
    }) as MediaQueryList) as typeof window.matchMedia;
});

describe('MotionToggle の計測', () => {
  it.each([
    [false, 'reduce'],
    [true, 'full'],
  ])('reduced=%s の操作で motion/%s を送る', (reduced, result) => {
    vi.mocked(useMotionPreference).mockReturnValue({
      reduced,
      toggle: vi.fn(),
    });
    render(<MotionToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'モーション' }));
    expect(sendGaEvent).toHaveBeenCalledWith('motion', { result });
  });
});

describe('MotionToggle の計測 (OS が reduce)', () => {
  it('reduced=true でも OS が reduce なら reduce を送る', () => {
    osReduce = true;
    vi.mocked(useMotionPreference).mockReturnValue({
      reduced: true,
      toggle: vi.fn(),
    });
    render(<MotionToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'モーション' }));
    expect(sendGaEvent).toHaveBeenCalledWith('motion', { result: 'reduce' });
  });
});

describe('MapErrorBoundary の計測', () => {
  it('失敗を捕らえたとき location_map/fallback を1回送る', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const Boom = (): never => {
      throw new Error('x');
    };
    render(
      <MapErrorBoundary fallback={<p>f</p>}>
        <Boom />
      </MapErrorBoundary>,
    );
    expect(sendGaEvent).toHaveBeenCalledTimes(1);
    expect(sendGaEvent).toHaveBeenCalledWith('location_map', {
      result: 'fallback',
    });
  });
});

describe('RichTextImageViewer の計測', () => {
  it('拡大表示を開いたとき image_viewer/open を送る', () => {
    render(
      <RichTextImageViewer>
        <div
          dangerouslySetInnerHTML={{
            __html: '<img src="a" alt="説明" data-media-id="42">',
          }}
        />
      </RichTextImageViewer>,
    );
    expect(sendGaEvent).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '画像を拡大: 説明' }));
    expect(sendGaEvent).toHaveBeenCalledWith('image_viewer', {
      result: 'open',
    });
  });
});
