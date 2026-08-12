import { render, screen, within } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { AboutSection } from './about-section';

describe('AboutSection', () => {
  test('renders the three about blocks with the specified content', () => {
    const { container } = render(<AboutSection />);

    const about = screen.getByRole('region', { name: '荒牧祭について' });
    expect(about).toHaveAttribute('id', 'about');
    expect(about).toHaveClass('scroll-mt-24');

    const title = within(about).getByRole('heading', {
      level: 2,
      name: '荒牧祭について',
    });
    expect(title).toHaveClass('flex', 'flex-wrap', 'items-center');
    const titleImage = within(title).getByRole('img', { name: '荒牧祭' });
    expect(titleImage.getAttribute('src')).toContain('aramakisai.png');
    expect(titleImage).toHaveAttribute('width', '1500');
    expect(titleImage).toHaveAttribute('height', '606');
    expect(titleImage).toHaveClass(
      'h-16',
      'w-auto',
      'sm:h-[4.5rem]',
      'lg:h-20',
    );
    expect(within(title).getByText('について')).toHaveClass(
      'text-3xl',
      'sm:text-4xl',
      'lg:text-5xl',
    );

    const blockHeadings = within(about).getAllByRole('heading', { level: 3 });
    expect(blockHeadings.map((heading) => heading.textContent)).toEqual([
      '01概要',
      '02開催スケジュール',
      '03今年のテーマ',
    ]);

    expect(container.querySelector('#about-overview')).toHaveClass(
      'scroll-mt-24',
    );
    expect(container.querySelector('#about-schedule')).toHaveClass(
      'scroll-mt-24',
    );
    expect(container.querySelector('#about-theme')).toHaveClass('scroll-mt-24');
    expect(container.querySelectorAll('#about-overview')).toHaveLength(1);
    expect(container.querySelectorAll('#about-schedule')).toHaveLength(1);
    expect(container.querySelectorAll('#about-theme')).toHaveLength(1);

    expect(
      within(about).getByText(
        '群馬大学・荒牧キャンパスを彩る、年に一度の学園祭。',
      ),
    ).toBeInTheDocument();
    expect(
      within(about).getByText(
        '2026年で第73回を迎え、学生による模擬店や教室展示、ステージ発表をはじめ、実行委員会企画やゲスト企画など、キャンパス全体でさまざまな企画が行われます。',
      ),
    ).toBeInTheDocument();
    expect(
      within(about).getByText('昨年度は8,989人の方にご来場いただきました。'),
    ).toBeInTheDocument();

    expect(
      within(about).getByText('2026年11月14日（土）・15日（日）開催'),
    ).toBeInTheDocument();
    const scheduleDays = within(about).getByTestId('schedule-days');
    expect(scheduleDays).toHaveClass('md:grid-cols-2');
    expect(within(scheduleDays).getByText('DAY 1')).toBeInTheDocument();
    expect(within(scheduleDays).getByText('2026.11.14 SAT')).toHaveAttribute(
      'datetime',
      '2026-11-14',
    );
    expect(within(scheduleDays).getByText('10:00 — 17:30')).toBeInTheDocument();
    expect(within(scheduleDays).getByText('DAY 2')).toBeInTheDocument();
    expect(within(scheduleDays).getByText('2026.11.15 SUN')).toHaveAttribute(
      'datetime',
      '2026-11-15',
    );
    expect(within(scheduleDays).getByText('10:00 — 16:30')).toBeInTheDocument();
    expect(
      within(about).getByText('群馬大学 荒牧キャンパス'),
    ).toBeInTheDocument();

    const venueDetails = within(about).getByTestId('venue-details');
    const campusMap = within(about).getByTitle(
      '群馬大学荒牧キャンパス Google Maps',
    );
    const scheduleClosing = within(about).getByTestId('schedule-closing');
    expect(venueDetails.nextElementSibling).toBe(campusMap);
    expect(campusMap.nextElementSibling).toBe(scheduleClosing);

    const mapUrl = new URL(campusMap.getAttribute('src') ?? '');
    expect(mapUrl.origin).toBe('https://www.google.com');
    expect(mapUrl.pathname).toBe('/maps/embed');
    expect(mapUrl.searchParams.get('origin')).toBe('mfe');
    expect(mapUrl.searchParams.get('pb')).toBeTruthy();
    expect(campusMap).toHaveAttribute('loading', 'lazy');
    expect(campusMap).toHaveAttribute('allowfullscreen');
    expect(campusMap).toHaveAttribute(
      'referrerpolicy',
      'no-referrer-when-downgrade',
    );
    expect(campusMap).toHaveClass(
      'w-full',
      'max-w-full',
      'h-[18rem]',
      'sm:h-[20rem]',
      'lg:h-[25rem]',
    );

    expect(within(about).getByText('2026 THEME')).toBeInTheDocument();
    expect(within(about).getByText('万彩')).toHaveClass(
      'text-[clamp(3.25rem,18vw,5.5rem)]',
    );
    expect(
      within(about).queryByText('― キャンパスを、たくさんの彩りで。―'),
    ).not.toBeInTheDocument();
    expect(within(about).getByText('企画する人。')).toBeInTheDocument();
    expect(
      within(about).getByText('そして、会場を訪れる人。'),
    ).toBeInTheDocument();
    expect(within(about).getByText('「来場者1万人」')).toBeInTheDocument();
    expect(within(about).queryByText('2026年11月。')).not.toBeInTheDocument();
    expect(
      within(about).queryByText('一人ひとりの色が集まり、'),
    ).not.toBeInTheDocument();
    expect(
      within(about).queryByText(
        '荒牧キャンパスが「万」の彩りに染まる2日間をお楽しみください。',
      ),
    ).not.toBeInTheDocument();

    expect(container.querySelectorAll('#about')).toHaveLength(1);
  });

  test('keeps 01 and 02 photo-free while using background1 only for the theme visual', () => {
    const { container } = render(<AboutSection />);

    const about = screen.getByRole('region', { name: '荒牧祭について' });
    const aboutImages = within(about).getAllByRole('img');
    expect(aboutImages).toHaveLength(2);
    expect(about.querySelectorAll('figure')).toHaveLength(0);
    const backgroundImageSources = aboutImages
      .map((image) => decodeURIComponent(image.getAttribute('src') ?? ''))
      .filter((source) => source.includes('/images/background1.png'));
    expect(backgroundImageSources).toHaveLength(1);
    expect(backgroundImageSources[0]).toContain('/images/background1.png');
    expect(about.innerHTML).not.toMatch(/\/images\/top\/top[0-4]\.png/);
    expect(screen.queryByTestId('overview-gallery')).not.toBeInTheDocument();
    expect(screen.queryByTestId('schedule-visual')).not.toBeInTheDocument();
    expect(screen.queryByTestId('theme-collage')).not.toBeInTheDocument();

    const scheduleDays = screen.getByTestId('schedule-days');
    expect(scheduleDays).toHaveClass('grid-cols-1', 'md:grid-cols-2');
    within(scheduleDays)
      .getAllByTestId('schedule-card')
      .forEach((card) => expect(card).toHaveClass('bg-white'));

    const sectionDividers = screen.getAllByTestId('section-divider');
    expect(sectionDividers).toHaveLength(3);
    sectionDividers.forEach((line) =>
      expect(line).toHaveClass('mansai-spectrum-line', 'h-px'),
    );

    const spectrumLines = container.querySelectorAll('.mansai-spectrum-line');
    expect(spectrumLines).toHaveLength(5);
    spectrumLines.forEach((line) => expect(line).toHaveClass('h-px'));
  });

  test('places the theme label above a responsive background1 visual with a white theme word', () => {
    render(<AboutSection />);

    const themeLabel = screen.getByTestId('theme-label');
    const themeVisual = screen.getByTestId('theme-visual');
    expect(themeLabel).toHaveTextContent('2026 THEME');
    expect(themeLabel).toHaveClass(
      'text-xs',
      'tracking-[0.34em]',
      'text-slate-800',
    );
    expect(themeVisual).not.toContainElement(themeLabel);
    expect(themeLabel.nextElementSibling).toBe(themeVisual);

    expect(themeVisual).toHaveClass(
      'relative',
      'w-full',
      'max-w-full',
      'overflow-hidden',
      'aspect-[16/10]',
      'sm:aspect-[40/21]',
    );
    expect(themeVisual.getAttribute('class')).not.toMatch(/\bshadow-/);

    const themeImage = screen.getByRole('img', {
      name: '荒牧祭2026「万彩」メインビジュアル',
    });
    expect(decodeURIComponent(themeImage.getAttribute('src') ?? '')).toContain(
      '/images/background1.png',
    );
    expect(themeImage).toHaveAttribute('width', '1920');
    expect(themeImage).toHaveAttribute('height', '1080');
    expect(themeImage).toHaveClass(
      'h-full',
      'w-full',
      'object-cover',
      'object-center',
    );

    expect(screen.getByTestId('theme-image-overlay')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
    expect(screen.getByTestId('theme-image-overlay')).toHaveClass(
      'bg-slate-950/10',
    );

    expect(within(themeVisual).getByText('万彩')).toHaveClass('text-white');
    expect(within(themeVisual).getByText('万彩')).not.toHaveClass(
      'mansai-spectrum-text',
      'bg-clip-text',
      'text-transparent',
    );
    expect(
      screen.queryByText('― キャンパスを、たくさんの彩りで。―'),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId('theme-color-field')).not.toBeInTheDocument();
    expect(screen.queryByTestId('theme-bloom')).not.toBeInTheDocument();
    expect(screen.queryByTestId('theme-noise')).not.toBeInTheDocument();

    expect(
      screen.queryByRole('group', {
        name: '来場者数の実績と目標',
      }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('VISITORS 2025')).not.toBeInTheDocument();
    expect(screen.queryByText('→')).not.toBeInTheDocument();
    expect(screen.queryByText('10,000')).not.toBeInTheDocument();
    expect(screen.queryByText('GOAL 2026')).not.toBeInTheDocument();

    const themeDescription = screen.getByTestId('theme-description');
    expect(themeVisual.parentElement?.nextElementSibling).toBe(
      themeDescription,
    );
    expect(themeDescription).toHaveTextContent(
      'また、昨年度の来場者数は8,989人でした。',
    );
    expect(themeDescription).toHaveTextContent(
      '今年はそこからさらに多くの方に荒牧祭を楽しんでいただき、「来場者1万人」を目指します。',
    );
    expect(themeDescription).toHaveTextContent(
      'その目標である「万」という言葉への想いも、「万彩」というテーマに込められています。',
    );
  });

  test('uses one-column mobile layout, compact spacing, and overflow-safe content', () => {
    const { container } = render(<AboutSection />);
    const about = container.querySelector('#about');
    expect(about).not.toHaveClass('overflow-x-clip');

    const outer = about?.firstElementChild;
    expect(outer).toHaveClass(
      'px-4',
      'py-16',
      'sm:px-6',
      'sm:py-20',
      'lg:px-8',
      'lg:py-32',
    );
    expect(outer?.querySelector('header')).toHaveClass(
      'mb-14',
      'sm:mb-20',
      'lg:mb-28',
    );
    expect(outer?.querySelector('header + div')).toHaveClass(
      'space-y-20',
      'sm:space-y-24',
      'lg:space-y-36',
    );

    const sections = [
      container.querySelector('#about-overview'),
      container.querySelector('#about-schedule'),
      container.querySelector('#about-theme'),
    ];
    sections.forEach((section) => {
      expect(section).toHaveClass(
        'grid-cols-1',
        'lg:grid-cols-[18rem_minmax(0,1fr)]',
      );
      expect(section?.lastElementChild).toHaveClass('min-w-0');
    });

    expect(sections[1]).toHaveClass('pt-16', 'sm:pt-20', 'lg:pt-28');
    expect(sections[2]).toHaveClass('pt-16', 'sm:pt-20', 'lg:pt-28');

    screen.getAllByTestId('schedule-card').forEach((card) => {
      expect(card).toHaveClass('p-5', 'sm:p-7', 'lg:p-9');
    });
    screen
      .getAllByTestId('schedule-card')
      .flatMap((card) => Array.from(card.querySelectorAll('time, time + p')))
      .forEach((value) => expect(value).toHaveClass('whitespace-nowrap'));

    expect(screen.getByTestId('theme-visual')).toHaveClass(
      'aspect-[16/10]',
      'sm:aspect-[40/21]',
    );
  });
});
