# Gap Analysis: sitemap-schema-review

## 前提の注意

本 spec は既に `requirements.md`/`design.md`/`tasks.md` が承認・生成済みであり、通常の運用順序 (gap-analysis → design) とは逆に、tasks 生成後の実装着手前チェックとして本分析を実施する。したがって本ドキュメントは「設計方針の選択肢提示」ではなく、**既存 design.md/tasks.md の想定と実コードベースとの間に生じているズレの検出**を主目的とする。

対象は Requirement 5 (CI 一時停止)・Requirement 6 (既存フィールド簡素化)・Requirement 7 (page_home/page_home_live 統合) の実装タスクのみ。Requirement 1-4 は分析ドキュメント成果物として `design.md` の Data Models セクションで既に充足済みのため対象外。

## 1. 現状調査サマリ

### 既存資産
- `frontend/src/lib/home-page.ts`: `getHomePage()` が `festival_meta.home_active_variant` (`'pre_event' | 'live'`) を読み `page_home`/`page_home_live` のどちらかを分岐取得する唯一の実装箇所。`festival_meta.admission_fee`/`payment_note` もここで読み取り `FestivalOverview` に詰めている。
- `frontend/src/lib/festival-meta.ts`: `getFestivalMeta()` が `/about` ページ向けに `festival_meta.admission_fee`/`payment_note`/`name`/`event_days`/`overview`/`hero_image` を取得。
- `frontend/src/components/festival-overview.tsx` (+ `festival-overview.test.tsx`): `admissionFee`/`paymentNote` を分割代入して `/about` ページに直接レンダリングしている (`home-page-expansion` spec 成果物)。
- `frontend/src/lib/topics.ts` + `frontend/src/components/topic-card.tsx`: `topics.link_url` を `linkUrl` として取得し、トピックカードの `<a href>` に使用している (単なる未使用フィールドではなく実際に機能しているリンク)。
- `frontend/src/lib/home-page-types.ts`: `FestivalOverview`/`TopicSummary`/`HomePageContent`/`LiveHomeContent`/`HomeActiveVariant` 型が `page_home`/`page_home_live`/`festival_meta` の現行フィールド構成に密結合。
- `frontend/src/lib/directus-asset-url.ts`: `toAssetUrl()` は `${NEXT_PUBLIC_DIRECTUS_URL}/assets/${fileId}` を返すのみ (5行)。webp 変換パラメータは未実装、クエリパラメータ付与の前例なし。
- `directus/migrations/`: `20260712A-rbac-page-home-live.js` が `page_home_live` への CRUD 権限付与を行う唯一の migration。命名規則は `YYYYMMDD{A,B,C...}-説明.js` の連番、直近は `20260713E` まで進んでいる。
- `directus/schema/snapshot.yaml`: 全 field で `meta.translations: null`/`meta.conditions: null` が既定値のまま。日本語化・条件付き表示の実装前例はゼロ (完全新規パターン)。
- `frontend/src/lib/directus.ts` (105行): `topics_files`/`AnnouncementFile`/`TopicFile` 型が既に定義済み (`home-page-expansion` spec 由来、M2M junction パターンの実コード前例として使える)。

### 慣習・制約
- Directus アクセスは `frontend/src/lib/*.ts` に集約し、`page.tsx`/コンポーネントは lib 経由でのみ collection に触れる (直接 SDK 呼び出しなし)。
- 型定義 (`home-page-types.ts`) とレスポンス整形ロジック (`home-page.ts`) が 1:1 で密結合しており、スキーマ変更は必ず両ファイルの同時変更を要する。

## 2. 要件フィージビリティ分析

| 要件 | 技術ニーズ | ギャップ種別 |
|---|---|---|
| R5: CI 一時停止 (`if: false`) | `additive-schema-check.yml` の `check` job への条件追加のみ | 実装は容易。**Unknown**: `if: false` の job が required status check として pass 扱いになるか未検証 (design-review Issue 3、ユーザー指示によりタスク化は見送り済み) |
| R6.1-6.3, 6.10: student_exhibitions 整理 | `content`/`location` 削除、`images`→`image` 型変更 | フロントエンド側の参照箇所は未調査 (student_exhibitions は現状どのページからも参照されていない、Gap分析 Req2 参照) → **Low risk**、snapshot.yaml 編集のみで完結する可能性が高い |
| R6.4: sponsors.type 選択肢整理 | choices の text のみ変更、value 維持 | `SponsorSummary.type` 型 (`'ad'\|'sponsor'\|'food_truck'\|'other'`) は value ベースのため無変更で動作。**Constraint確認済み、影響なし** |
| R6.2, 6.5: topics.link_url 削除・body WYSIWYG化 | `topic-card.tsx` が `linkUrl` を実際にレンダリングしている | **Missing (新規発見)**: tasks.md 2.3 は snapshot.yaml 編集のみを対象としているが、`topics.ts`/`topic-card.tsx`/関連テストの同時修正が必須。放置すると型エラー・機能欠落が発生する |
| R6.2, 6.6, 6.10: festival_meta 整理 | `admission_fee`/`payment_note`/`parking_capacity` 削除 | **Critical (新規発見)**: `admission_fee`/`payment_note` は `/about` ページの `festival-overview.tsx` で実際にレンダリングされている。これは `home-page-expansion` spec の成果物であり、design.md の Out of Boundary「`home-page-expansion` spec が対象とする Home Page / About ページ自体の表示ロジック変更」と技術的に矛盾する (削除すれば `festival-overview.tsx`/`festival-meta.ts`/関連テストの改修が必然的に発生する) |
| R7.1-7.5: page_home_live 廃止 | `home-page.ts` の分岐ロジック除去、RBAC migration 無効化 | 想定通り。`getHomePage()` 1 箇所に分岐ロジックが集約されているため改修範囲は明確。無効化 migration は `20260714A-` 以降の連番で追加可能 |
| R7.6-7.8: hero_images M2M化 | `page_home_files` junction 新設 | `topics_files`/`TopicFile` という直接転用可能なコード前例が既に存在 (**Missing だが低リスク**、パターン模倣で実装可能) |
| R6.7: 日本語表示化 (`meta.translations`) | 全 collection/field への付与 | 既存 snapshot.yaml に前例が一切ない完全新規パターン。Directus 側の実際の反映確認 (管理画面表示) は未検証 |
| R6.8: 条件付き表示 (`meta.conditions`) | `sponsors.type` 等に応じた非表示 | 同上、完全新規パターン。Directus `meta.conditions` の正確な JSON 構文は要確認 (**Research Needed**) |
| R6.9: webp 配信 | `toAssetUrl` へのクエリパラメータ付与 | 実装自体は 1 行追加で容易。Directus Asset Transformations が対象 Directus バージョン (12.1.1) で `format=webp` をサポートするかは未検証 (**Research Needed**) |

