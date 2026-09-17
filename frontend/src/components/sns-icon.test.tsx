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

  it.each([
    ['x', 'icon-x', '#000000'],
    ['facebook', 'icon-facebook', '#1877F2'],
    ['youtube', 'icon-youtube', '#FF0000'],
    ['line', 'icon-line', '#06C755'],
  ])('renders %s with its official brand color', (platform, testId, color) => {
    render(<SnsIcon platform={platform} />);
    const svg = screen.getByTestId(testId);
    expect(svg.innerHTML).toContain(color);
  });

  it('renders Instagram with its official gradient rather than currentColor', () => {
    render(<SnsIcon platform="instagram" />);
    const svg = screen.getByTestId('icon-instagram');
    expect(svg.querySelector('linearGradient')).not.toBeNull();
    expect(svg.innerHTML).not.toContain('currentColor');
  });

  it('renders TikTok with its official cyan and magenta layers', () => {
    render(<SnsIcon platform="tiktok" />);
    const svg = screen.getByTestId('icon-tiktok');
    expect(svg.innerHTML).toContain('#25F4EE');
    expect(svg.innerHTML).toContain('#FE2C55');
  });
});
