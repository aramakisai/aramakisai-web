import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { HeroSection } from './hero-section';

const expectedImages = [
  '/images/top/top0.png',
  '/images/top/top1.png',
  '/images/top/top2.png',
  '/images/top/top3.png',
  '/images/top/top4.png',
];

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
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('renders the five local hero images in order with slideshow controls', () => {
    const { container } = render(<HeroSection />);

    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(5);
    expect(Array.from(images, (image) => image.getAttribute('src'))).toEqual(
      expectedImages,
    );
    images.forEach((image) => {
      expect(image).toHaveAttribute('alt', '');
      expect(image).toHaveClass('object-cover', 'object-center');
    });
    expect(container.querySelector('section > .z-10')).toHaveClass(
      'bg-black/10',
    );

    expect(
      screen.getByRole('region', { name: '荒牧祭の写真スライドショー' }),
    ).toHaveClass(
      'h-[78svh]',
      'min-h-[28rem]',
      'lg:h-[calc(100vh-5rem)]',
      'lg:min-h-[30rem]',
    );
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

  test('automatically advances every six seconds and loops to the first image', () => {
    render(<HeroSection />);

    act(() => vi.advanceTimersByTime(6_000));
    expectCurrentSlide(1);

    act(() => vi.advanceTimersByTime(18_000));
    expectCurrentSlide(4);

    act(() => vi.advanceTimersByTime(6_000));
    expectCurrentSlide(0);
  });

  test('loops in both directions with the previous and next buttons', () => {
    render(<HeroSection />);

    fireEvent.click(screen.getByRole('button', { name: '前の画像を表示' }));
    expectCurrentSlide(4);

    fireEvent.click(screen.getByRole('button', { name: '次の画像を表示' }));
    expectCurrentSlide(0);
  });

  test('indicator navigation resets the automatic slideshow timer', () => {
    render(<HeroSection />);

    act(() => vi.advanceTimersByTime(5_500));
    fireEvent.click(screen.getByRole('button', { name: '3枚目の画像を表示' }));
    expectCurrentSlide(2);

    act(() => vi.advanceTimersByTime(5_999));
    expectCurrentSlide(2);

    act(() => vi.advanceTimersByTime(1));
    expectCurrentSlide(3);
  });

  test('selecting the current indicator also resets the automatic timer', () => {
    render(<HeroSection />);

    act(() => vi.advanceTimersByTime(5_500));
    fireEvent.click(screen.getByRole('button', { name: '1枚目の画像を表示' }));

    act(() => vi.advanceTimersByTime(5_999));
    expectCurrentSlide(0);

    act(() => vi.advanceTimersByTime(1));
    expectCurrentSlide(1);
  });

  test('clears the automatic timer when unmounted', () => {
    const { unmount } = render(<HeroSection />);

    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  test('uses one-second crossfades and reduced-motion fallbacks', () => {
    const { container } = render(<HeroSection />);

    const slides = screen.getAllByTestId('hero-slide');
    slides.forEach((slide) => {
      expect(slide).toHaveClass('duration-1000');
      expect(slide).toHaveClass('motion-reduce:transition-none');
    });

    const style = container.querySelector('style');
    expect(style).toHaveTextContent('prefers-reduced-motion: reduce');
    expect(style).toHaveTextContent('scale(1.04)');
  });

  test('renders an animated scroll indicator below the slide indicators', () => {
    const { container } = render(<HeroSection />);

    const slideIndicators = screen.getByRole('group', {
      name: '表示する画像を選択',
    });
    expect(slideIndicators).toHaveClass('bottom-24');

    const scrollLabel = screen.getByText('SCROLL');
    expect(scrollLabel).toHaveClass('text-[11px]', 'tracking-[0.32em]');

    const scrollLine = container.querySelector('.aramakisai-scroll-line');
    expect(scrollLine).toHaveClass('h-12', 'w-px');

    const style = container.querySelector('style');
    expect(style).toHaveTextContent(
      'animation: aramakisai-scroll-line 1.8s ease-out infinite',
    );
    expect(style).toHaveTextContent('50.1%');
    expect(style).toHaveTextContent('prefers-reduced-motion: reduce');
    expect(style).toHaveTextContent(
      /\.aramakisai-scroll-line\s*{[^}]*animation: none/,
    );
  });

  test('keeps mobile slideshow controls separated with touch-friendly targets', () => {
    const { container } = render(<HeroSection />);
    const controls = screen.getAllByRole('button');
    const previousButton = controls[0];
    const nextButton = controls[1];

    [previousButton, nextButton].forEach((button) => {
      expect(button).toHaveClass('h-11', 'w-11', 'lg:h-12', 'lg:w-12');
    });
    expect(previousButton).toHaveClass('left-4', 'lg:left-10');
    expect(nextButton).toHaveClass('right-4', 'lg:right-10');

    const slideIndicators = screen.getAllByRole('group')[0];
    expect(slideIndicators).toHaveClass('bottom-24');
    within(slideIndicators)
      .getAllByRole('button')
      .forEach((button) => expect(button).toHaveClass('h-11', 'w-11'));

    expect(
      container.querySelector('.aramakisai-scroll-line')?.parentElement,
    ).toHaveClass('bottom-4');
  });
});
