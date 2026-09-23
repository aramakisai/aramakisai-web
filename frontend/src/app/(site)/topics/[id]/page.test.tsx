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
    NEXT_PUBLIC_CMS_URL: 'http://localhost:8055',
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
          filesize: 102400,
        },
        {
          id: 'file-2',
          filenameDownload: 'test-doc.pdf',
          type: 'application/pdf',
          filesize: 204800,
        },
      ],
    });

    const params = Promise.resolve({ id: '1' });
    const ui = await TopicDetailPage({ params });
    render(ui);

    // main landmark はサイト共通の枠 (layout.tsx) 側に集約したため、ここではページ本体の見出しのみ確認する
    expect(
      screen.getByRole('heading', { level: 1, name: 'Test Topic Title' }),
    ).toBeInTheDocument();

    // Test body
    expect(screen.getByText('Test Topic Body')).toBeInTheDocument();

    // 画像も他形式と同じファイル名の行として表示するため <img> では出ない
    expect(screen.getByText('test-image.jpg')).toBeInTheDocument();
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
