import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TopicDetailPage from './page';
import { getTopicById } from '@/lib/topics';
import { notFound } from 'next/navigation';

vi.mock('@/lib/topics', () => ({
  getTopicById: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  notFound: vi.fn().mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/env', () => ({
  env: {
    NEXT_PUBLIC_DIRECTUS_URL: 'http://localhost:8055',
  },
}));

describe('TopicDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders topic details successfully when topic exists', async () => {
    vi.mocked(getTopicById).mockResolvedValue({
      id: 1,
      title: 'Test Topic Title',
      body: '<p>Test Topic Body</p>',
      imageId: null,
            attachments: [
        {
          id: 'file-1',
          filenameDownload: 'test-image.jpg',
          type: 'image/jpeg',
        },
        {
          id: 'file-2',
          filenameDownload: 'test-doc.pdf',
          type: 'application/pdf',
        },
      ],
    });

    const params = Promise.resolve({ id: '1' });
    const ui = await TopicDetailPage({ params });
    render(ui);

    // Test title
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Test Topic Title',
    );

    // Test body
    expect(screen.getByText('Test Topic Body')).toBeInTheDocument();

    // Test attachments
    expect(screen.getByAltText('test-image.jpg')).toBeInTheDocument();
    expect(screen.getByText('test-doc.pdf')).toBeInTheDocument();
  });

  it('calls notFound when topic does not exist', async () => {
    vi.mocked(getTopicById).mockResolvedValue(null);

    const params = Promise.resolve({ id: '999' });
    await expect(TopicDetailPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFound).toHaveBeenCalled();
  });

  it('calls notFound when id is not a valid number', async () => {
    const params = Promise.resolve({ id: 'invalid' });
    await expect(TopicDetailPage({ params })).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFound).toHaveBeenCalled();
  });
});
