# Research & Design Decisions

---
**Purpose**: Capture discovery findings, architectural investigations, and rationale that inform the technical design.
---

## Summary
- **Feature**: `frontend-scaffold`
- **Discovery Scope**: New Feature (greenfield)
- **Key Findings**:
  - `@cloudflare/next-on-pages` は 2025年9月に非推奨化された。現在の推奨は `@opennextjs/cloudflare`。
  - OpenNext Cloudflare アダプターは Edge Runtime ではなく Node.js Workers Runtime を使用する。`export const runtime = 'edge'` 不要。
  - `@directus/sdk` v21.x は Fetch API ベースでありあらゆるランタイムに対応。Edge Runtime 制約なし。

## Research Log

### @cloudflare/next-on-pages の非推奨化

- **Context**: 要件 3.1 が `@cloudflare/next-on-pages` の使用を前提としていたため調査。
- **Sources Consulted**:
  - https://www.npmjs.com/package/@cloudflare/next-on-pages (最終版: 1.13.16, 2025年9月公開)
  - https://opennext.js.org/cloudflare
- **Findings**:
  - `@cloudflare/next-on-pages` は deprecated。npm ページにも移行先として OpenNext が明記されている。
  - `@opennextjs/cloudflare` が公式推奨の後継パッケージ。
  - OpenNext は Next.js 15 および 16 の最新マイナーをサポート。Next.js 14 サポートは 2026年 Q1 終了（現在 2026年6月）。
- **Implications**:
  - パッケージを `@opennextjs/cloudflare` に変更する必要がある。
  - ビルドコマンド、設定ファイル構造が変わる。

### OpenNext Cloudflare のランタイムモデル

- **Context**: Edge Runtime 制約 (要件 3.4) が OpenNext でどう変わるかを調査。
- **Sources Consulted**:
  - https://opennext.js.org/cloudflare/get-started
- **Findings**:
  - OpenNext は Node.js Workers Runtime を使用（Edge Runtime ではない）。
  - `nodejs_compat` compatibility flag で Node.js API が利用可能。
  - `export const runtime = 'edge'` は不要かつ非推奨（OpenNext のドキュメントでも削除を指示）。
  - ビルド成果物は `.open-next/` ディレクトリに出力される。
  - 設定ファイルとして `open-next.config.ts` が必要。
  - `wrangler.toml` の構造が変わる: `main = ".open-next/worker.js"`, `assets.directory = ".open-next/assets"`。
- **Implications**:
  - 要件 3.4「Edge Runtime を明示」は廃止。代わりに「ランタイムディレクティブを省略する」に変換する。
  - `wrangler.toml` の内容を OpenNext 仕様に更新する。

### @directus/sdk の Edge 互換性

- **Context**: 要件 5.5「Edge Runtime と互換」の検証。
- **Sources Consulted**:
  - https://www.npmjs.com/package/@directus/sdk (最新版: 21.3.0, 2026年4月公開)
  - https://directus.io/docs/guides/connect/sdk
- **Findings**:
  - SDK は Fetch API ベース。Node.js, ブラウザ, Edge いずれでも動作。
  - OpenNext の Node.js Workers Runtime でも問題なく動作する。
  - 初期化: `createDirectus(url).with(rest())` の合成パターン。
- **Implications**:
  - SDK の選定はそのまま維持。追加の設定なし。

### 環境変数バリデーション手法

- **Context**: 要件 6.1「起動時に必須変数を検証」の実装方針調査。
- **Sources Consulted**:
  - https://env.t3.gg/docs/nextjs
  - https://github.com/t3-oss/t3-env
- **Findings**:
  - `@t3-oss/env-nextjs` + `zod` が Next.js での標準パターン。
  - `NEXT_PUBLIC_*` のバンドリング問題（Edge/Client でのツリーシェイク）に対応済み。
  - ビルド時・起動時の両方で検証が走る。
  - ビルド時に `NEXT_PUBLIC_*` を手動分割代入する必要がある（バンドラーの制約）。
