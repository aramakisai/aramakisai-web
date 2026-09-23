import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MapErrorBoundary } from './map-error-boundary';

function ThrowingChild(): never {
  throw new Error('map failed to load');
}

describe('MapErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when no error occurs', () => {
    render(
      <MapErrorBoundary fallback={<p>フォールバック</p>}>
        <p>地図</p>
      </MapErrorBoundary>,
    );

    expect(screen.getByText('地図')).toBeInTheDocument();
    expect(screen.queryByText('フォールバック')).not.toBeInTheDocument();
  });

  it('renders the fallback without leaking the error past the boundary when a child fails', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() =>
      render(
        <MapErrorBoundary fallback={<p>フォールバック</p>}>
          <ThrowingChild />
        </MapErrorBoundary>,
      ),
    ).not.toThrow();

    expect(screen.getByText('フォールバック')).toBeInTheDocument();
    expect(screen.queryByText('地図')).not.toBeInTheDocument();
  });
});
