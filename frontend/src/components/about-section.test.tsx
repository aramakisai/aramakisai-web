import { render, screen, within } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { AboutSection } from './about-section';
import type {
  FestivalOverview,
  FestivalTheme,
} from '@/lib/home-page-types';

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_DIRECTUS_URL: 'http://localhost:8055',
  },
}));

const festival: FestivalOverview = {
  name: '荒牧祭',
  eventDays: [
    { label: '11月14日', open: '10:00', close: '17:30' },
    { label: '11月15日', open: '10:00', close: '16:30' },
  ],
  overviewHtml: '<p>群馬大学荒牧キャンパスを彩る学園祭。</p>',
  heroImageId: null,
};

const theme: FestivalTheme = {
  word: '万彩',
  imageId: 'theme-file-id',
  descriptionHtml: '<p>今年のテーマは万彩です。</p>',
};

const validMapUrl =
  'https://www.google.com/maps/embed?pb=!1m2!2m1!1zsomething';

const emptyFestival: FestivalOverview = {
  name: '荒牧祭',
  eventDays: [],
  overviewHtml: null,
  heroImageId: null,
};

const emptyTheme: FestivalTheme = {
  word: null,
  imageId: null,
  descriptionHtml: null,
};

describe('AboutSection', () => {
  test('renders the three about blocks from props', () => {
    render(
      <AboutSection
        festival={festival}
        theme={theme}
        venueName="群馬大学 荒牧キャンパス"
        campusMapUrl={validMapUrl}
      />,
    );

    const about = screen.getByRole('region', { name: '荒牧祭について' });
    expect(about).toHaveAttribute('id', 'about');
    expect(about).toHaveClass('scroll-mt-24');

    const blockHeadings = within(about).getAllByRole('heading', { level: 3 });
    expect(blockHeadings.map((heading) => heading.textContent)).toEqual([
      '01概要',
      '02開催スケジュール',
      '03今年のテーマ',
    ]);

    expect(
      within(about).getByText('群馬大学荒牧キャンパスを彩る学園祭。'),
    ).toBeInTheDocument();

    const scheduleDays = within(about).getByTestId('schedule-days');
    const cards = within(scheduleDays).getAllByTestId('schedule-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]).toHaveTextContent('11月14日');
    expect(cards[0]).toHaveTextContent('10:00〜17:30');
    expect(cards[1]).toHaveTextContent('11月15日');
    expect(cards[1]).toHaveTextContent('10:00〜16:30');

    expect(
      within(about).getByText('群馬大学 荒牧キャンパス'),
    ).toBeInTheDocument();

    const campusMap = within(about).getByTestId('campus-map');
    expect(campusMap).toHaveAttribute('src', validMapUrl);

    expect(within(about).getByTestId('theme-word')).toHaveTextContent(
      '万彩',
    );
    const themeImage = within(about).getByRole('img', {
      name: /万彩/,
    });
    expect(themeImage).toHaveAttribute(
      'src',
      'http://localhost:8055/assets/theme-file-id?format=webp',
    );
    expect(
      within(about).getByText('今年のテーマは万彩です。'),
    ).toBeInTheDocument();
  });

  test('hides overview/venue/map/theme blocks individually when their data is missing, without dropping the section', () => {
    render(
      <AboutSection
        festival={emptyFestival}
        theme={emptyTheme}
        venueName={null}
        campusMapUrl={null}
      />,
    );

    expect(
      screen.getByRole('region', { name: '荒牧祭について' }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent),
    ).toEqual(['01概要', '02開催スケジュール']);

    expect(screen.queryByTestId('schedule-days')).not.toBeInTheDocument();
    expect(screen.queryByTestId('venue-details')).not.toBeInTheDocument();
    expect(screen.queryByTestId('campus-map')).not.toBeInTheDocument();
    expect(screen.queryByTestId('theme-visual')).not.toBeInTheDocument();
    expect(screen.queryByTestId('theme-description')).not.toBeInTheDocument();
  });

  test('hides only the map when the URL is not a Google Maps embed URL', () => {
    render(
      <AboutSection
        festival={festival}
        theme={theme}
        venueName="群馬大学 荒牧キャンパス"
        campusMapUrl="https://evil.example.com/embed"
      />,
    );

    expect(screen.queryByTestId('campus-map')).not.toBeInTheDocument();
    expect(
      screen.getByText('群馬大学 荒牧キャンパス'),
    ).toBeInTheDocument();
  });

  test('hides the theme visual but keeps the theme word/description when the image is missing', () => {
    render(
      <AboutSection
        festival={festival}
        theme={{ ...theme, imageId: null }}
        venueName={null}
        campusMapUrl={null}
      />,
    );

    expect(screen.queryByTestId('theme-visual')).not.toBeInTheDocument();
    expect(screen.getByTestId('theme-description')).toHaveTextContent(
      '今年のテーマは万彩です。',
    );
  });

  test('renders the title logo as a plain img element without next/image', () => {
    render(
      <AboutSection
        festival={festival}
        theme={theme}
        venueName="群馬大学 荒牧キャンパス"
        campusMapUrl={validMapUrl}
      />,
    );

    const titleImage = screen.getByRole('img', { name: '荒牧祭' });
    expect(titleImage.tagName).toBe('IMG');
    expect(titleImage).toHaveAttribute('src', '/images/aramakisai.png');
  });
});
