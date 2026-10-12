# Research & Design Decisions

## Summary
- **Feature**: `exhibition-qr-stamp-rally`
- **Discovery Scope**: Extension(既存の企画詳細ページ・ナビゲーション・GA4読み込みへの追加。サーバー側の秘密値を新たに持つ点だけはセキュリティ上の検討を伴う)
- **Key Findings**:
  - 企画詳細ページはISR(`generateStaticParams`が空、`revalidate`はlayoutの60秒が実効)で、検索パラメータを読まない。ページ本体で検証値を扱うと動的化してISRから外れるため、検証は専用のRoute Handlerに分ける
  - フロントのWorkersには実行時のサーバー側シークレットがまだ1つも無い。Workers secretは`wrangler secret put`で一度登録すればデプロイをまたいで保持され、実行時は`getCloudflareContext().env`で読める(`lib/cms.ts`が同関数を使用済み)
  - 匿名のREST読み取りは`student_exhibitions`を`status=published`に絞る(`cms/src/access/policy.ts`)。下書きを含めて出力するQRスクリプトは認証付きでCMSを読む必要がある

## Research Log

### ISRと検証値の受け渡し
- **Context**: QR用URLは既存の`/exhibitions/[id]/[category]`に検証値を付けたものとする合意がある
- **Findings**:
  - ページは`params`だけを使い`searchParams`を読まないため、OpenNextのキャッシュは検索パラメータに依存しない。ページ本体で検証すると`searchParams`参照で動的レンダリングになる
  - URLフラグメント(`#`以降)はサーバーへ送られず、GA4の`page_location`にも含まれない。キャッシュキー・アクセスログ・GA4のいずれにも検証値が残らない
- **Implications**: 検証値はフラグメントで渡し、クライアントが読み取って検証用Route Handlerへ送る。ページのISRは現状のまま

### WebCryptoによる署名
- **Sources**: MDN SubtleCrypto(`importKey`/`sign`/`verify`のHMAC)、Cloudflare Workers Web Crypto
- **Findings**: Workers・Node 22とも`globalThis.crypto.subtle`でHMAC-SHA256を扱える。`crypto.subtle.verify`は定数時間比較を内部で行う
- **Implications**: 署名・検証の共通モジュールを1つ置き、Route Handler(Workers)とQR出力スクリプト(Node/tsx)の両方から使う。Node専用APIは使わない

### Workersへのシークレット受け渡し
- **Findings**:
  - 既存のデプロイ手順は`infisical run --env=<env> -- <wrangler/opennext>`でビルドとアップロードを行う。サーバー側の実行時変数は未使用
  - `wrangler`4.105.0の`versions upload`はアップロード時に直前のバージョンのsecretを常に引き継ぐ(`keepSecrets: true`)。PRプレビューは`frontend/wrangler.toml`の既定のWorker`aramakisai-web`(本番)へ`versions upload`するため、本番のsecretがそのまま使われる
  - devは`[env.dev]`の別Worker`aramakisai-web-dev`で、secretは共有されない
  - `wrangler secret put`は最新バージョンが未デプロイのとき失敗する(未デプロイ版の巻き込みデプロイ防止)。PRプレビューのアップロード後は、mainへのデプロイ後に登録し直す必要がある
- **Implications**: Infisical`prod`を正本とし、本番Workerへ`wrangler secret put`で一度だけ登録する。CI・デプロイ手順は変えない。検証APIは実行時に読み、未設定なら検証できない扱い(`valid: false`)にする

### QR出力に使うライブラリ
- **Findings**: `frontend/`・`cms/`とも依存にQR生成ライブラリは無い(`node_modules`に該当なし)。`frontend/public/images/qr-aramakisai.svg`はsegno(Python)の出力で、リポジトリの依存ではない
- **Implications**: `frontend`のdevDependenciesに`qrcode`と`@types/qrcode`を追加する。SVG文字列を直接出力でき(`toString(text, { type: 'svg' })`)、追加の画像処理依存は要らない。実行時バンドルには入らない

