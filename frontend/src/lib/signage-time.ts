import { useEffect, useState } from 'react';

/** serverNow + 往復時間の半分 − 受信時刻。端末の時計との差を返す */
export function clockOffsetMs(
  serverNowIso: string,
  sentAtMs: number,
  receivedAtMs: number,
): number {
  return (
    Date.parse(serverNowIso) + (receivedAtMs - sentAtMs) / 2 - receivedAtMs
  );
}

/**
 * 補正済みの現在時刻を、補正済み時刻の秒の境目に合わせて更新する。
 * 端末ごとの更新位相がずれると、同じ秒数で切り替わる表示が最大1秒ずれるため。
 * offsetMs が null の間(マウント前)は initialIso を返し、hydration の不一致を避ける。
 */
export function useCorrectedNow(
  offsetMs: number | null,
  initialIso: string,
): Date {
  const [now, setNow] = useState(() => new Date(initialIso));
  useEffect(() => {
    if (offsetMs === null) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const corrected = Date.now() + offsetMs;
      setNow(new Date(corrected));
      timer = setTimeout(tick, 1000 - (corrected % 1000));
    };
    tick();
    return () => clearTimeout(timer);
  }, [offsetMs]);
  return now;
}
