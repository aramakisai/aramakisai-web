# Research & Design Decisions Template

## Summary
- **Feature**: `home-page-expansion`
- **Discovery Scope**: Extension (既存 `page-home-friendly-editing` 実装済みシステムへの拡張)
- **Key Findings**:
  - `topics.image`/`topics.attachment` は既に単一 `file-image`/`file` (M2O to `directus_files`) として存在し、additive-only ルール上どちらも削除・型変更不可。複数添付は別名の新規 alias フィールド (M2M) を追加する形でしか実現できない。
  - `announcements` には添付フィールドが1つも存在しない (`id`/`title`/`body`/`published_at` のみ)。新規追加のみで済むため `topics` より制約が少ない。
  - Directus の "Many Files" フィールドは M2M ジャンクションコレクション (`<collection>_files` 相当) を介して `directus_files` と結び付く。ジャンクション行は `id`/`<parent>_id`/`directus_files_id`/`sort` を持つのが標準形。
  - 既存の RBAC migration (`20260701C-rbac-roles.js`, `20260712A-rbac-page-home-live.js`) は新規 collection 追加時に `directus_permissions` へ executive CRUD + Public READ を明示的に insert するパターンを既に確立している。新規ジャンクションコレクション2つも同じパターンを踏襲する。
  - `frontend/package.json` にアイコンライブラリ (lucide-react 等) は未導入。footer の SNS アイコンは新規依存追加より、既存 `sanitize-html` 以外は依存追加を避けてきた方針に合わせ、インライン SVG の小さな自作アイコンセットで対応する。
  - 参考サイト `aramakisai.com/2025/about` は住所・テーマ画像・主要イベント・公式キャラクター等、現行 `festival_meta` スキーマに存在しないフィールドも含む。本specは既存スキーマ+ヒーロー画像+概要WYSIWYGの範囲に限定し、それ以外は Out of scope とする。

## Research Log

