import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CrossFade } from './cross-fade';

const layerOf = (text: string) =>
  screen.getByText(text).closest('[class*="grid-area"]') as HTMLElement;

describe('CrossFade', () => {
  it('key 変更直後は旧と新が両方 DOM にあり、新だけが fade-in で出る', () => {
    const { rerender } = render(<CrossFade transitionKey="a">A</CrossFade>);
    rerender(<CrossFade transitionKey="b">B</CrossFade>);
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(layerOf('B').classList.contains('fade-in')).toBe(true);
  });

  it('新の animationend で旧を外す', () => {
    const { rerender } = render(<CrossFade transitionKey="a">A</CrossFade>);
    rerender(<CrossFade transitionKey="b">B</CrossFade>);
    fireEvent.animationEnd(layerOf('B'));
    expect(screen.queryByText('A')).not.toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
  });

  it('連続で key が変わっても残すのは直前の1つだけ', () => {
    const { rerender } = render(<CrossFade transitionKey="a">A</CrossFade>);
    rerender(<CrossFade transitionKey="b">B</CrossFade>);
    rerender(<CrossFade transitionKey="c">C</CrossFade>);
    expect(screen.queryByText('A')).not.toBeInTheDocument();
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
  });

  it('enabled=false では旧を残さず fade-in も付けない', () => {
    const { rerender } = render(
      <CrossFade transitionKey="a" enabled={false}>
        A
      </CrossFade>,
    );
    rerender(
      <CrossFade transitionKey="b" enabled={false}>
        B
      </CrossFade>,
    );
    expect(screen.queryByText('A')).not.toBeInTheDocument();
    expect(layerOf('B').classList.contains('fade-in')).toBe(false);
  });
});