- **Implications**:
  - `src/env.ts` を `@t3-oss/env-nextjs` で実装する。
  - `zod` を devDependency に追加する。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| @opennextjs/cloudflare (選択) | OpenNext による CF Workers デプロイ | 公式推奨、Next.js 15/16 対応、Node.js API 使用可能 | @cloudflare/next-on-pages より設定ファイルが増える | Cloudflare 公式推奨 |
| @cloudflare/next-on-pages (却下) | Edge Runtime ベースの CF Pages デプロイ | 旧来の設定が流用可能 | Deprecated (2025/9)、Next.js 15 未サポート | 使用不可 |

## Design Decisions

### Decision: `@opennextjs/cloudflare` への切り替え

- **Context**: `@cloudflare/next-on-pages` が非推奨化され、Next.js 15 に未対応。
- **Alternatives Considered**:
  1. `@cloudflare/next-on-pages` — 旧来の Edge Runtime モデル、deprecated
  2. `@opennextjs/cloudflare` — 新しい Node.js Workers モデル、公式推奨
- **Selected Approach**: `@opennextjs/cloudflare` を採用。
- **Rationale**: Cloudflare 公式が推奨し、Next.js 15/16 に対応する唯一のサポート対象パッケージ。
- **Trade-offs**: 設定ファイルが増える（`open-next.config.ts` 追加）。Edge Runtime から Node.js Workers Runtime へのモデル変更。
- **Follow-up**: `wrangler.toml` の `main`/`assets` フィールドが OpenNext 出力パスに合っているか CI で確認。

### Decision: ランタイムディレクティブ省略

- **Context**: 要件 3.4 は `export const runtime = 'edge'` または省略と定義。OpenNext ではどちらか。
- **Alternatives Considered**:
  1. `export const runtime = 'edge'` — 旧 next-on-pages の方針
  2. ディレクティブ省略 — OpenNext の推奨
- **Selected Approach**: すべてのルートでランタイムディレクティブを省略する。
- **Rationale**: OpenNext は明示的なディレクティブを必要とせず、むしろ `edge` を指定すると誤動作する可能性がある。
- **Trade-offs**: 要件 3.4 の文言と一部乖離するが、意図（Cloudflare Pages へのデプロイ）は達成される。
- **Follow-up**: 要件 3.4 の表現を次回の要件改訂で更新することを推奨。

### Decision: `@t3-oss/env-nextjs` + zod で環境変数バリデーション

- **Context**: 要件 6.1 の「起動時バリデーション」の実装方法。
- **Alternatives Considered**:
  1. 手書きバリデーション関数 — シンプルだが NEXT_PUBLIC_ バンドリング問題を手動処理する必要あり
  2. `@t3-oss/env-nextjs` + zod — ライブラリが NEXT_PUBLIC_ 問題を解決済み
- **Selected Approach**: `@t3-oss/env-nextjs` + zod。
- **Rationale**: バンドリング問題を自前で解決するより、実績あるライブラリに委ねる方がメンテナブル。
- **Trade-offs**: 依存パッケージが増える（zod, @t3-oss/env-nextjs）。
- **Follow-up**: zod と @t3-oss/env-nextjs のバージョン固定。

## Risks & Mitigations

- **OpenNext の設定変更追跡** — `@opennextjs/cloudflare` は活発に開発中。`open-next.config.ts` のスキーマが変わる可能性。→ バージョンを `package.json` で固定し、major 更新時に設定を見直す。
- **wrangler.toml vs wrangler.jsonc** — OpenNext 公式ドキュメントは `wrangler.jsonc` を示しているが、TOML 形式も動作する。要件では `.toml` を指定しているため `.toml` を採用する。
- **Next.js 14 サポート終了** — OpenNext は Next.js 14 サポートを 2026 Q1 に終了。Next.js 15 以上を使用すること。

## References

- [@opennextjs/cloudflare Get Started](https://opennext.js.org/cloudflare/get-started) — 公式セットアップガイド
- [@cloudflare/next-on-pages npm](https://www.npmjs.com/package/@cloudflare/next-on-pages) — 非推奨通知確認
- [@directus/sdk npm](https://www.npmjs.com/package/@directus/sdk) — バージョン 21.x, Edge 互換確認
- [T3 Env Next.js docs](https://env.t3.gg/docs/nextjs) — 環境変数バリデーションパターン
