# Research & Design Decisions

## Summary
- **Feature**: parking-availability
- **Discovery Scope**: Extension (既存の CMS コレクション追加と frontend の取得層・ページ追加)。軽量ディスカバリー
- **Key Findings**:
  - `canRead` / `canCreate` / `canUpdate` は未知のコレクションに対し「公開読み取り・実行委員のみ書き込み」になるため、`parking_lots` に policy の変更は不要
  - `frontend/src/lib/cms.ts` の Cache API TTL は定数 60 秒で、駐車場だけ 20 秒にするには TTL を呼び出し側から渡せるようにする必要がある
  - Workers の Free プランは 100,000 req/日で、超過すると Error 1027 でサイト全体が止まる。現在の契約は Free (ユーザー確認済み)

## Research Log

### Workers のリクエスト枠
- **Sources**: https://developers.cloudflare.com/workers/platform/limits/ , https://developers.cloudflare.com/workers/platform/pricing/
- Free: 100,000 req/日 (UTC 0 時リセット)。超過時は Error 1027 (fail open なら Worker をバイパス)。Paid: 10M req/月込み、超過 $0.30/百万。静的アセットは両プランで無制限・無料
- Free は CPU 10ms/req、サブリクエスト 50/req
- `frontend/wrangler.toml` と steering・infra docs にプラン記載なし。現在の契約は Free (ユーザー確認済み)
- 含意: `/api/parking` のポーリングは Worker 呼び出しとして数える。同時閲覧 N 件 × 3 回/分 × 60 = 180N req/時。N=500 で 90,000 req/時、Free では約 1 時間強で日次枠を使い切る。N=100 でも 18,000 req/時

### Cache API
- **Source**: https://developers.cloudflare.com/workers/runtime-apis/cache/
- 拠点内のみ保持、`cache.delete` も当該拠点のみ。`stale-while-revalidate` は非対応

### 現行コード
- `cms/src/access/policy.ts`: `PUBLISHED_FILTER` に無いコレクションは未認証でも全件読める。`canCreate/Update/Delete` は実行委員のみ true
- `cms/src/collections/index.ts`: `withAccess` で access を一括結線、`isHiddenInAdmin` により非実行委員には管理画面で非表示
- `frontend/src/middleware.ts`: matcher が `/api` も対象。`isPublicPath` が偽のとき `/gated` へ rewrite。`BUILD_PHASE` は `pre_event`
- `frontend/src/lib/use-now.ts`: クライアント側タイマーの既存パターン
- `cms/scripts/check-schema-changes.ts`: base/head の定義を比較。新規コレクションの追加は破壊的変更に該当しない
- マイグレーションは `pnpm migrate:create` → `index.ts` 登録 → `pnpm generate:types` (`docs/cms-operations.md` の手順 3〜4)

## Architecture Pattern Evaluation
| Option | 内容 | 評価 |
|--------|------|------|
| A. ページが CMS を直接ポーリング | CORS・キャッシュ制御が CMS 依存 | 不採用。要件 3.8 に反する |
| B. frontend の Route Handler 経由 | Workers 内で Cache API TTL 20 秒、JSON を返す | 採用 |
| C. SSR のみ (`force-dynamic`) で再読み込み | 自動更新なし | 要件 3.1 を満たさない |

## Design Decisions

### D-1 最終更新時刻は Payload 標準の `updatedAt` を使う
- 専用フィールドを持たない。実行委員が値を保存し直せば「確認時刻」が更新される運用になる
- リスク: 名称・表示順の編集でも時刻が更新される。マスタ編集は開催前に済ませる前提

### D-2 取得層の TTL を呼び出し側から指定可能にする
- `cms.ts` の `CACHE_TTL_SECONDS` を既定値として残し、`findMany` にオプションで TTL を渡せるようにする。他ページの挙動は変えない

### D-3 ポーリング用フックを機能非依存にする
- digital-signage が同じフックを別の URL で使えるようにする

## Risks & Mitigations
- 現在の契約は Free で、ポーリングでサイト全体が停止し得る → 開催月だけ Paid に切り替える (予算上限 $10)。無操作停止は digital-signage と衝突するため採らない
- 実行委員が更新を忘れる → 30 分超で「古い可能性」を表示 (要件 3.6)
- CMS 障害 → 直前の値と最終取得時刻を保持して再試行 (要件 3.5)
