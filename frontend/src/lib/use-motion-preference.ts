'use client';

import { useEffect, useSyncExternalStore } from 'react';

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

// MotionToggle (footer) と BackgroundShapes など、別々のコンポーネント
// インスタンスが同じ reduced を参照する。コンポーネントローカルの useState では
// 各インスタンスが独立した値を持ってしまいトグルの操作が他インスタンスへ
// 伝わらないため、モジュールレベルの単一の値と購読者集合で共有し、
// useSyncExternalStore で購読する。
let sharedReduced = false;
const listeners = new Set<() => void>();

function setSharedReduced(next: boolean): void {
  if (sharedReduced === next) return;
  sharedReduced = next;
  applyRootAttribute(next);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): boolean {
  return sharedReduced;
}

// SSR は window/localStorage/matchMedia に触れられないため常に false を返す。
// ここで実際の値を計算して初期値にすると、hydration 時の初回レンダーが
// SSR の出力 (常に false) と食い違い hydration mismatch になる。実際の値は
// マウント後の effect で確定させる。
function getServerSnapshot(): boolean {
  return false;
}

// 複数インスタンスが同時にマウントされても OS 設定の購読とちらつき回避の初期化は
// 1 回だけ行う (guard しないとコンポーネントの数だけ matchMedia の change
// リスナーが積み上がる)。
let initialized = false;
function ensureInitialized(): void {
  if (initialized) return;
  initialized = true;
  setSharedReduced(resolveReduced());

  const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  // OS 設定の変化のたびに resolveReduced() で保存値との OR を取り直すため、
  // 明示的に「停止」を保存している間は OS 側がどう変わっても true のまま残る。
  mql.addEventListener('change', () => setSharedReduced(resolveReduced()));
}

function toggleSharedReduced(): void {
  // 保存の成否によらず (書き込み失敗時はメモリ上だけで) その場で反映するため、
  // 保存し直した値を読み返さず、いま望む値をそのまま次の状態に使う。OS が
  // reduce を要求している間は無効化 (no-preference) 側の希望より優先する。
  const wantReduced = !sharedReduced;
  writeStoredReduced(wantReduced);
  setSharedReduced(prefersReducedMotion() || wantReduced);
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
  const reduced = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    ensureInitialized();
  }, []);

  return { reduced, toggle: toggleSharedReduced };
}
