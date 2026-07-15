import { render, screen } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { HeroSection } from './hero-section';

describe('HeroSection', () => {
  test('renders heroMessageHtml, heroImageUrl, and embedUrl', () => {
    render(
      <HeroSection
        heroImageUrl="https://example.com/hero.jpg"
        heroMessageHtml="<h1>Welcome</h1>"
        embedUrl="https://example.com/embed"
      />,
    );

    const img = screen.getByRole('img');
    expect(img).toHaveAttribute('src', 'https://example.com/hero.jpg');

    // CMS側見出しはページ内他のh1と競合しないよう1段階下げてh2として出力される
    const heading = screen.getByRole('heading', { level: 2, name: 'Welcome' });
    expect(heading).toBeInTheDocument();

    const iframe = screen.getByTitle('埋め込みコンテンツ');
    expect(iframe).toBeInTheDocument();
    expect(iframe).toHaveAttribute('src', 'https://example.com/embed');
  });

  test('does not render img or iframe when URLs are not provided', () => {
    render(
      <HeroSection
        heroImageUrl={null}
        heroMessageHtml="<h1>Welcome</h1>"
        embedUrl={null}
      />,
    );

    const img = screen.queryByRole('img');
    expect(img).not.toBeInTheDocument();

    const iframe = screen.queryByTitle('埋め込みコンテンツ');
    expect(iframe).not.toBeInTheDocument();
  });
});