### Directus M2M "Many Files" フィールドの構成
- **Context**: Requirement 5/6 (`topics`/`announcements` 添付複数化) の実現方式を確認する必要があった。
- **Sources Consulted**: [Directus Docs – Schema](https://directus.com/docs/api/schema), [Directus Docs – Fields](https://directus.io/docs/guides/data-model/fields), [GitHub Discussion #16114 "Multiple Files Interface"](https://github.com/directus/directus/discussions/16114), [GitHub Discussion #15647 "Files relational field"](https://github.com/directus/directus/discussions/15647)
- **Findings**:
  - Many Files フィールドは自動的に M2M ジャンクションコレクションを生成し、`directus_files` との関係を管理する。
  - REST/SDK でのネストしたフィールド取得は `<field>.directus_files_id.*` の形式になる (例: `attachments.directus_files_id.filename_download`)。
  - ジャンクションコレクションの正確な `meta`/`special` の内部表現は Directus バージョンや生成経路によって細部が変わりうるため、本 design では概念上のリレーションモデル (M2M ジャンクション + `sort` フィールド) のみを規定し、正確な yaml メタ値は実装時に Directus 管理画面で1度フィールドを作成 → `directus schema snapshot` で書き出す方式で確定させることを推奨する (手書きで yaml の relations/`special` を捏造しない)。
- **Implications**: design.md の Data Models では「M2M ジャンクションコレクション」という設計判断とジャンクション行のフィールド一覧までを規定し、Directus 内部専用メタの厳密な値は Task Briefs 側で「管理画面で作成→snapshot」の手順として書く。

### 既存 RBAC migration パターンの踏襲可否
- **Context**: 新規ジャンクションコレクションに対する Public 読み取り・executive CRUD をどう付与するか。
- **Sources Consulted**: `directus/migrations/20260701C-rbac-roles.js`, `directus/migrations/20260712A-rbac-page-home-live.js` (リポジトリ内)
- **Findings**:
  - 新規 collection 追加時は、`directus_permissions` に対し (1) delete-then-insert で冪等性を確保, (2) executive に対する4アクション(`create`/`read`/`update`/`delete`, `fields: "*"`), (3) Public policy (`abf8a154-...`) に対する `read`, `fields: "*"` を insert する、という3ステップの型が既に確立されている。
  - `student_exhibitor` ロールは `topics`/`announcements` の編集主体ではないため、既存2migrationとも `student_exhibitor` への付与対象に含めていない。
- **Implications**: 新規 migration (`topics_files`/`announcements_files` 用) はこの型をそのまま複製し、student_exhibitor への付与は行わない。

### `directus_files` 自体への Public 読み取り権限の扱い
- **Context**: 新規ジャンクション経由で公開される添付ファイルの実体 (`directus_files`) に Public ロールがアクセスできるか要確認。
- **Sources Consulted**: `directus/migrations/*.js` 全文 grep (`directus_files` 文字列は0件)
- **Findings**: 既存の `hero_image`/`parking_map`/`topics.image` 等、単一ファイル関連フィールドも `directus_files` 自体への明示的な Public read permission migration は存在しないが、本番で正常に画像配信できている (steering の運用実績より)。これは Directus の `/assets/:id` エンドポイントが `directus_files` collection の read 権限とは別処理をしているか、Public policy への `directus_files` 権限が過去に管理画面から直接設定され migration 化されていない可能性のいずれかを示す。
- **Implications**: 本 spec は既存の動作パターンを踏襲し、新規ジャンクションコレクション自体への Public read 権限のみ明示的に付与する (`directus_files` への追加権限は行わない)。もし staging 検証で添付ファイルの実体取得が403になる場合は、既存の単一ファイルフィールドと同じ土俵の問題であるため、本 spec 側の設計判断は変えず Risks に記録し実装時に staging で確認する。

### SNS アイコン表示の依存関係
- **Context**: Requirement 12 (Footer への SNS アイコンリンク) の実現方法。
- **Sources Consulted**: `frontend/package.json` (リポジトリ内)
- **Findings**: アイコンライブラリは未導入。プロジェクトはここまで一貫して依存追加を最小限 (`sanitize-html` のみ) に抑えてきた。
- **Implications**: 新規ライブラリを追加せず、既知プラットフォーム (X/Instagram/Facebook/YouTube/TikTok/LINE) 用の小さなインライン SVG アイコンセットを `frontend/src/components/` 内に自作する。未知プラットフォームは汎用リンクアイコン+テキストラベルで対応する (Requirement 12.3)。

### 参考サイト (aramakisai.com/2025/about) の情報構成
- **Context**: Requirement 14 (About ページ) のセクション構成を検討するにあたり、既存の荒牧祭公式サイト過去年度版のAboutページ構成を参照した (ユーザー指定URL)。
- **Sources Consulted**: `https://aramakisai.com/2025/about` (WebFetchによる取得)
- **Findings**:
  - ヒーロー画像は無く、テーマビジュアル画像が後半に配置されている
  - 開催日程・会場・内容・問い合わせが表形式で整理されている
  - 祭の概要説明が段落形式で先頭に配置されている
  - 住所 (アクセス情報)・テーマ画像・主要イベント一覧・公式キャラクターは現行 `festival_meta` スキーマに存在しないフィールド
- **Implications**: 本specのAboutページは (1) ヒーロー画像 (新規追加, 参考サイトには無いが本要求で明示指定), (2) 開催日程・入場料・支払い注記の整理表示, (3) 概要WYSIWYGの3要素に限定して構成する。住所・テーマ・キャラクター相当は別spec (スキーマ拡張含む) に委ねる。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| M2M junction (採用) | `topics`/`announcements` それぞれに `<collection>_files` ジャンクションコレクションを新設し、alias フィールド経由で複数ファイルを関連付け | additive (既存フィールド無傷)、Directus標準機能、`sort`で表示順制御可能 | ジャンクションコレクション用RBAC migrationが別途必要 | 既存 `page_home_live` 追加時と同型のRBACパターンを再利用できる |
| JSON配列フィールド (`input-code`でファイルID配列を手打ち) | 新規 `text`/`json` 型フィールドにファイルUUID配列を保持 | スキーマ変更が単純 (relationsテーブル変更不要) | Directus管理画面でファイルピッカーUIが使えず非エンジニアの実行委員が運用不能、ファイル削除時の整合性がDB制約で保証されない | Requirement 4 (非エンジニアでも安全に編集) の目的に反するため却下 |

## Design Decisions

### Decision: 添付ファイルの複数化は新規 M2M フィールドの追加とし、既存単一ファイルフィールドは維持する
- **Context**: additive-only ルールにより `topics.image`/`topics.attachment` の削除・型変更は禁止されている。
- **Alternatives Considered**:
  1. 既存 `image`/`attachment` フィールドを流用し型変更 — additive-onlyルール違反のため却下
  2. 新規 M2M フィールド (`attachments`) を追加し、旧フィールドは非推奨として残す (フロントは新フィールドのみ参照)
- **Selected Approach**: 2を採用。`topics`/`announcements` それぞれに `attachments` (M2M, 複数ファイル) を新設。フロントエンドは新フィールドのみを参照し、旧 `topics.image`/`topics.attachment` はサムネイル未登録時のフォールバック判定 (Requirement 2.5 の「旧imageフィールド」) にのみ使う。
- **Rationale**: 本番DBへの破壊的変更を避けつつ、実行委員には新フィールドへの移行を促す運用上の猶予を残せる。
- **Trade-offs**: `topics` collection に一時的に画像参照が2箇所 (`image` 単数 + `attachments` 複数) 存在する重複期間が生じる。将来的な `image`/`attachment` 廃止は別specの範囲とする。
- **Follow-up**: 実行委員向け運用ドキュメント (Directus管理画面での添付移行手順) が必要か、実装フェーズでチームに確認する。

### Decision: Footer の SNS リンクは Footer コンポーネント自身が非同期でデータ取得する
- **Context**: `festival_meta.sns_links` は現状 Home Page (`page.tsx`) 経由でのみ取得されているが、Footer は `layout.tsx` から全ページ共通で描画される。
- **Alternatives Considered**:
  1. `RootLayout` を async component化し、`getSnsLinks()` の結果を `Footer` に props として渡す
  2. `Footer` 自体を async Server Component にし、内部で `getSnsLinks()` を呼ぶ
- **Selected Approach**: 2を採用。
- **Rationale**: Next.js App Router では async Server Component は同期コンポーネントの子としてそのままレンダリング可能であり、`RootLayout` の型・既存の `metadata` 定義に影響を与えずに済む。将来的に他のレイアウト共通要素 (Header等) が同様のデータを必要とする場合も、各コンポーネントが自身の関心事のデータ取得を担う一貫した方針になる。
- **Trade-offs**: Footer が Directus 依存を持つため、既存の「表示コンポーネントは data 層から独立する」という `page-home-friendly-editing` spec のpresentation境界とは異なる例外になる。ただしFooterはサイト全体の共通コンポーネントであり、`HomePageService` (Home Page専用データ集約層) のスコープには含めない判断とする。
- **Follow-up**: Directus 到達不能時、Footer の try/catch がページ全体のレンダリングを妨げないことをテストで担保する。

## Risks & Mitigations
- ジャンクションコレクションの正確な Directus メタ (`special`/`interface` 内部値) を手書きの yaml で誤ると schema apply が失敗、または Admin UI で正しく編集できない — Directus 管理画面で1度作成 → `schema snapshot` で書き出す手順を Task Briefs に明記して軽減
- `directus_files` 自体への Public read permission が実は必要だった場合、新規添付ファイルが403になる可能性 — staging (`stg-api.aramakisai.com`) での事前検証で実ファイル取得を確認するタスクを設ける
- `AnnouncementsList`/`TopicsList` の既存コンポーネント・テストへの変更が大きく、後方互換を壊すリスク — 既存テストの更新を実装タスクに明示的に含める
- 新規ジャンクションコレクションを student_exhibitor に開放しない判断が将来の要件変化で見直しになる可能性 — Revalidation Triggers に記録

## References
- [Directus Docs – Schema](https://directus.com/docs/api/schema) — スキーマ管理の基本構造
- [Directus Docs – Fields](https://directus.io/docs/guides/data-model/fields) — フィールドインターフェース一覧
- [GitHub Discussion #16114 "Multiple Files Interface"](https://github.com/directus/directus/discussions/16114) — Many Filesフィールドのジャンクション挙動
- [GitHub Discussion #15647 "Files relational field"](https://github.com/directus/directus/discussions/15647) — M2Mジャンクションの内部構造に関する議論