### Research Needed
1. `additive-schema-check.yml` の `check` job に `if: false` を設定した場合、branch protection の required status check (`Detect breaking snapshot.yaml changes`) が実際に pass 扱いになるか (design-review で指摘済み、ユーザー判断によりタスク化見送り。実装後に問題があれば即座に判明する性質のため致命的ではない)
2. Directus 12.1.1 で `meta.conditions`/`meta.translations` の正確な JSON スキーマ、および Asset Transformations の `format=webp` サポート有無
3. `student_exhibitions` の `content`/`location`/`images` を現状参照しているフロントエンドコードが本当に存在しないか (grep では未検出だが、未実装 collection のため念のため実装直前に再確認推奨)

## 3. 実装アプローチ選択肢 (festival_meta 削除 × Aboutページ境界問題)

R6 の中で唯一 Boundary Commitments と矛盾する `festival_meta.admission_fee`/`payment_note` 削除について:

### Option A: 本 spec で festival-overview.tsx も追従修正する
- Aboutページの表示ロジック変更を「削除に伴う必然的な追従」として Out of Boundary の例外に位置づけ、`festival-overview.tsx`/`festival-meta.ts`/テストを本 spec のタスクに追加する。
- ✅ スキーマとフロントエンドの整合性が即座に保たれる、ビルドが壊れない
- ❌ design.md の Out of Boundary 記述 (`home-page-expansion` 表示ロジック変更は対象外) を上書きする追加合意が必要

### Option B: admission_fee/payment_note 削除を見送る
- 「要らない」というヒアリング結果は尊重しつつ、スキーマ削除は `home-page-expansion` spec 側の改訂と合わせて後日行う (本 spec では他の festival_meta 変更のみ実施)。
- ✅ Boundary Commitments を厳密に守れる
- ❌ ユーザーの「要らない」という明確な指示への対応が先送りになる

### Option C: フロントエンドは非表示化のみ、スキーマは残す
- `festival-overview.tsx` から admissionFee/paymentNote の描画を削除するが、`snapshot.yaml` のフィールド自体は additive-only を守るため残す (削除は本番公開後に改めて実施)。
- ✅ additive-only の精神に近い、CI 一時停止に頼らない
- ❌ 「不要フィールド削除」というユーザー意図を完全には満たさない、フィールドが残り続け二重管理になる

## 4. Effort / Risk (tasks.md 各 major task 起点)

- **task 2.3 (topics)**: Effort S→M へ格上げ推奨 (topic-card.tsx 追従修正が必要と判明)。Risk: Low (改修範囲は明確)
- **task 2.4 (festival_meta)**: Risk: **High** (Boundary 矛盾が未解決のまま実装するとビルドが壊れる、または Out of Boundary 違反になる。着手前に Option A/B/C のいずれかを確定する必要あり)
- **task 4.1 (hero_images M2M)**: Risk: Low (`topics_files` という直接模倣可能なコード前例あり)
- **task 3.1-3.2 (translations/conditions)**: Risk: Medium (Directus 側の正確な仕様が未検証、Research Needed 参照)

## 5. 実装フェーズへの推奨事項

- **task 2.4 着手前に Option A/B/C を確定すること**を強く推奨する。現状の design.md/tasks.md のまま着手すると、`festival-overview.tsx` がコンパイルエラーになるか、Boundary Commitments 違反のいずれかが発生する。
- **task 2.3 (topics.link_url 削除)** は tasks.md の detail bullet に `topic-card.tsx` の追従修正を明示的に追加すべき (現状のタスク記述は snapshot.yaml 編集のみに読める)。
- **task 3.1/3.2 (translations/conditions)** は着手時に Directus 12.1.1 の実際の管理画面で JSON 構文を確認しながら進める (ローカル `docker compose up` 環境での試行を推奨)。
- Requirement 5 の CI 一時停止機構 (skip=pass 仕様) は実装後の最初の破壊的変更 PR で自然に検証されるため、追加の事前検証タスクは不要という前回のユーザー判断は妥当。

## 次のステップ (解決済み)

Option A (本 spec で `festival-overview.tsx` も追従修正する) を採用。`requirements.md` (Requirement 6.11, 6.12 追加)・`design.md` (Out of Boundary 例外・File Structure Plan 追記)・`tasks.md` (task 2.3/2.4 に追従修正の detail bullet 追加、task 4.4 の `_Depends:_` 更新) に反映済み。`/kiro:spec-impl sitemap-schema-review` に進める。
