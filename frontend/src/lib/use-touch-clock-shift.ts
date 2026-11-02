import { useEffect, useState } from 'react';
import { isTouchClockMessage } from './signage-trial';

export function useTouchClockShift(): number | null {
  const [shift, setShift] = useState<number | null>(null);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (window.parent === window || e.source !== window.parent) return;
      if (isTouchClockMessage(e.data)) setShift(e.data.trialShiftMs);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  return shift;
}
