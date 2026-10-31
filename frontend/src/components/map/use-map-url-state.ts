'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

// 企画一覧の絞り込み UI とデバウンス時間を揃える
const KEYWORD_DEBOUNCE_MS = 300;

export interface UseMapUrlStateOptions<S extends { readonly q: string }> {
  readonly empty: S;
  readonly parse: (params: URLSearchParams) => S;
  readonly build: (state: S) => string;
}

export function useMapUrlState<S extends { readonly q: string }>({
  empty,
  parse,
  build,
}: UseMapUrlStateOptions<S>) {
  // サーバー描画 (ISR のキャッシュ) は URL を知らないため空の条件で始まり、マウント時に URL から復元する
  const [filters, setFilters] = useState<S>(empty);
  const [keywordInput, setKeywordInput] = useState(empty.q);
  // 直近の確定状態を同期的に参照するための ref。setState は非同期で連続更新時に取りこぼすため使う
  const filtersRef = useRef<S>(empty);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const parseRef = useRef(parse);
  const buildRef = useRef(build);
  parseRef.current = parse;
  buildRef.current = build;

  // Next のルーターを経由すると Server Component の再レンダリング (CMS への再取得) が
  // 発生するため、履歴 API を直接使う
  const commit = useCallback((next: S) => {
    filtersRef.current = next;
    setFilters(next);
    window.history.pushState(next, '', buildRef.current(next));
  }, []);

  const readLocation = () =>
    parseRef.current(new URLSearchParams(window.location.search));

  // ハイドレーション直後の描画より前に反映し、空の条件が一瞬見えるのを最小にする
  useLayoutEffect(() => {
    const restored = readLocation();
    filtersRef.current = restored;
    setFilters(restored);
    setKeywordInput(restored.q);
  }, []);

  useEffect(() => {
    const handlePopState = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const next = readLocation();
      filtersRef.current = next;
      setFilters(next);
      setKeywordInput(next.q);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleSetKeywordInput = useCallback(
    (value: string) => {
      setKeywordInput(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        commit({ ...filtersRef.current, q: value.trim() });
      }, KEYWORD_DEBOUNCE_MS);
    },
    [commit],
  );

  const update = useCallback(
    (patch: Partial<S>) => commit({ ...filtersRef.current, ...patch }),
    [commit],
  );

  return {
    filters,
    keywordInput,
    setKeywordInput: handleSetKeywordInput,
    update,
  };
}