### 下書きを含む企画の取得
- **Findings**: 匿名RESTは公開中のみ。APIキー(`useAPIKey`)は`users`で無効。本番DBへの直接接続はローカルから想定されていない(Infisicalのprodに`DATABASE_URL`が無い)。実行委員はAuthentik経由でCMS管理画面にログインでき、Payloadのセッションは`Authorization: JWT <token>`でもRESTに通る
- **Implications**: スクリプトは実行委員のセッショントークンを環境変数で受け取りRESTを読む。CMSのスキーマ変更(APIキー有効化)は不要

### エリア
- **Findings**: `stage`以外のカテゴリは各カテゴリグループの`area_id`(`map_areas`への参照)を持つ。`getExhibitionCatalog()`のカード(`ExhibitionCardSummary`)は`stage`以外で`areaIds`に直接エリアを0件か1件持ち、`areas`は`map_areas`を`sort`順で返す
- **Implications**: エリア別取得率は既存の`getExhibitionCatalog()`の結果だけで算出できる。CMSの追加取得は要らない

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations |
|--------|-------------|-----------|---------------------|
| ページ本体で検証(searchParams) | Server Componentで検証して記録指示を渡す | 往復が1回 | ページがISRから外れ全アクセスがCMS取得を伴う |
| クライアントで検証 | 秘密値をクライアントに置く | サーバー不要 | 秘密値が漏れ、検証値を誰でも作れる。不可 |
| Route Handlerで検証(採用) | フラグメントの検証値をPOSTで検証 | ISR維持、秘密値はWorkersのみ | 検証の往復が1回増える |
| DBに検証値を保存 | 組ごとの乱数をCMSに保存 | 組ごとに失効できる | CMSスキーマ変更が要る。合意済みの第一候補ではない |

## Design Decisions

### Decision: 検証値の形式と受け渡し
- **Selected Approach**: `HMAC-SHA256(secret, "<id>:<category>")`の32バイトをbase64url(43文字)にし、URLフラグメント`#s=<値>`で渡す
- **Rationale**: 長く複雑で組ごとに異なる。サーバー・GA4・キャッシュキーに残らない。切り詰めないことで`crypto.subtle.verify`をそのまま使える
- **Trade-offs**: QRのバージョンが上がる(URL全体で約100文字)が印刷用途で問題にならない大きさ

### Decision: 端末内保存の形式
- **Selected Approach**: キー`aramakisai_mypage`に`{ version: 1, lists: { stamps: [...] } }`を保存する。リスト名を増やせば将来のブックマーク等を足せる
- **Rationale**: 既存の`aramakisai_motion`と同じ接頭辞。リストの追加は型の追加だけで済む

### Decision: QR出力のCMS取得方法
- **Selected Approach**: 実行委員のセッショントークン(`CMS_AUTH_TOKEN`)をシェルの環境変数で渡し、RESTを`Authorization: JWT`で読む
- **Alternatives**: `users`の`useAPIKey`有効化(スキーマ変更とマイグレーションが要る)、本番DBへの接続(ローカルからの経路が無い)
- **Trade-offs**: トークンの取り出しが手作業になる。年数回の実行のため許容する

## Risks & Mitigations
- 秘密値の変更で配布済みQRが全て無効になる — 開催期間中は変更しない運用上の制約をdesignに明記
- QRの画像や検証値付きURLの共有による取得 — 要件の対象外。表示後にフラグメントを消し、URLの共有で検証値が広がりにくくする

## References
- [MDN SubtleCrypto.sign](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/sign) — HMAC署名
- [Cloudflare Workers Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/) — Workersでの対応
- [node-qrcode](https://github.com/soldair/node-qrcode) — SVG出力
- `wrangler`4.105.0の`versions upload`(secretの引き継ぎ)・`secret put`(未デプロイ版がある場合の失敗)
