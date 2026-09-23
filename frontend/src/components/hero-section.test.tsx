import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { HeroSection } from './hero-section';

const imageUrls = [
  'https://cms.example.com/assets/hero-0',
  'https://cms.example.com/assets/hero-1',
  'https://cms.example.com/assets/hero-2',
  'https://cms.example.com/assets/hero-3',
  'https://cms.example.com/assets/hero-4',
];

const fullProps = {
  imageUrls,
  eventDaysSummary: '11月14日 10:00〜17:30／11月15日 10:00〜16:30',
  venueName: '群馬大学 荒牧キャンパス',
  themeWord: '万彩',
  countdownDays: 54,
};

const useMotionPreferenceMock = vi.fn(() => ({
  reduced: false,
  toggle: vi.fn(),
}));
vi.mock('@/lib/use-motion-preference', () => ({
  useMotionPreference: () => useMotionPreferenceMock(),
}));

function expectCurrentSlide(index: number) {
  const slides = screen.getAllByTestId('hero-slide');

  slides.forEach((slide, slideIndex) => {
    expect(slide).toHaveAttribute(
      'aria-hidden',
      slideIndex === index ? 'false' : 'true',
    );
  });

  expect(
    screen.getByRole('button', {
      name: `${index + 1}枚目の画像を表示`,
    }),
  ).toHaveAttribute('aria-pressed', 'true');
}

