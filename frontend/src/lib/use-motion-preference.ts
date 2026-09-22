'use client';

import { useCallback, useEffect, useState } from 'react';

/** ちらつき回避のインラインスクリプト (`app/layout.tsx`) と同じキー・値を使う。 */
export const MOTION_STORAGE_KEY = 'aramakisai_motion';
const REDUCE = 'reduce';
const NO_PREFERENCE = 'no-preference';
const ROOT_ATTRIBUTE = 'data-motion';

/**
 * Safari のプライベートブラウズ等でストレージがブロックされていると
 * getItem/setItem が SecurityError を投げる (layout.tsx のインラインスクリプトは
 * try/catch 済み)。読み込み失敗は「保存済みの選択なし」として OS 設定に委ねる。
 */
function readStoredReduced(): boolean | null {
  try {
    const stored = window.localStorage.getItem(MOTION_STORAGE_KEY);
    if (stored === REDUCE) return true;
    if (stored === NO_PREFERENCE) return false;
    return null;
  } catch {
    return null;
  }
}

function writeStoredReduced(reduced: boolean): void {
  try {
    window.localStorage.setItem(
      MOTION_STORAGE_KEY,
      reduced ? REDUCE : NO_PREFERENCE,
    );
  } catch {
    // 保存できなくても切り替え自体はメモリ上の状態だけで継続する
  }
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function applyRootAttribute(reduced: boolean): void {
  if (reduced) {
    document.documentElement.setAttribute(ROOT_ATTRIBUTE, REDUCE);
  } else {
    document.documentElement.removeAttribute(ROOT_ATTRIBUTE);
  }
}

/**
 * OS 設定と切替のどちらか一方でも停止を求めていれば停止する (要件 21.4,
 * design.md「いずれか一方でも停止を求めていれば停止」)。切替側の
 * 「無効化 (no-preference)」は OS の reduce 指定を上書きしない。
 */
function resolveReduced(): boolean {
  return prefersReducedMotion() || readStoredReduced() === true;
}

export interface MotionPreference {
  /** true の間、自動再生される動きと遷移の演出を停止する (要件 21.4, 21.8)。 */
  reduced: boolean;
  toggle: () => void;
}

/**
 * サイト全体のモーション抑制の状態を持つ共有フック。setInterval や
 * requestAnimationFrame で動くモーションはここの reduced を読んで停止する
 * (CSS の motion-reduce variant では止められないため)。
 */
export function useMotionPreference(): MotionPreference {
  // SSR は window/localStorage/matchMedia に触れられないため常に false を返す。
  // ここで実際の値を計算して初期値にすると、hydration 時の初回レンダーが
  // SSR の出力 (常に false) と食い違い hydration mismatch になる。実際の値は
  // マウント後の effect でまとめて確定させ、同じタイミングで <html> の
  // data-motion 属性も更新する (state と属性の反映を別 effect に分けると、
  // この false の初期値でも一度属性反映が走り、インラインスクリプトが
  // 設定済みの属性を誤って消してしまう)。
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const initial = resolveReduced();
    setReduced(initial);
    applyRootAttribute(initial);

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    // OS 設定の変化のたびに resolveReduced() で保存値との OR を取り直すため、
    // 明示的に「停止」を保存している間は OS 側がどう変わっても true のまま残る。
    const handleChange = () => {
      const next = resolveReduced();
      setReduced(next);
      applyRootAttribute(next);
    };
    mql.addEventListener('change', handleChange);
    return () => mql.removeEventListener('change', handleChange);
  }, []);

  const toggle = useCallback(() => {
    // 保存の成否によらず (書き込み失敗時はメモリ上だけで) その場で反映するため、
    // 保存し直した値を読み返さず、いま望む値をそのまま次の状態に使う。OS が
    // reduce を要求している間は無効化 (no-preference) 側の希望より優先する。
    const wantReduced = !reduced;
    writeStoredReduced(wantReduced);
    const next = prefersReducedMotion() || wantReduced;
    setReduced(next);
    applyRootAttribute(next);
  }, [reduced]);

  return { reduced, toggle };
}
