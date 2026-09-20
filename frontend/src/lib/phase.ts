// Edge Runtime (middleware) から import されるため、外部 I/O・Node.js 専用 API・
// React への依存を一切持たない。

export type FestivalPhase = 'pre_event' | 'live';

export type PhaseSource = 'constant' | 'override';

export interface ResolvedPhase {
  readonly phase: FestivalPhase;
  readonly source: PhaseSource;
}

/**
 * 現在のフェーズ。切替はこの定数の変更と再デプロイによってのみ行う。
 */
export const BUILD_PHASE: FestivalPhase = 'pre_event';

/** フェーズオーバーライド Cookie の名称。 */
export const PHASE_OVERRIDE_COOKIE = 'aramakisai_phase_override';

// env.ts (`@t3-oss/env-nextjs`) 経由にすると proxy 越しのランタイム参照になり
// バンドラの定数畳み込みが効かず、本番成果物から開発用コードを除去できない。
// この理由により process.env を直接参照する。規約からの逸脱はこの 1 箇所に閉じる。
export const DEV_OVERRIDE_ENABLED =
  process.env.NEXT_PUBLIC_ENABLE_PHASE_OVERRIDE === 'true' ||
  process.env.NODE_ENV === 'development';

/** 開催前フェーズで公開する、値まで確定したパスの一覧 (完全一致で判定する)。 */
export const PRE_EVENT_PUBLIC_PATHS: readonly string[] = [
  '/',
  '/announcements',
  '/access',
  '/privacy',
];

// お知らせ詳細はルート単位で許可する。id ごとの公開判定は既存の publishedFilter()
// (announcements.ts) が担うため、ここでは前方一致で表現する。
// slug で解決される固定ページ (pages コレクション) はルート単位で許可すると
// 全 slug が公開されてしまうため、上の完全一致一覧にのみ載せる非対称を採る。
/** 開催前フェーズでルート単位に公開するパスの前置詞の一覧 (前方一致で判定する)。 */
export const PRE_EVENT_PUBLIC_PREFIXES: readonly string[] = [
  '/announcements/',
];

/** 指定フェーズにおいて pathname が公開対象かどうかを判定する。 */
export function isPublicPath(
  pathname: string,
  phase: FestivalPhase,
): boolean {
  if (phase === 'live') return true;
  return (
    PRE_EVENT_PUBLIC_PATHS.includes(pathname) ||
    PRE_EVENT_PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}
