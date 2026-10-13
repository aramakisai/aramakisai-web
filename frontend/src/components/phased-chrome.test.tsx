import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PHASE_OVERRIDE_COOKIE } from '@/lib/phase';

// resolvePhase は DEV_OVERRIDE_ENABLED が偽だと Cookie を無視するため、import より前に真にする
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE = 'true';
});

import { PhasedBottomSpacer } from './phased-chrome';

describe('PhasedBottomSpacer', () => {
  afterEach(() => {
    document.cookie = `${PHASE_OVERRIDE_COOKIE}=; path=/; max-age=0`;
  });

  it('Cookie が無いとき (開催前) は余白を出さない', () => {
    const { container } = render(<PhasedBottomSpacer />);
    expect(container).toBeEmptyDOMElement();
  });

  it('Cookie が live のとき、下部ナビゲーション分の余白を出す', () => {
    document.cookie = `${PHASE_OVERRIDE_COOKIE}=live; path=/`;
    const { container } = render(<PhasedBottomSpacer />);
    expect(container.firstChild).toHaveClass('lg:hidden');
  });
});
