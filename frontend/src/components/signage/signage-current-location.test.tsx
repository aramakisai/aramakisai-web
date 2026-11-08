import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SignageCurrentLocation } from './signage-current-location';

describe('SignageCurrentLocation', () => {
  it('アイコン・「現在地」・エリア名の順に並ぶ', () => {
    const { container } = render(<SignageCurrentLocation name="1号館" />);
    expect(container.textContent).toBe('location_on現在地1号館');
    const root = container.firstElementChild as HTMLElement;
    expect(root.children[0].firstElementChild).toBe(
      screen.getByTestId('icon-location-pin'),
    );
  });

  it('アイコンは塗りつぶしの primary、「現在地」は太字、エリア名は通常の太さ', () => {
    render(<SignageCurrentLocation name="1号館" />);
    const icon = screen.getByTestId('icon-location-pin');
    expect(icon).toHaveClass('text-primary');
    expect(icon).toHaveStyle({ fontVariationSettings: "'FILL' 1" });
    expect(screen.getByText('現在地')).toHaveClass('font-bold');
    expect(screen.getByText('1号館')).not.toHaveClass('font-bold');
  });

  it('白の角丸の地で、幅はエリア名に追従し折り返さない', () => {
    const { container } = render(<SignageCurrentLocation name="1号館" />);
    expect(container.firstElementChild).toHaveClass(
      'inline-flex',
      'rounded-full',
      'bg-white/[0.92]',
      'whitespace-nowrap',
      'text-signage-meta',
    );
  });

  it('className を受け取る', () => {
    const { container } = render(
      <SignageCurrentLocation name="x" className="absolute right-6" />,
    );
    expect(container.firstElementChild).toHaveClass('absolute', 'right-6');
  });
});
