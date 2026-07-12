import { render, screen } from '@testing-library/react';
import { expect, test, describe } from 'vitest';
import { SponsorsList } from './sponsors-list';

describe('SponsorsList', () => {
  const sponsors = [
    {
      id: 1,
      name: 'Sponsor 1',
      logoUrl: 'https://example.com/logo1.png',
      url: 'https://example.com/sponsor1',
    },
    { id: 2, name: 'Sponsor 2', logoUrl: null, url: null },
  ];

  test('renders sponsors with logo image linked to url', () => {
    render(<SponsorsList sponsors={sponsors} />);

    const logo1 = screen.getByAltText('Sponsor 1');
    expect(logo1).toHaveAttribute('src', 'https://example.com/logo1.png');
    const link1 = screen.getByRole('link', { name: 'Sponsor 1' });
    expect(link1).toHaveAttribute('href', 'https://example.com/sponsor1');

    expect(screen.getByText('Sponsor 2')).toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: 'Sponsor 2' }),
    ).not.toBeInTheDocument();
  });

  test('renders nothing when array is empty', () => {
    const { container } = render(<SponsorsList sponsors={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
