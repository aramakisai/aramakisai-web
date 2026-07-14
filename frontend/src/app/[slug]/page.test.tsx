import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StaticPage, { generateMetadata } from './page';
import { getPageBySlug } from '@/lib/static-page';
import { notFound } from 'next/navigation';

vi.mock('@/lib/static-page', () => ({
  getPageBySlug: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn().mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

describe('StaticPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders page content and embed when slug is found', async () => {
    vi.mocked(getPageBySlug).mockResolvedValue({
      title: 'お問い合わせ',
      contentHtml: '<p>お問い合わせ本文</p>',
      embedUrl: 'https://forms.example.com',
      embedHeight: 900,
    });

    const params = Promise.resolve({ slug: 'contact' });
    render(await StaticPage({ params }));

    expect(
      screen.getByRole('heading', { name: 'お問い合わせ' }),
    ).toBeInTheDocument();
    expect(screen.getByText('お問い合わせ本文')).toBeInTheDocument();
    expect(screen.getByTitle('お問い合わせ')).toHaveAttribute(
      'src',
      'https://forms.example.com',
    );
  });

  it('calls notFound when slug does not exist', async () => {
    vi.mocked(getPageBySlug).mockResolvedValue(null);

    const params = Promise.resolve({ slug: 'unknown' });
    await expect(StaticPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFound).toHaveBeenCalled();
  });

  it('generateMetadata returns page title when found', async () => {
    vi.mocked(getPageBySlug).mockResolvedValue({
      title: 'アクセス',
      contentHtml: '',
      embedUrl: null,
      embedHeight: null,
    });

    const params = Promise.resolve({ slug: 'access' });
    const metadata = await generateMetadata({ params });

    expect(metadata).toEqual({ title: 'アクセス' });
  });

  it('generateMetadata returns empty object when slug not found', async () => {
    vi.mocked(getPageBySlug).mockResolvedValue(null);

    const params = Promise.resolve({ slug: 'unknown' });
    const metadata = await generateMetadata({ params });

    expect(metadata).toEqual({});
  });
});
