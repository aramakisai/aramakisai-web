// @vitest-environment jsdom
import { renderHook, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/use-phase', () => ({ usePhase: () => ({ phase: 'live' }) }));
import { useMapSheetInset } from './use-map-sheet-inset';

describe('useMapSheetInset', () => {
  it('行き先は即時、コンテナへの反映は遅れて届き、その差が getPendingInset になる', () => {
    const { result } = renderHook(() => useMapSheetInset());
    act(() => result.current.onTargetHeightIntent(380));
    expect(result.current.getPendingInset()).toBe(364);
    expect(result.current.bottomInset).toBe(0);

    act(() => result.current.onTargetHeightChange(380));
    expect(result.current.getPendingInset()).toBe(0);
    expect(result.current.bottomInset).toBe(364);
  });
});
