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
