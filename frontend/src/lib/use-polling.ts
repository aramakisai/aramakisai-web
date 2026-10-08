import { useEffect, useRef, useState } from 'react';

interface PollingOptions<T> {
  readonly fetcher: () => Promise<T>;
  readonly intervalMs: number;
  /** サーバー取得に失敗した場合は null */
  readonly initial: T | null;
  /** 偽を返した取得結果で再取得を止める */
  readonly shouldContinue?: (data: T) => boolean;
  /** 真ならマウント直後にも1回取得する。初期値があっても最初の取得を intervalMs 待たない */
  readonly immediate?: boolean;
}

interface PollingState<T> {
  readonly data: T | null;
  readonly error: boolean;
}

const always = () => true;

export function usePolling<T>({
  fetcher,
  intervalMs,
  initial,
  shouldContinue = always,
  immediate = false,
}: PollingOptions<T>): PollingState<T> {
  const [state, setState] = useState<PollingState<T>>({
    data: initial,
    error: false,
  });
  // 描画ごとの関数同一性でタイマーを張り直さないため ref 経由で参照する
  const fetcherRef = useRef(fetcher);
  const continueRef = useRef(shouldContinue);
  const initialRef = useRef(initial);
  useEffect(() => {
    fetcherRef.current = fetcher;
    continueRef.current = shouldContinue;
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let generation = 0;
    let stopped = false;

    const schedule = () => {
      timer = setTimeout(run, intervalMs);
    };

    async function run() {
      clearTimeout(timer);
      if (stopped || document.visibilityState === 'hidden') return;
      const mine = ++generation;
      try {
        const data = await fetcherRef.current();
        if (mine !== generation) return;
        setState({ data, error: false });
        if (!continueRef.current(data)) {
          stopped = true;
          return;
        }
      } catch {
        if (mine !== generation) return;
        setState((s) => ({ data: s.data, error: true }));
      }
      schedule();
    }

    const onVisibility = () => {
      if (stopped) return;
      if (document.visibilityState === 'hidden') {
        // 世代を進めて飛行中の応答を捨て、再予約も防ぐ
        generation++;
        clearTimeout(timer);
      } else {
        void run();
      }
    };

    // 初回データが既に停止条件を満たすなら、一度も再取得しない
    if (
      initialRef.current !== null &&
      !continueRef.current(initialRef.current)
    ) {
      return;
    }
    document.addEventListener('visibilitychange', onVisibility);
    if (immediate) void run();
    else schedule();
    return () => {
      stopped = true;
      generation++;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intervalMs, immediate]);

  return state;
}
