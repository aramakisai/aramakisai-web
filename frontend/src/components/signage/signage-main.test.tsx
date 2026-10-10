import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PlaylistEntry, SignageSnapshot } from '@/lib/signage';
import { SignageHeadingChip } from './signage-heading-chip';
import { SignageMain } from './signage-main';

const entry: PlaylistEntry = {
  key: '1:0',
  page: 0,
  slide: { id: 1, durationSec: 10, kind: 'parking' },
};
const snapshot = {} as SignageSnapshot;
const now = new Date('2026-11-14T00:00:00Z');

describe('SignageMain', () => {
  it('種別に対応する部品へ entry・snapshot・now を渡す', () => {
    render(
      <SignageMain
        entry={entry}
        snapshot={snapshot}
        now={now}
        renderers={{
          parking: (p) => (
            <div data-testid="parking">{`${p.entry.key}|${p.now.toISOString()}`}</div>
          ),
        }}
      />,
    );
    expect(screen.getByTestId('parking').textContent).toBe(
      '1:0|2026-11-14T00:00:00.000Z',
    );
  });

  it('項目が0件、または部品が未登録なら空の地だけを出す', () => {
    const { container, rerender } = render(
      <SignageMain entry={null} snapshot={snapshot} now={now} renderers={{}} />,
    );
    expect(container.querySelector('.signage-main')?.childElementCount).toBe(0);
    rerender(
      <SignageMain
        entry={entry}
        snapshot={snapshot}
        now={now}
        renderers={{}}
      />,
    );
    expect(container.querySelector('.signage-main')?.childElementCount).toBe(0);
  });
});

describe('SignageHeadingChip', () => {
  it('アイコンと文字を出す', () => {
    render(<SignageHeadingChip icon="handshake" label="ご協賛" />);
    expect(screen.getByText('handshake').className).toContain(
      'material-symbols-sharp',
    );
    expect(screen.getByText('ご協賛')).toBeTruthy();
  });
});
