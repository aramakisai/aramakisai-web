import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import AboutPage from './page';
import { getFestivalMeta } from '@/lib/festival-meta';

vi.mock('@/lib/festival-meta', () => ({
  getFestivalMeta: vi.fn(),
}));

vi.mock('@/lib/directus-asset-url', () => ({
  toAssetUrl: vi.fn((id: string | null) =>
    id ? `http://localhost:8055/assets/${id}` : null,
  ),
}));

describe('AboutPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders hero image, event days, and overview (normal case)', async () => {
    vi.mocked(getFestivalMeta).mockResolvedValue({
      name: 'Test Festival',
      eventDays: [{ label: 'Day 1', open: '10:00', close: '18:00' }],
      admissionFee: 'Free',
      paymentNote: null,
      overviewHtml: '<p>Test overview</p>',
      heroImageId: 'hero-123',
    });

    const jsx = await AboutPage();
    render(jsx);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Test Festival' }),
    ).toBeInTheDocument();

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'http://localhost:8055/assets/hero-123');

    // FestivalOverview
    expect(screen.getByText('開催日程')).toBeInTheDocument();
    expect(screen.getByText('Day 1')).toBeInTheDocument();

    // FestivalSummary
    expect(screen.getByText('Test overview')).toBeInTheDocument(); // assuming RichText renders the html text directly, which testing-library can find
  });

  it('does not render hero image area when heroImageId is null', async () => {
    vi.mocked(getFestivalMeta).mockResolvedValue({
      name: 'No Image Festival',
      eventDays: [],
      admissionFee: null,
      paymentNote: null,
      overviewHtml: null,
      heroImageId: null,
    });

    const jsx = await AboutPage();
    render(jsx);

    expect(
      screen.getByRole('heading', { level: 1, name: 'No Image Festival' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders fallback display on fetch error', async () => {
    vi.mocked(getFestivalMeta).mockRejectedValue(new Error('Fetch failed'));

    const jsx = await AboutPage();
    render(jsx);

    expect(
      screen.getByRole('heading', { level: 1, name: 'About' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.queryByText('開催日程')).not.toBeInTheDocument();
    expect(screen.queryByText('Test overview')).not.toBeInTheDocument();
  });
});
