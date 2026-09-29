import { useEffect, useState } from 'react';

/**
 * 初回描画はサーバー描画時刻 (initialIso) を使い、hydration の不一致を避ける。
 * マウント直後に端末の現在時刻へ切り替え、以後 intervalMs ごとに更新する。
 */
export function useNow(initialIso: string, intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date(initialIso));
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
