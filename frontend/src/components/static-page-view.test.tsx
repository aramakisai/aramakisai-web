import { render, screen } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { StaticPageView } from './static-page-view';

describe('StaticPageView', () => {
  test('renders title, content and embed', () => {
    render(
      <StaticPageView
        title="お問い合わせ"
        contentHtml="<p>本文</p>"
        embedUrl="https://example.com/form"
        embedTitle="お問い合わせフォーム"
      />,
    );

    expect(
      screen.getByRole('heading', { level: 1, name: 'お問い合わせ' }),
    ).toBeInTheDocument();
    expect(screen.getByText('本文')).toBeInTheDocument();
    const iframe = screen.getByTitle('お問い合わせフォーム');
    expect(iframe).toHaveAttribute('src', 'https://example.com/form');
  });

  test('does not render iframe when embedUrl is null', () => {
    render(
      <StaticPageView
        title="プライバシーポリシー"
        contentHtml="<p>本文</p>"
        embedUrl={null}
        embedTitle=""
      />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(document.querySelector('iframe')).not.toBeInTheDocument();
  });
});
