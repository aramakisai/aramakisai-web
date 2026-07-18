import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SnsIcon } from './sns-icon';

describe('SnsIcon', () => {
  it('renders X icon for "x" platform (case-insensitive)', () => {
    const { rerender } = render(<SnsIcon platform="x" />);
    expect(screen.getByTestId('icon-x')).toBeInTheDocument();

    rerender(<SnsIcon platform="X" />);
    expect(screen.getByTestId('icon-x')).toBeInTheDocument();
  });

  it('renders X icon for "twitter" platform', () => {
    render(<SnsIcon platform="Twitter" />);
    expect(screen.getByTestId('icon-x')).toBeInTheDocument();
  });

  it('renders Instagram icon for "instagram"', () => {
    render(<SnsIcon platform="Instagram" />);
    expect(screen.getByTestId('icon-instagram')).toBeInTheDocument();
  });

  it('renders Facebook icon for "facebook"', () => {
    render(<SnsIcon platform="Facebook" />);
    expect(screen.getByTestId('icon-facebook')).toBeInTheDocument();
  });

  it('renders Youtube icon for "youtube"', () => {
    render(<SnsIcon platform="YouTube" />);
    expect(screen.getByTestId('icon-youtube')).toBeInTheDocument();
  });

  it('renders Tiktok icon for "tiktok"', () => {
    render(<SnsIcon platform="TikTok" />);
    expect(screen.getByTestId('icon-tiktok')).toBeInTheDocument();
  });

  it('renders Line icon for "line"', () => {
    render(<SnsIcon platform="LINE" />);
    expect(screen.getByTestId('icon-line')).toBeInTheDocument();
  });

  it('renders generic link icon and text for unknown platforms', () => {
    render(<SnsIcon platform="Mastodon" />);
    expect(screen.getByTestId('icon-link')).toBeInTheDocument();
    expect(screen.getByText('Mastodon')).toBeInTheDocument();
    expect(screen.getByText('Mastodon')).not.toHaveAttribute('aria-hidden');
  });

  it('adds aria-hidden="true" to all SVG icons for known platforms', () => {
    render(<SnsIcon platform="x" />);
    expect(screen.getByTestId('icon-x')).toHaveAttribute('aria-hidden', 'true');
  });
});