describe('HeroSection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useMotionPreferenceMock.mockReturnValue({
      reduced: false,
      toggle: vi.fn(),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('renders the given hero images in order with slideshow controls', () => {
    const { container } = render(<HeroSection {...fullProps} />);

    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(5);
    expect(Array.from(images, (image) => image.getAttribute('src'))).toEqual(
      imageUrls,
    );
    images.forEach((image) => {
      expect(image).toHaveAttribute('alt', '');
      expect(image).toHaveClass('object-cover', 'object-center');
    });

    expect(
      screen.getByRole('region', { name: '荒牧祭の写真スライドショー' }),
    ).toHaveClass('h-[78svh]', 'min-h-[28rem]');
    expect(
      screen.getByRole('button', { name: '前の画像を表示' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '次の画像を表示' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /枚目の画像を表示/ }),
    ).toHaveLength(5);
    screen.getAllByRole('button').forEach((button) => {
      expect(button).toHaveAttribute('type', 'button');
    });
    expectCurrentSlide(0);
  });

  test('gives the first image loading priority', () => {
    const { container } = render(<HeroSection {...fullProps} />);

    const images = container.querySelectorAll('img');
    expect(images[0]).toHaveAttribute('fetchpriority', 'high');
    Array.from(images)
      .slice(1)
      .forEach((image) =>
        expect(image).toHaveAttribute('fetchpriority', 'auto'),
      );
  });

  test('renders nothing when there are no images', () => {
    const { container } = render(
      <HeroSection
        imageUrls={[]}
        eventDaysSummary={null}
        venueName={null}
        themeWord={null}
        countdownDays={null}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('hides previous/next navigation and the slide indicator when there is only one image', () => {
    render(<HeroSection {...fullProps} imageUrls={[imageUrls[0]]} />);

    expect(
      screen.queryByRole('button', { name: '前の画像を表示' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '次の画像を表示' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('group', { name: '表示する画像を選択' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId('hero-slide')).toHaveLength(1);
  });

  test('automatically advances every six seconds and loops to the first image', () => {
    render(<HeroSection {...fullProps} />);

    act(() => vi.advanceTimersByTime(6_000));
    expectCurrentSlide(1);

    act(() => vi.advanceTimersByTime(18_000));
    expectCurrentSlide(4);

    act(() => vi.advanceTimersByTime(6_000));
    expectCurrentSlide(0);
  });

  test('does not start the automatic timer while motion is reduced', () => {
    useMotionPreferenceMock.mockReturnValue({ reduced: true, toggle: vi.fn() });
    render(<HeroSection {...fullProps} />);

    expect(vi.getTimerCount()).toBe(0);
    act(() => vi.advanceTimersByTime(6_000));
    expectCurrentSlide(0);
  });

  test('loops in both directions with the previous and next buttons', () => {
    render(<HeroSection {...fullProps} />);

    fireEvent.click(screen.getByRole('button', { name: '前の画像を表示' }));
    expectCurrentSlide(4);

    fireEvent.click(screen.getByRole('button', { name: '次の画像を表示' }));
    expectCurrentSlide(0);
  });

  test('indicator navigation resets the automatic slideshow timer', () => {
    render(<HeroSection {...fullProps} />);

    act(() => vi.advanceTimersByTime(5_500));
    fireEvent.click(screen.getByRole('button', { name: '3枚目の画像を表示' }));
    expectCurrentSlide(2);

    act(() => vi.advanceTimersByTime(5_999));
    expectCurrentSlide(2);

    act(() => vi.advanceTimersByTime(1));
    expectCurrentSlide(3);
  });

  test('selecting the current indicator also resets the automatic timer', () => {
    render(<HeroSection {...fullProps} />);

    act(() => vi.advanceTimersByTime(5_500));
    fireEvent.click(screen.getByRole('button', { name: '1枚目の画像を表示' }));

    act(() => vi.advanceTimersByTime(5_999));
    expectCurrentSlide(0);

    act(() => vi.advanceTimersByTime(1));
    expectCurrentSlide(1);
  });

  test('clears the automatic timer when unmounted', () => {
    const { unmount } = render(<HeroSection {...fullProps} />);

    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('does not start an automatic timer with a single image', () => {
    render(<HeroSection {...fullProps} imageUrls={[imageUrls[0]]} />);
    expect(vi.getTimerCount()).toBe(0);
  });

  test('uses one-second crossfades and reduced-motion fallbacks, without a zoom animation', () => {
    const { container } = render(<HeroSection {...fullProps} />);

    const slides = screen.getAllByTestId('hero-slide');
    slides.forEach((slide) => {
      expect(slide).toHaveClass('duration-1000');
      expect(slide).toHaveClass('motion-reduce:transition-none');
    });

    // ズームのキーフレームを持たない (要件 1.12)
    expect(container.querySelector('style')).toBeNull();
    container.querySelectorAll('img').forEach((image) => {
      expect(image.className).not.toContain('zoom');
    });
  });

  test('does not render a scroll indicator', () => {
    render(<HeroSection {...fullProps} />);
    expect(screen.queryByText('SCROLL')).not.toBeInTheDocument();
  });

  test('darkens the bottom of the hero with a text-token gradient scrim', () => {
    const { container } = render(<HeroSection {...fullProps} />);
    const scrim = container.querySelector(
      '[aria-hidden="true"].absolute.inset-0.z-10',
    );
    expect(scrim).toHaveClass('from-text/50', 'to-transparent');
  });

  test('keeps mobile slideshow controls separated with touch-friendly targets', () => {
    render(<HeroSection {...fullProps} />);
    const controls = screen.getAllByRole('button');
    const previousButton = controls[0];
    const nextButton = controls[1];

    [previousButton, nextButton].forEach((button) => {
      expect(button).toHaveClass('h-11', 'w-11', 'lg:h-12', 'lg:w-12');
    });
    expect(previousButton).toHaveClass('left-4', 'lg:left-10');
    expect(nextButton).toHaveClass('right-4', 'lg:right-10');
  });

  test('sizes and colors the slide indicator dots per the Figma measurements (8px dots, 8px gap, primary/gray-400, no pill background)', () => {
    render(<HeroSection {...fullProps} />);

    const group = screen.getByRole('group', { name: '表示する画像を選択' });
    expect(group).toHaveClass('gap-2');
    expect(group).not.toHaveClass('bg-black/20', 'backdrop-blur-sm');

    const dots = within(group).getAllByRole('button');
    dots.forEach((dot) =>
      expect(dot).toHaveClass('h-2', 'w-2', 'rounded-full'),
    );
    expect(dots[0]).toHaveClass('bg-primary');
    dots.slice(1).forEach((dot) => expect(dot).toHaveClass('bg-gray-400'));
  });

  test('expands the slide indicator hit area via an invisible pseudo-element without growing the visible 8px dot', () => {
    render(<HeroSection {...fullProps} />);

    const group = screen.getByRole('group', { name: '表示する画像を選択' });
    const dots = within(group).getAllByRole('button');

    dots.forEach((dot) => {
      // 見た目のサイズ (8px) は変えない
      expect(dot).toHaveClass('h-2', 'w-2');
      // ::before は position: relative な自分自身を基準に配置する
      expect(dot).toHaveClass('relative');
      // 当たり判定の拡張は透明な ::before のみで表現し、可視の背景/枠線は追加しない
      expect(dot).toHaveClass('before:absolute', "before:content-['']");
      // 左右は間隔 8px の半分 (4px = Tailwind の 1) を超えない
      expect(dot).toHaveClass('before:-left-1', 'before:-right-1');
      // 上は SP 390 のカウントダウン行との間隔 (8px) を侵食しない 6px、下は制約が無いため 10px
      expect(dot).toHaveClass('before:-top-[6px]', 'before:-bottom-[10px]');
    });
  });

  describe('content overlay', () => {
    test('renders the fixed title, meta, theme and countdown for both breakpoints', () => {
      render(<HeroSection {...fullProps} />);

      const mobile = screen.getByTestId('hero-content-mobile');
      const desktop = screen.getByTestId('hero-content-desktop');

      for (const region of [mobile, desktop]) {
        expect(within(region).getByText('群馬大学')).toBeInTheDocument();
        expect(within(region).getByText('荒牧祭')).toBeInTheDocument();
        expect(
          within(region).getByText(
            '11月14日 10:00〜17:30／11月15日 10:00〜16:30',
          ),
        ).toBeInTheDocument();
        expect(
          within(region).getByText('群馬大学 荒牧キャンパス'),
        ).toBeInTheDocument();
        expect(within(region).getByText('万彩')).toBeInTheDocument();
        expect(
          within(region).getByText('開催まであと 54 日'),
        ).toBeInTheDocument();
      }
    });

    test('renders theme and countdown in the serif heading font, bold', () => {
      render(<HeroSection {...fullProps} />);

      const mobile = screen.getByTestId('hero-content-mobile');
      const desktop = screen.getByTestId('hero-content-desktop');

      for (const region of [mobile, desktop]) {
        expect(within(region).getByText('万彩')).toHaveClass(
          'font-mincho',
          'font-bold',
        );
        expect(within(region).getByText('開催まであと 54 日')).toHaveClass(
          'font-mincho',
          'font-bold',
        );
      }
    });

    test('joins event days and venue with a full-width bar on desktop only', () => {
      render(<HeroSection {...fullProps} />);
      const desktop = screen.getByTestId('hero-content-desktop');
      expect(within(desktop).getByText('｜')).toBeInTheDocument();
      expect(
        screen.queryByText('｜', {
          selector: '[data-testid="hero-content-mobile"] *',
        }),
      ).not.toBeInTheDocument();
    });

    test('omits meta line items independently when the CMS value is missing', () => {
      render(
        <HeroSection
          {...fullProps}
          eventDaysSummary={null}
          venueName={null}
          themeWord={null}
          countdownDays={null}
        />,
      );

      expect(screen.queryByText(/月.*日/)).not.toBeInTheDocument();
      expect(
        screen.queryByText('群馬大学 荒牧キャンパス'),
      ).not.toBeInTheDocument();
      expect(screen.queryByText('万彩')).not.toBeInTheDocument();
      expect(screen.queryByText(/開催まであと/)).not.toBeInTheDocument();
      expect(screen.getAllByText('群馬大学').length).toBeGreaterThan(0);
    });
  });

  describe('live phase', () => {
    test('uses a 50svh height without the pre-event minimum height floor', () => {
      render(<HeroSection {...fullProps} phase="live" />);
      expect(
        screen.getByRole('region', { name: '荒牧祭の写真スライドショー' }),
      ).toHaveClass('h-[50svh]');
      expect(
        screen.getByRole('region', { name: '荒牧祭の写真スライドショー' }),
      ).not.toHaveClass('h-[78svh]', 'min-h-[28rem]');
    });

    test('has no manual previous/next slide buttons', () => {
      render(<HeroSection {...fullProps} phase="live" />);
      expect(
        screen.queryByRole('button', { name: '前の画像を表示' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', { name: '次の画像を表示' }),
      ).not.toBeInTheDocument();
    });

    test('keeps the slide indicator and automatic slideshow', () => {
      render(<HeroSection {...fullProps} phase="live" />);
      expect(
        screen.getByRole('group', { name: '表示する画像を選択' }),
      ).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(6_000));
      expectCurrentSlide(1);
    });

    test('never renders a countdown, even when countdownDays is given', () => {
      render(<HeroSection {...fullProps} phase="live" />);
      expect(screen.queryByText(/開催まであと/)).not.toBeInTheDocument();
    });

    test('uses the same fixed two-line title, typography and scrim as the pre-event layout (only the countdown row differs)', () => {
      const { container } = render(<HeroSection {...fullProps} phase="live" />);

      const mobile = screen.getByTestId('hero-content-mobile');
      const desktop = screen.getByTestId('hero-content-desktop');
      for (const region of [mobile, desktop]) {
        expect(within(region).getByText('群馬大学')).toBeInTheDocument();
        expect(within(region).getByText('荒牧祭')).toBeInTheDocument();
        expect(within(region).getByText('万彩')).toHaveClass('text-[44px]');
      }
      expect(within(desktop).getByText('｜')).toBeInTheDocument();

      const scrim = container.querySelector(
        '[aria-hidden="true"].absolute.inset-0.z-10',
      );
      expect(scrim).toHaveClass('from-text/50', 'to-transparent');
    });

    test('omits meta line items independently when the CMS value is missing', () => {
      render(
        <HeroSection
          {...fullProps}
          phase="live"
          eventDaysSummary={null}
          venueName={null}
          themeWord={null}
        />,
      );

      expect(screen.queryByText(/月.*日/)).not.toBeInTheDocument();
      expect(
        screen.queryByText('群馬大学 荒牧キャンパス'),
      ).not.toBeInTheDocument();
      expect(screen.queryByText('万彩')).not.toBeInTheDocument();
      expect(screen.getAllByText('群馬大学').length).toBeGreaterThan(0);
    });
  });
});
