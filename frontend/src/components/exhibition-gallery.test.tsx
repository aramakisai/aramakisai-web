import { render, screen, fireEvent } from '@testing-library/react';
import { act } from 'react';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  it,
  expect,
  vi,
} from 'vitest';
import { ExhibitionGallery } from './exhibition-gallery';
import type { ExhibitionImage } from '@/lib/exhibitions';

vi.mock('@/lib/analytics', () => ({ sendGaEvent: vi.fn() }));

vi.mock('@/lib/cms-asset-url', () => {
  const toAssetUrl = (id: string | null, width?: number) =>
    id ? `https://example.com/assets/${id}${width ? `/${width}` : ''}` : null;
  return {
    toAssetUrl,
    toCardImageUrl: (image: { id: string }) => toAssetUrl(image.id, 960),
    toHeroImage: (image: { id: string }) => {
      const src = toAssetUrl(image.id, 1920);
      return src ? { src } : null;
    },
  };
});

// jsdom は <dialog> の showModal/close を実装しない
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    if (!this.open) return;
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

const motion = vi.hoisted(() => ({ reduced: false }));
vi.mock('@/lib/use-motion-preference', () => ({
  useMotionPreference: () => ({ reduced: motion.reduced, toggle: vi.fn() }),
}));

describe('ExhibitionGallery', () => {
  const images: readonly ExhibitionImage[] = [
    { id: '1', alt: '写真1' },
    { id: '2', alt: '写真2' },
    { id: '3', alt: '写真3' },
  ];

  it('shows the first image as main and switches it when a thumbnail is selected', () => {
    render(<ExhibitionGallery images={images} fallbackAlt="企画名" />);

    expect(screen.getByRole('img', { name: '写真1' })).toBeInTheDocument();

    const thumbnails = screen.getAllByRole('button', { name: /写真/ });
    expect(thumbnails).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: '写真3' }));

    expect(screen.getByRole('img', { name: '写真3' })).toBeInTheDocument();
    // 旧画像はフェード完了まで残る
    expect(screen.getByRole('img', { name: '写真1' })).toBeInTheDocument();
  });

  it('shows a no-image placeholder and no thumbnail row when there are no images', () => {
    render(<ExhibitionGallery images={[]} fallbackAlt="企画名" />);

    expect(screen.getByTestId('icon-hide-image')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  describe('auto advance', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    });
    afterEach(() => {
      vi.useRealTimers();
      motion.reduced = false;
    });
    const tick = (ms: number) => act(() => vi.advanceTimersByTime(ms));
    const main = () =>
      screen
        .getAllByRole('img')
        .filter((el) => el.className.includes('object-contain'))
        .at(-1);

    it('5秒ごとに次へ進み、末尾から先頭に戻る', () => {
      render(<ExhibitionGallery images={images} fallbackAlt="企画名" />);
      tick(5000);
      expect(main()).toHaveAttribute('alt', '写真2');
      tick(5000);
      tick(5000);
      expect(main()).toHaveAttribute('alt', '写真1');
    });

    it('手動選択でタイマーが仕切り直される', () => {
      render(<ExhibitionGallery images={images} fallbackAlt="企画名" />);
      tick(4000);
      fireEvent.click(screen.getByRole('button', { name: '写真2' }));
      tick(4000);
      expect(main()).toHaveAttribute('alt', '写真2');
      tick(1000);
      expect(main()).toHaveAttribute('alt', '写真3');
    });

    it('hover 中は止まり、離れると再開する', () => {
      const { container } = render(
        <ExhibitionGallery images={images} fallbackAlt="企画名" />,
      );
      fireEvent.mouseEnter(container.firstElementChild!);
      tick(20000);
      expect(main()).toHaveAttribute('alt', '写真1');
      fireEvent.mouseLeave(container.firstElementChild!);
      tick(5000);
      expect(main()).toHaveAttribute('alt', '写真2');
    });

    it('モーション停止中は自動で切り替えない', () => {
      motion.reduced = true;
      render(<ExhibitionGallery images={images} fallbackAlt="企画名" />);
      tick(20000);
      expect(main()).toHaveAttribute('alt', '写真1');
    });

    it('表示後に停止へ切り替えたら以後は切り替わらない', () => {
      const { rerender } = render(
        <ExhibitionGallery images={images} fallbackAlt="企画名" />,
      );
      tick(5000);
      expect(main()).toHaveAttribute('alt', '写真2');
      motion.reduced = true;
      rerender(<ExhibitionGallery images={images} fallbackAlt="企画名" />);
      tick(20000);
      expect(main()).toHaveAttribute('alt', '写真2');
    });

    it('画像1枚では切り替えない', () => {
      render(
        <ExhibitionGallery images={images.slice(0, 1)} fallbackAlt="企画名" />,
      );
      tick(20000);
      expect(main()).toHaveAttribute('alt', '写真1');
    });
  });

  describe('enlargeable', () => {
    it('メイン写真のクリックで original URL と alt のモーダルが開く', () => {
      const { container } = render(
        <ExhibitionGallery images={images} fallbackAlt="企画名" enlargeable />,
      );
      fireEvent.click(
        screen.getByRole('button', { name: '画像を拡大: 写真1' }),
      );

      const dialog = container.querySelector('dialog')!;
      expect(dialog).toHaveAttribute('open');
      const img = dialog.querySelector('img')!;
      expect(img).toHaveAttribute('src', 'https://example.com/assets/1');
      expect(img).toHaveAttribute('alt', '写真1');
    });

    it('無効時はメイン写真が button にならない', () => {
      const { container } = render(
        <ExhibitionGallery images={images} fallbackAlt="企画名" />,
      );
      expect(
        screen.queryByRole('button', { name: /画像を拡大/ }),
      ).not.toBeInTheDocument();
      expect(container.querySelector('dialog')).toBeNull();
    });

    it('開いている間は自動送りが止まり、閉じると再開する', () => {
      vi.useFakeTimers();
      window.matchMedia = vi.fn().mockReturnValue({ matches: false });
      try {
        const { container } = render(
          <ExhibitionGallery
            images={images}
            fallbackAlt="企画名"
            enlargeable
          />,
        );
        const main = () =>
          screen
            .getAllByRole('img')
            .filter((el) => el.className.includes('object-contain'))
            .at(-1);
        fireEvent.click(
          screen.getByRole('button', { name: '画像を拡大: 写真1' }),
        );
        act(() => vi.advanceTimersByTime(20000));
        expect(main()).toHaveAttribute('alt', '写真1');
        act(() => container.querySelector('dialog')!.close());
        // 閉じるとフォーカスが戻り、既存のフォーカス中一時停止が効くため外す
        act(() =>
          document.activeElement?.dispatchEvent(
            new FocusEvent('focusout', { bubbles: true }),
          ),
        );
        act(() => vi.advanceTimersByTime(5000));
        expect(main()).toHaveAttribute('alt', '写真2');
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
