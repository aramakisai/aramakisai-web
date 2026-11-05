// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { ContextMenuGuard } from './context-menu-guard';

it('contextmenu の既定動作を止める', () => {
  render(<ContextMenuGuard />);
  const e = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  document.body.dispatchEvent(e);
  expect(e.defaultPrevented).toBe(true);
});

const dragstart = (el: Element) => {
  const e = new Event('dragstart', { bubbles: true, cancelable: true });
  el.dispatchEvent(e);
  return e.defaultPrevented;
};

it('img の dragstart は止める', () => {
  render(<ContextMenuGuard />);
  const img = document.body.appendChild(document.createElement('img'));
  expect(dragstart(img)).toBe(true);
});

it('img 以外の dragstart は止めない', () => {
  render(<ContextMenuGuard />);
  const p = document.body.appendChild(document.createElement('p'));
  expect(dragstart(p)).toBe(false);
});
