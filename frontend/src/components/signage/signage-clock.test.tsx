// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { SignageClock } from './signage-clock';

it('数字は 1 桁ずつ固定幅の箱に入り、全体の文字列は時刻のまま', () => {
  const { container } = render(
    <SignageClock now={new Date('2026-11-14T01:07:00Z')} />,
  );
  expect(container.textContent).toMatch(/^\d\d:\d\d$/);
  expect(container.querySelectorAll('span.inline-flex')).toHaveLength(4);
});
