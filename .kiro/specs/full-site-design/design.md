# Technical Design: full-site-design

## Overview

本 spec は、開催前の簡易ページとして作られた現行サイトを本番運用に耐える形へ作り直す。対象はトップページ、サイト共通ヘッダー、フッター、グローバルナビゲーション (ハンバーガーメニューと新規の下部ナビゲーション)、構内マップ画面のメニュー、協賛一覧、トピックとお知らせの表示である。

requirements.md が述べるとおり、これら 16 のデザイン単位は Figma での定義を単位ごとに進めている途中であり、現時点で定義済みなのは一部にとどまる。したがって本書は完成した設計書ではなく、**ビジュアルデザインの有無に関わらず確定している構造だけを置いた土台**として扱う。具体的には、ナビゲーション項目定義の配置、協賛種別のスキーマ変更、CMS 取得失敗時の分岐、再検証方針の置き場所といった、デザインが決まっても変わらない部分を書く。色・余白・タイポグラフィ・レイアウトの詳細は一切書かない。

各デザイン単位のセクションは、現時点では「どのファイルが責務を持つか」「データがどこから来るか」に限って記述する。デザインが起きた単位から、そのセクションへ設計を追記していく。

### Goals

- ナビゲーション項目定義を表示部品から切り離し、ヘッダー・ハンバーガーメニュー・フッター・下部ナビゲーション・MapMenuButton の 5 箇所が同一の定義を参照する状態にする
- `sponsors.type` を複数選択へ変更し、広告協賛・地域協賛それぞれの一覧を実装できる取得層を用意する
- CMS の一部取得失敗がページ全体の非表示につながる現状の分岐を、領域単位の縮退へ置き換える
- 各デザイン単位について、デザイン確定後に追記するだけで実装へ進める構造を定義する

### Non-Goals

- 本 spec が扱う 16 のデザイン単位のビジュアルデザインの決定 — Figma でのデザイン作成時に確定する
- Figma フレームの作成作業そのもの
- 色・タイポグラフィのトークン自体の再定義 — `frontend/tailwind.config.ts` と `globals.css` を正とする
- `topics` / `announcements` の CMS データモデル変更
- 企画一覧・企画詳細ページ本体 (`exhibition-pages`)、構内マップの地図本体 (`campus-map`)、タイムテーブル (`timetable-page`)、サイネージ (`digital-signage`)、駐車場空き状況 (`parking-availability`)
- 固定ページ (アクセス・お問い合わせ・プライバシーポリシー等) の本文デザイン

## Boundary Commitments

### This Spec Owns

- ナビゲーション項目定義 (`frontend/src/lib/navigation.ts`、新設) と、それを参照する 5 つの表示部品
- `cms/src/collections/sponsors.ts` の `type` フィールド定義と対応するマイグレーション
- 協賛一覧の取得層と表示部品
- `frontend/src/app/(site)/layout.tsx` および `(site)` 配下のトップページの構成。開催前フェーズ・開催中フェーズそれぞれのトップページが表示する内容
- `frontend/src/lib/cms.ts` の再検証方針
- 下部ナビゲーション (新規)
- `frontend/src/components/campus-map/map-menu-button.tsx` のメニュー内容 (ボタンの配置要件を含む)

### Out of Boundary

- 構内マップページのレイアウト・地図・ポリゴン・出展物リスト — `campus-map` が所有する
- 企画カードのデザインと企画詳細の URL — `exhibition-pages` が所有する
- フェーズ切替機構 (フェーズ設定の保持、公開範囲の制御、トップページの出し分け、開発者向けオーバーライド) — `festival-phase-gate` が所有する
- `sponsors` の `type` 以外のフィールド定義
- `topics` / `announcements` のフィールド定義

### Allowed Dependencies

- `frontend/src/lib/cms.ts` の取得ラッパーと `CmsResult` 型
- `frontend/src/lib/cms-asset-url.ts` / `cms-media.ts` のメディア URL 組み立て
- `frontend/src/cms-types.ts` (CMS から生成される型)
- `frontend/tailwind.config.ts` と `globals.css` のトークン

### Revalidation Triggers

- `sponsors.type` の選択肢の増減 — 協賛一覧の絞り込み条件を持つ全箇所が再確認を要する
- ナビゲーション項目定義の型の変更 — 参照する 5 つの表示部品すべてに波及する
- `frontend/src/lib/cms.ts` の再検証方針の変更 — CMS を参照する全ページの鮮度に波及する

## Architecture

### 既存構造

- ルートグループは 2 系統。`(site)` は `layout.tsx` で `Header` と `Footer` を巻き、`(fullscreen)` は巻かない。構内マップは `(fullscreen)/map` にある。したがって「ヘッダー・フッターを構内マップで表示しない」(要件 5.7 / 9.10) は現行のルートグループ分割で既に満たされている。
- ナビゲーション項目は 3 箇所に散っている。`header.tsx` の `navigationItems` (`map-menu-button.tsx` が import)、`footer.tsx` の `footerNavigation`、下部ナビゲーションは未実装。
- CMS 取得は `lib/cms.ts` の `cms.findMany` / `findById` / `findGlobal` に集約されている。`fetch` に再検証の指定がないため、事実上すべての取得がリクエストごとに発生する。
- 取得層の失敗の扱いが 2 通り混在している。`getHomePage` は `festival_meta` と `page_home` の失敗で throw し、一覧 (`sponsors` / `announcements` / `topics`) の失敗は空配列へ倒す。`page.tsx` は throw を catch してページ本文全体を非表示にし、`sr-only` の `h1` だけを残す。
- 協賛データは `getHomePage` が既に取得して `HomePageContent.sponsors` に載せているが、描画されていない。`components/sponsors-list.tsx` はテストからのみ参照されている。

### 共有モジュールの配置

本 spec が新設する共有モジュールは 3 つで、いずれも表示部品から独立させる (要件 17.4)。

| モジュール | 責務 | 参照元 |
|---|---|---|
| `frontend/src/lib/navigation.ts` | サイト全体のナビゲーション項目定義 | header / ハンバーガーメニュー / footer / 下部ナビゲーション / MapMenuButton |
| `frontend/src/lib/sponsors.ts` | `sponsors` の取得と種別による絞り込み | 協賛一覧ページ、トップページの協賛領域 |
| `frontend/src/lib/breakpoints.ts` | PC 相当 / スマートフォン相当の境界を表す単一の定数 | 本 spec が扱う全デザイン単位 |

`frontend/src/lib/cms.ts` には再検証方針を追加する。新規モジュールは作らず、既存の取得ラッパー 1 箇所で扱う。

## File Structure Plan

### 新規ファイル

```
frontend/src/lib/
├── navigation.ts            # ナビゲーション項目定義 (要件 17)
├── sponsors.ts              # 協賛の取得と種別絞り込み (要件 12, 13, 16.5)
└── breakpoints.ts           # PC / SP 境界の単一定義 (要件 19.2)

frontend/src/components/
└── bottom-navigation.tsx    # 下部ナビゲーション (要件 8)

frontend/src/app/(site)/sponsors/
└── page.tsx                 # 協賛一覧 (ルート構成は未確定。下記 Requirement 12/13 参照)

cms/src/migrations/
├── <timestamp>_sponsors_type_multi.ts        # sponsors.type の複数選択化 (要件 16.4)
└── <timestamp>_event_days_structured.ts      # event_days の配列化 (要件 20)
```

### 変更ファイル

- `cms/src/collections/sponsors.ts` — `type` を `hasMany` の select にし、選択肢を 4 種へ差し替える
- `cms/src/globals/festival-meta.ts` — `event_days` を `json` から `array` (`start_at` / `end_at` / `label`) へ変更する
- `cms/src/migrations/index.ts` — 生成したマイグレーションを登録する
- `frontend/src/cms-types.ts` — `pnpm generate:types` で再生成する (手書きしない)
- `frontend/src/lib/home-page-types.ts` — `SponsorSummary.type` を配列型へ変更し、`EventDay` を `{ label, startAt, endAt }` の構造へ変更する
- `frontend/src/components/festival-overview.tsx`, `components/about-section.tsx` — `event_days` の新しい形 (ISO 日時) に合わせて表示を改める
- `frontend/src/lib/home-page.ts` — 取得失敗時に throw せず領域単位で縮退させる (要件 18.1, 18.2)
- `frontend/src/lib/cms.ts` — 取得に再検証方針を与える (要件 18.3)
- `frontend/src/components/header.tsx` — `navigationItems` の定義を `lib/navigation.ts` へ移し、間引きを解消する
- `frontend/src/components/footer.tsx` — `footerNavigation` を廃し `lib/navigation.ts` を参照する
- `frontend/src/components/campus-map/map-menu-button.tsx` — import 元を `lib/navigation.ts` へ差し替える
- `frontend/src/app/(site)/layout.tsx` — 下部ナビゲーションを追加する
- `frontend/src/app/(site)/page.tsx` — `heroMessageHtml` の重複表示を解消し、協賛・企画一覧・構内マップの導線を追加する
- `frontend/src/components/sponsors-list.tsx`, `announcements-list.tsx`, `topic-card.tsx`, `topics-list.tsx`, `hero-section.tsx` — デザイン確定後に見た目を改める

## 横断的要件の設計

ここに置く 4 件はビジュアルデザインに依存しないため、確定した内容を記述する。

### Requirement 16: 協賛種別の複数選択化 (CMS)

#### フィールド定義

`cms/src/collections/sponsors.ts` の `type` を以下へ変更する。フィールド名 `type` は据え置く。

- `type: 'select'`、`hasMany: true`、`required: true`
- `defaultValue` は削除する (複数選択で既定値を持たせる理由がない)
- 選択肢は `ad` (広告協賛) / `local` (地域協賛) / `vendor` (出店協賛) / `other` (その他) の 4 種
- `required: true` により、Payload は空配列の保存を拒否する (要件 16.3)

旧値との対応は `ad` = 広告協賛 (据え置き)、`sponsor` → `local`、`food_truck` → `vendor`、`other` = その他 (据え置き)。

#### マイグレーション

Payload の `select` は `hasMany: true` で別テーブルへ切り出されるため、列から子テーブルへの型変更を伴う。`cms/src/collections/student-exhibitions.ts` の `category` → `categories` (`20260918_015706_student_exhibitions_multi_category_content`) が同型の先行事例であり、生成される差分は次の形になる。

1. 新しい列挙型 `enum_sponsors_type` を 4 値で作り直す (旧 `sponsor` / `food_truck` を含む定義は落とす)
2. 子テーブル `sponsors_type` (`order`, `parent_id`, `value`, `id`) を作成し、`parent_id` に `sponsors(id)` への ON DELETE CASCADE 外部キーと `order` / `parent_id` のインデックスを張る
3. `sponsors` から `type` 列を落とす

手順は `cms/` で `pnpm migrate:create sponsors_type_multi` → `src/migrations/index.ts` へ登録 → `pnpm generate:types` (`frontend/src/cms-types.ts` も更新される)。生成された SQL を手で書き換えない。

**データ移行は行わない。** 本番 CMS の `sponsors` は 0 件 (`totalDocs: 0` 確認済み) であり、移し替える行が存在しない。

#### 破壊的変更の扱い

`cms-schema-check.yml` は `type` の型変更を破壊的変更として検出する。要件 16.6 に従い、フロントエンド側の変更 (下記) を同一 PR にそろえたうえで `breaking-change-acknowledged` ラベルを付けて検出をスキップする。

#### フロントエンド側の影響

`sponsors.type` を参照しているのは `frontend/src/lib/home-page-types.ts` の `SponsorSummary.type` 1 箇所のみ。

```typescript
// 変更前
type: 'ad' | 'sponsor' | 'food_truck' | 'other';
// 変更後
export type SponsorType = 'ad' | 'local' | 'vendor' | 'other';
type: readonly SponsorType[];
```

一覧への振り分けは「配列が対象の値を含むか」で判定する (要件 16.5)。判定は `lib/sponsors.ts` に置き、表示部品は絞り込み済みの配列だけを受け取る。

#### 未確定

- 種別ごとの入力項目の出し分け (`tier` は広告協賛のみ、`business_category` / `address` は地域協賛のみ、`area_id` / `booth_number` / `booth_label` は出店協賛向け) を `admin.condition` で実装するか、現状どおり `admin.description` の注記に留めるか。`hasMany` の値に対する条件判定になるため、実装時に確定させる。

### Requirement 17: ナビゲーション項目定義の一元管理

`frontend/src/lib/navigation.ts` を単一の定義元とする。既存の `header.tsx` の `NavigationItem` 型をそのまま移設し、`label` / `href` / `children` を保持する (要件 17.3)。

```typescript
export interface NavigationItem {
  readonly label: string;
  readonly href: string;
  readonly children?: readonly NavigationItem[];
}
export const navigationItems: readonly NavigationItem[];
```

- `header.tsx` からの `navigationItems` の export は廃止し、`map-menu-button.tsx` の import 元を `lib/navigation.ts` へ差し替える。`footer.tsx` の `footerNavigation` も廃止する (要件 17.2)。
- `lib/navigation.ts` はコンポーネントを import しない (要件 17.4)。したがって `'use client'` を持たず、サーバーコンポーネントである `footer.tsx` からもクライアントコンポーネントである `header.tsx` からも参照できる。
- `header.tsx:17` の間引きコメントは、企画一覧・構内マップ・協賛の項目を定義へ戻したうえで削除する (要件 5.1)。

#### 未確定

- 項目の最終的な並び順・ラベル・子項目の構成 (要件 5 のデザイン作成時項目)
- 表示箇所ごとに項目を絞るための情報 (下部ナビゲーションに出すか等) を定義側に持たせるか、表示側で選ぶか。下部ナビゲーションに出す項目数が決まらないと判断できないため、要件 8 のデザイン確定後に決める。

### Requirement 18: CMS 取得失敗時の振る舞いとキャッシュ方針

#### 領域単位の縮退

現状の `getHomePage` は `festival_meta` と `page_home` の取得失敗で throw し、`page.tsx` がそれを catch してページ本文全体を落とす。結果として `sr-only` の `h1` だけが残る。これは要件 18.2 が明示的に禁じる状態である。

`getHomePage` の戻り値を、領域ごとに欠落を表現できる形へ改める。

- `festival` / `theme` / `heroMessageHtml` を必須ではなく欠落しうる値として返す
- 一覧 (`sponsors` / `announcements` / `topics`) は現行どおり失敗を空配列へ倒す。ただし「0 件」と「取得失敗」を区別する必要がある協賛一覧 (要件 12.8 / 13.7) では、`lib/sponsors.ts` が `CmsResult` の失敗を空配列へ倒さずそのまま表示側へ渡す
- `page.tsx` は `content` の有無でページ全体を分岐させず、領域ごとに分岐する

ヘッダー・フッター・下部ナビゲーションは `(site)/layout.tsx` に属し CMS 取得に依存しない構造のため、要件 18.2 のうちこの 3 つは現行の配置で満たされる。`footer.tsx` は既に `getSnsLinks` / `getContactFormUrl` を個別に try/catch しており、要件 9.9 を満たしている。

#### 再検証方針

`lib/cms.ts` の `request()` は `fetch` に第 2 引数を渡していない。ここに再検証の指定を追加し、CMS 取得の鮮度をこの 1 箇所で決める (要件 18.3)。取得経路が `request()` に集約されているため、呼び出し側を変更せずに方針を適用できる。

#### 未確定

- 再検証の間隔の値、およびコンテンツの種類ごとに値を変えるかどうか。当日の運用 (お知らせの反映速度への要求) が決まっていないため、実装時に確定させる。
- 種類ごとに変える場合に、`cms.findMany` 等へ任意引数として渡すか、コレクション単位の表を `cms.ts` 内に持つか。

### Requirement 19: 表示の共通基準

- **色とタイポグラフィ** (19.1): `frontend/tailwind.config.ts` の `theme.extend.colors` と `globals.css` を正とする。新しい色値をコンポーネント側に直接書かない。不足するトークンが見つかった場合は `tailwind.config.ts` へ追加する。Figma Foundations はこの写しとして扱う。
- **本文の最大幅**:
  - PC: セクションのコンテンツ枠は 1280px (1440px から左右 80px のパディングを引いた幅) とする。その中で長文の段落は 768px (Tailwind の `max-w-3xl`) に制限する。日本語本文は 1 行 35〜45 文字が読みやすく、16px フォントで約 700px に相当するため。既存コードでは `about-section.tsx` の概要文と `static-page-view.tsx` が `max-w-3xl` を使っている
  - SP: フレーム幅 390px、左右パディング 16px、コンテンツ幅 358px。コンテンツ幅が 768px を下回るため、長文段落の 768px 制限は SP では実質効かない (コンテンツ枠の幅がそのまま段落幅の上限になる)
- **見出しの色**: `globals.css` の `h1〜h6:not(.prose *)` が基底で `text-primary` を当てており、上書きしない限り見出しは primary になる。上書きは色つきカード上や小さな補助ラベル用途に限る (`exhibition-card.tsx` の h4 が `text-text`、`festival-overview.tsx` の h3 が `text-gray-500`)。
- **ブレークポイント** (19.2): `frontend/src/lib/breakpoints.ts` に単一の定数として定義し、本 spec が扱う全デザイン単位でこれを用いる。現行のヘッダーは `lg` を境界としているが、値は未確定 (下記)。
- **フォーカス表示** (19.3): 既存コードが用いている `focus-visible` を基準とする。
- **動きの抑制** (19.4): 既存コードが用いている Tailwind の `motion-reduce:` を基準とする (`footer.tsx` の `HoverLine` が先行例)。自動再生される動き (ヒーローのスライドショー等) は `prefers-reduced-motion` で停止させる。
- **横スクロール** (19.5): スマートフォン相当の画面幅で本文に横スクロールを発生させない。

#### 未確定

- ブレークポイントの値。下部ナビゲーションを出す画面幅とヘッダーのナビゲーションを畳む画面幅が一致すべきかどうかが、要件 6 と要件 8 のデザイン確定を待つ。
- Figma Foundations に写されているトークン (色 14 件・タイポ 9 件) で本 spec の全画面をまかなえるか、不足するトークンがあるか。Requirement 1 の実測で判明した事実: `color/background` (`#FBF8F3`) は `tailwind.config.ts` と一致した。一方 Foundations には `gray-300` / `gray-600` / `gray-700` / `gray-800` が存在せず、コード側の `text-gray-600` (お知らせの日付) や `text-gray-700` (表ヘッダー) に対応するトークンがない。また `about-section.tsx` と `hero-section.tsx` は `text-slate-950` / `text-slate-700` / `text-slate-500` という別系統のグレースケールを用いており、Foundations にも `tailwind.config.ts` の gray スケールにも一致しない。この不一致は本 spec のトップページ作り直しで解消される範囲であり、残り 14 単位についても同様の確認が必要かどうかは未確定のまま残る。

### Requirement 20: 開催日程 (event_days) の構造化

#### フィールド定義

`cms/src/globals/festival-meta.ts` の `event_days` を `type: 'json'` から `type: 'array'` へ変更する。各要素は次の 3 フィールドを持つ。

- `start_at` — `type: 'date'`、`required: true`、`admin.date.pickerAppearance: 'dayAndTime'`。その日の開場日時。開催日の年月日と曜日の表示、カウントダウンの算出はここから行う
- `end_at` — `start_at` と同型 (`pickerAppearance: 'dayAndTime'`) の終了日時
- `label` — `type: 'text'`、任意入力。「1日目」のような呼び名を管理者が任意で持たせる。未入力時の表示は要件 20.5 に従いフロントエンド側で `start_at` から生成する

独立した日付専用フィールドは持たない。日付と時刻を分けると、`open` / `close` のような時刻専用フィールド (`pickerAppearance: 'timeOnly'`) の DB 実体が `timestamp with time zone` のままになり (Payload の `date` フィールドは picker の見た目によらず常にこの型になる)、日付部分にダミー値が入った状態と時刻専用という入力上の意図がずれて事故の元になる。日時を 1 フィールドで持つことでこのずれを避け、`cms/src/collections/time-slots.ts` の `start_at` / `end_at` という命名にも揃える。

#### スキーマへの影響

Payload の `array` フィールドは JSON 列ではなく子テーブルとして生成される。`cms/src/collections/student-exhibitions.ts` の `links` (`array`) が `20260917_190645_student_exhibitions_links_stage_name` で `jsonb` 列から子テーブル `student_exhibitions_links` へ切り出された変更と同型である。生成される差分は次の形になる。

1. 子テーブル `festival_meta_event_days` (`_order` integer, `_parent_id` integer, `id` varchar PK, `start_at` timestamp(3) with time zone, `end_at` timestamp(3) with time zone, `label` varchar) を作成する
2. `_parent_id` に `festival_meta(id)` への `ON DELETE CASCADE` 外部キーと、`_order` / `_parent_id` のインデックスを張る
3. `festival_meta` から `event_days` (`jsonb`) 列を落とす

`start_at` / `end_at` はいずれも Payload の `date` フィールドであり、`pickerAppearance: 'dayAndTime'` によらず DB 上は `timestamp(3) with time zone` になる (`announcements.published_at` / `topics` の日付フィールドと同じ)。子フィールドに `select` を持たないため、新しい enum 型は発生しない。

`pickerAppearance: 'dayAndTime'` は Payload 3.88.0 (`cms/package.json` の現行バージョン) の型定義 (`node_modules/payload/dist/admin/elements/DatePicker.d.ts`) に存在する値であり、`cms/src/collections/announcements.ts` の `published_at` と `cms/src/collections/topics.ts` の該当フィールドで既に使われている。

#### マイグレーション

列の削除と子テーブルの追加を伴うため、Payload のマイグレーションが必要である。手順は `cms/` で `pnpm migrate:create event_days_structured` → `src/migrations/index.ts` へ登録 → `pnpm generate:types` (`frontend/src/cms-types.ts` も更新される)。生成された SQL を手で書き換えない。

#### 既存データの移行

`festival_meta` はグローバル (単一ドキュメント) であり対象は 1 件のみ。旧形式の `event_days` (`[{label, open, close}]` の JSON 配列、年情報なし) は列ごと落ちるため、コードによる自動移行は行わない。マイグレーション適用後、CMS 管理画面から `event_days` を新しい構造 (開場日時・終了日時・表示ラベル) で入力し直す。反映されるまでの間 `event_days` は空になり、曜日・残り日数の算出対象がない状態になる。

#### 破壊的変更の扱い

`cms/scripts/collection-shape.ts` の `detectBreakingChanges` はコレクション/グローバル直下のフィールドを `name` / `type` / `required` / `hasMany` で比較する (ネストした `array` の子フィールドまでは見ない)。`event_days` は `type` が `json` から `array` へ変わるため `type_changed` として検出される。`cms-schema-check.yml` は `cms/src/globals/**` の変更で発火するため、この PR で必ず実行され、要件 20.8 に従い `breaking-change-acknowledged` ラベルを付けたうえでマージする。

#### フロントエンド側の影響

- `frontend/src/cms-types.ts` は `pnpm generate:types` で再生成する。`FestivalMeta.event_days` は `{ id, start_at, end_at, label } []` の配列型になり、現行の `json` 由来の緩い型 (`unknown` 相当) から置き換わる
- `frontend/src/lib/home-page-types.ts` の `EventDay` を `{ label: string | null; startAt: string; endAt: string }` (`startAt` / `endAt` は ISO 日時文字列) へ変更する
- `frontend/src/lib/home-page.ts` / `lib/festival-meta.ts` の `meta.event_days as FestivalOverview['eventDays']` によるキャストは、生成された配列型をそのまま用いる形に変え、`as` によるキャストを外す
- `frontend/src/components/festival-overview.tsx` と `components/about-section.tsx` の表示 (`day.label` / `day.open` / `day.close`) を、`label` が空のときの代替文言の生成、および `open` / `close` の時刻表記が `startAt` / `endAt` の ISO 日時から時刻部分を取り出す形になったことへの対応に改める
- 曜日と開催日までの残り日数の算出を新設し、`startAt` を用いる。`components/hero-section.tsx` (要件 1.3) が参照する

#### 実装時に確定させる項目

- 曜日の表示形式
- 本番 `festival_meta.event_days` を新しい構造 (開場日時・終了日時・表示ラベル) で再入力する時期と手順

## デザイン単位ごとの設計

以下 16 単位は、ビジュアルデザインが未定のため、現時点で確定している構造面の方針のみを記す。各単位のデザインが起きた時点で、このセクションへ設計を追記する。

### Requirement 1: トップページ 開催前フェーズ (PC)

Figma: ファイル `0kWDqHsLr6xE8b4FFgR1Zx`、ページ「トップページ」、フレーム「トップページ (開催前) / PC (1440)」(`node-id=107:3`)。

セクションは Hero (`107:4`) → 荒牧祭とは (`119:3`) → お知らせ (`107:6`) の 3 つのみで構成する (要件 1.6)。

- **Hero**: 背景に画像スライドショー (プレースホルダ画像 + スライドインジケーター) とグラデーションスクリムを敷き、その上に左右 2 ブロックを乗せる。
  - 左ブロック: 見出し「群馬大学 荒牧祭」(固定文言、CMS に依存しない) の下に、開催日 (`festival_meta.event_days`) ｜ 会場 (`festival_meta.venue_name`) を 1 行で表示する (要件 1.1)
  - 右ブロック: テーマ (`festival_meta.theme_word`) の下に、開催までの残り日数のカウントダウン (要件 1.2, 1.3) を表示する。カウントダウンの算出は横断的要件 Requirement 20 が定める `event_days.start_at` に依存する
  - `components/hero-section.tsx` の自動送り (6 秒間隔)・クロスフェード・矢印ボタン・スライドインジケーターは現行のまま残す (要件 1.10, 1.11)。ズームのキーフレーム (`aramakisai-hero-zoom` と、それを適用する `.aramakisai-hero-image--active` の `animation` 指定) と、SCROLL の文字・縦線一式 (`aramakisai-scroll-line` を含む要素) は削除する (要件 1.12, 1.13)
  - 高さは `78svh` (ビューポート高の 78%) を PC・SP 共通の基準とする (要件 1.14)。単位は `vh` ではなく `svh` (small viewport height) を用いる。モバイルブラウザで URL バーの表示・非表示により実効ビューポート高が変動しても、`svh` は変動しない最小値を基準にするため高さが動かない。`lg:h-[calc(100vh-5rem)] lg:min-h-[30rem]` という PC 専用の上書きは削除する。`min-h-[28rem]` という下限は、`78svh` の値とは独立に、極端に低いビューポートでもヒーローが著しく縮まないための実装上の安全策として残す。自動再生される動き (クロスフェード・自動送り) の `prefers-reduced-motion: reduce` での停止は Requirement 19 (19.4) の既存の定めに従う
- **荒牧祭とは**: 見出し「荒牧祭とは」(固定文言) と概要文 (`festival_meta.overview_html`) を表示する (要件 1.4)。`festival_meta.name` は表示しない (要件 1.8)。実値が「第73回 荒牧祭公式ホームページ」というサイトタイトル用の文字列であり、本文の見出しに使う文言ではないため
- **お知らせ**: 見出し「お知らせ」(固定文言) の下に、Figma コンポーネント `NoticeItem` (ページ「コンポーネント」、`node-id=127:108`) のインスタンスを最大 5 件並べ、「お知らせ一覧へ」導線 (`/announcements`) を添える (要件 1.5)。表示部品は既存の `components/announcements-list.tsx` の `limit` prop を使う
- `page_home.hero_message_html` は開催前フェーズでは表示しない (要件 1.7)。本番 CMS で値が空であり、掲載不要という判断のため。開催中フェーズで使うかどうかは未確定 (下記)
- 非公開ページへの導線を持たない (要件 1.9) ことは、本文に置く導線を「お知らせ一覧へ」のみに限ることで担保する。`lib/navigation.ts` の項目をそのまま本文の導線へ流用しない
- データは `lib/home-page.ts` の `getHomePage()` から受ける。フェーズごとに取得層を分けず、取得済みの値のうちフェーズで描画する領域を選ぶ。開催前フェーズと開催中フェーズのトップページをどのファイル構成で持つか (同一コンポーネント内の分岐か、フェーズごとに別コンポーネントか) は `festival-phase-gate` が定める出し分けの方式に従う

**未確定**: 開催中フェーズと共通にするセクションの範囲、テーマ (`theme_word`) に対応する配色、`page_home.hero_message_html` を開催中フェーズで使うかどうか。

### Requirement 2: トップページ 開催前フェーズ (SP)

Figma: ファイル `0kWDqHsLr6xE8b4FFgR1Zx`、ページ「トップページ」、フレーム「トップページ (開催前) / SP (390)」(`node-id=141:23`)。

- Requirement 1 と同一のコンポーネントがレスポンシブに対応する。SP 専用のページ・ルートは作らない
- フレーム幅 390px、左右パディング 16px (コンテンツ幅 358px)。本 spec が扱う SP のデザイン単位はこの値を基準とする (Requirement 19 参照)。既存の「企画一覧 / SP (390)」「企画詳細 / SP (390)」「構内マップ / SP (390)」と同じ幅であり、企画ページ SP の `Main` フレームの `paddingLeft/Right: 16` かつ左揃えの構成を踏襲した
- セクション構成 (ヒーロー → 荒牧祭とは → お知らせ) と表示する情報は Requirement 1 (PC) と完全に同じで、省略はない (要件 2.1)
- **Hero**: PC の横 2 ブロックを縦 1 カラムへ変え、見出し「群馬大学 荒牧祭」→ 開催日 → 会場 → テーマ → カウントダウンの順に積む (要件 2.2)。PC の「開催日｜会場」の横並びは 358px のコンテンツ幅に収まらないため別々の行に分ける。全要素を左揃えに統一する (PC はテーマ・カウントダウンのブロックが右揃え)
  - 高さは `78svh` を PC と共通の基準とする (要件 1.14、Requirement 1 参照)。Figma 上のヒーロー高さ 658px は、SP の参照ビューポート高 844px (「構内マップ / SP (390)」フレームの高さ) で `78svh` を描画した場合の参考値であり、仕様そのものは `78svh` という相対値である
- **荒牧祭とは・お知らせ**: PC と同じ情報を表示する。概要文とお知らせタイトルの折り返し行数は PC より増えるが内容は同一
- `NoticeItem` (`node-id=127:108`) は PC/SP で共通のコンポーネントをそのまま使い、幅はインスタンス側で FILL にして吸収する。マスターの変更は不要で、PC 側のインスタンスへの影響もない
- 下部ナビゲーションを表示しない (要件 2.4) ため、ページ下端の余白 (要件 2.5) も設けない。`(site)/layout.tsx` が与える下端余白は下部ナビゲーションの表示と同じ条件で付け外しし、余白だけが残る状態を作らない

### Requirement 3: トップページ 開催中フェーズ (PC)

- ファイル構成とデータ取得は Requirement 1 と同一の方針に従う。
- `heroMessageHtml` の重複 (要件 3.1) は Requirement 1 と同一の手当てで解消する。
- 協賛領域 (要件 3.3) も Requirement 1 と同一に `lib/sponsors.ts` の絞り込みを通して描画する。
- 企画一覧・構内マップへの導線 (要件 3.2) は、遷移先が `/exhibitions` と `/map` で確定している。導線の形は未確定。
- トピックの 0 件時の非表示 (要件 3.6) は現行の実装で満たされている。

**未確定**: セクションの構成と並び順、ヒーロー領域の構成、導線の形、協賛をトップページでどこまで見せるか、開催前フェーズと共通化するセクションの範囲、見出しの文言。

### Requirement 4: トップページ 開催中フェーズ (SP)

- Requirement 3 と同一のコンポーネントがレスポンシブに対応する。SP 専用のページ・ルートは作らない。
- 下部ナビゲーションに隠れない余白 (要件 4.3) は、個々のセクションではなく `(site)/layout.tsx` のコンテンツ領域に下端余白を与えて確保する。下部ナビゲーションの高さと `env(safe-area-inset-bottom)` を足した値を用いる。
- SP のフレーム幅 390px・左右パディング 16px (コンテンツ幅 358px) は Requirement 2 で確定した値を用いる (Requirement 19 参照)。

**未確定**: ヒーロー画像の表示崩れの具体的な直し方 (Requirement 2 と同一の手当てとするかを含む)、1 カラムへの落とし込み、横並び領域の SP での並べ方。

### Requirement 5: サイト共通ヘッダー (PC)

- ファイル: `frontend/src/components/header.tsx` (`'use client'`)。`(site)/layout.tsx` が巻くため、要件 5.7 は現行構造で満たされる。
- ナビゲーション項目は `lib/navigation.ts` から受ける (Requirement 17)。間引きコメント (`header.tsx:17`) を削除し、企画一覧・構内マップ・協賛を定義へ戻す。
- 現在地の伝達 (要件 5.5) は現行同様 `usePathname()` と `aria-current` で行う。
- 上端固定 (要件 5.6) は現行の実装を維持する。

**未確定**: 並び順とラベル、子項目を持たせる項目、ロゴとナビゲーションの配置、ヘッダーの高さ、スクロール時の振る舞い、現在地の視覚表現、スキップリンクの有無。

### Requirement 6: サイト共通ヘッダー (SP)

- Requirement 5 と同一コンポーネント内で、`lib/breakpoints.ts` の境界を用いて出し分ける。
- 非表示側を支援技術とキーボードから除外する (要件 6.4) ため、`hidden` によらず表示側のみを DOM に描くか、`hidden` 属性で除外する。現行の `lg:hidden` / `hidden lg:flex` による出し分けは、CSS の `display: none` で両者とも除外されるため要件を満たすが、境界定数への置き換えに合わせて見直す。
- セーフエリア (要件 6.3) は `env(safe-area-inset-top)` を用いる。

**未確定**: SP でのヘッダーの高さとロゴの扱い、開閉ボタンのアイコン、開催中フェーズで下部ナビゲーションを導入した後にハンバーガーメニューを残すか。開催前フェーズでは下部ナビゲーションを表示しないため、ハンバーガーメニューは常に必要となる。

### Requirement 7: ハンバーガーメニュー展開状態

- 現行の `header.tsx:152-280` の開閉ボタンとドロップダウンを起点とする。開閉状態・子項目の開閉状態・Esc での復帰は現行実装が持っている。
- フォーカストラップ (要件 7.4) は現行のヘッダーには無く、`map-menu-button.tsx` が Tab のループ処理を持っている。両者で同じ処理を二重に書かないよう、フォーカストラップを共有のフックへ切り出して両方から使う。

**未確定**: 展開形式、背面のスクロール抑止と読み上げ除外、外側クリックでの close、SNS やお問い合わせを含めるか、アニメーション。

### Requirement 8: 下部ナビゲーション

- 新規ファイル `frontend/src/components/bottom-navigation.tsx`。`(site)/layout.tsx` に置く。
- 表示はフェーズに依存し、開催中フェーズでのみ描画する (要件 8.1, 8.3)。開催前フェーズでは DOM に出さない。現在のフェーズをどう判定するかは `festival-phase-gate` が定めるため、本 spec はフェーズを受け取って描画を切り替えることのみを前提とする。
- 項目は `lib/navigation.ts` から導出する (要件 8.4)。
- PC 相当での除外 (要件 8.2) とセーフエリア (要件 8.5) は Requirement 6 / 19 と同じ手段を用いる。
- 本文・フッターとの重なり回避 (要件 8.6) は Requirement 4 の下端余白で担保する。下端余白は下部ナビゲーションの描画と同じ条件で与える。

**未確定**: 表示する項目と件数、アイコンとラベル、項目の選び方、構内マップページでの表示可否、スクロール連動の有無、高さ、現在地の視覚表現。

### Requirement 9: フッター (PC)

- ファイル: `frontend/src/components/footer.tsx` (サーバーコンポーネント)。`(site)/layout.tsx` が巻くため要件 9.10 は現行構造で満たされる。
- サイト案内ブロックは `footerNavigation` を廃して `lib/navigation.ts` から導出する (要件 9.2)。
- SNS とお問い合わせの条件付き非表示 (要件 9.4, 9.6, 9.7) と取得失敗時の継続 (要件 9.9) は現行実装が満たしている。

**未確定**: ブロックの並び順とカラム構成、サイト案内に出す項目の範囲、ロゴの有無、見出しの表記。

### Requirement 10: フッター (SP)

- Requirement 9 と同一コンポーネントがレスポンシブに対応する。
- 最下端の余白 (要件 10.2) は Requirement 4 の下端余白と同じ値を用いる。フッターが個別に持たない。下部ナビゲーションを表示しない開催前フェーズではこの余白も与えない。

**未確定**: ブロックの積み方、折りたたみの有無、SNS アイコンの並べ方と大きさ。

### Requirement 11: 構内マップの MapMenuButton

- ファイル: `frontend/src/components/campus-map/map-menu-button.tsx`。本 spec はメニューの中身と配置要件のみを扱い、構内マップページのレイアウトには踏み込まない。
- import 元を `lib/navigation.ts` へ差し替える (要件 11.2)。
- フォーカストラップと Esc、地図より先にキー操作を処理する `document` 捕捉 (要件 11.3, 11.4) は現行実装が持っている。Requirement 7 で切り出す共有フックへ移す。
- 地図コントロールとの重なり回避 (要件 11.5) は `campus-map` 側の配置に依存するため、同 spec の配置を前提に確認する。

**未確定**: ボタンの見た目、開いたメニューの展開形式と大きさ、子項目の扱い、セーフエリアと他コントロールとの位置関係。

### Requirement 12: 広告協賛一覧

- 取得は `frontend/src/lib/sponsors.ts` に置く。`cms.findMany('sponsors', { sort: ['sort'], limit: 0, depth: 1 })` を単一の取得とし、種別による振り分けはその結果に対して行う。広告協賛・地域協賛それぞれで CMS を叩かない。
- `type` 配列が `'ad'` を含むものを対象とする (要件 12.1)。並び順は `sort` 昇順 (要件 12.6) で、CMS 側の `defaultSort: 'sort'` および取得時の `sort` 指定で満たされる。
- 取得失敗 (要件 12.8) と 0 件 (要件 12.7) を区別する必要があるため、`lib/sponsors.ts` は失敗を空配列へ倒さず `CmsResult` の形のまま表示側へ渡す。
- 表示部品は既存の `components/sponsors-list.tsx` を起点とする。現行は 0 件で `null` を返すため、0 件表示 (要件 12.7) に合わせて改める。
- 外部リンクは `target="_blank" rel="noopener noreferrer"` (要件 12.5)。現行実装が持っている。

**未確定**: `tier` の一覧への反映、プラン未設定の協賛の扱い、`description` を出すか、ロゴの並べ方、ページ単独か地域協賛と同一ページか。ページ構成が決まるまで `(site)/sponsors/page.tsx` のルートは 1 本とし、分割が必要になった時点で見直す。

### Requirement 13: 地域協賛一覧

- 取得は Requirement 12 と同一。`type` 配列が `'local'` を含むものを対象とする (要件 13.1)。
- 表示する項目が広告協賛より多い (`business_category` / `address` / `description`) ため、`SponsorSummary` にこれらを追加する。現行の `SponsorSummary` は `id` / `type` / `name` / `logoId` / `url` / `tier` のみを持つ。
- 0 件と取得失敗の区別 (要件 13.6, 13.7) は Requirement 12 と同じ扱い。

**未確定**: 業種タグによる絞り込みや並べ替えの有無、1 件あたりの見せ方、住所の見せ方と地図サービスへの導線、広告協賛と同一ページに置くか。

### Requirement 14: トピックカード

- ファイル: `frontend/src/components/topic-card.tsx` と `topics-list.tsx`。データは `lib/topics.ts` の `TopicSummary` で、`imageId` を既に持つ (要件 14.2)。
- `topics` コレクションの定義は変更しない (要件 14.5)。
- 代替画像 (要件 14.3) は `imageId` が `null` のときに用いる。素材は未定。

**未確定**: 一覧で本文をどこまで見せるか、添付ファイルを出すか、サムネイルの縦横比、リンク領域の取り方、一覧での並べ方。

### Requirement 15: お知らせ一覧

- ファイル: `frontend/src/components/announcements-list.tsx`。トップページと `/announcements` の両方から使う。
- 表示件数の上限を呼び出し側から指定する (要件 15.4) 構造は現行の `limit` prop が持っている。上限超過時の一覧ページへの導線は未実装のため追加する。
- 公開済み・新しい順 (要件 15.1) は `lib/announcements.ts` の `publishedFilter()` と `sort: ['-published_at']` が満たしている。
- `announcements` の定義は変更せず、サムネイル画像を表示しない (要件 15.6)。

**未確定**: 表示形式、公開日の表記と機械可読形式の有無、選択領域の取り方、区別の有無、トップページと `/announcements` で同じ見た目を使うか。

### Requirement 21: お知らせ一覧ページ

- ファイル: `frontend/src/app/(site)/announcements/page.tsx`。データは `lib/announcements.ts` の `getAnnouncements()` から受け、`limit` を指定せず全件を Requirement 15 の表示部品 (`components/announcements-list.tsx`) へ渡す。
- 詳細ページ `frontend/src/app/(site)/announcements/[id]/page.tsx` は本単位の対象外。遷移先の URL (`/announcements/{id}`) のみ Requirement 15 と共有する。
- ページ全体の幅・余白は現行 `max-w-4xl` (896px)。Requirement 19 の共通基準 (PC: 1280px/768px、SP: 390px/16px) との揃え方は未確定 (下記)。

**未確定**: ページ全体の幅と余白の共通基準への合わせ方、見出しの文言と階層、件数が増えたときの提示方法 (1 ページへの一括表示・ページネーション・無限スクロール)、年別・月別の区切りの有無。表示部品自体の見た目 (表示形式やトップページとの異同) は Requirement 15 が扱う。

## Requirements Traceability

| Requirement | 主な設計要素 | 状態 |
|---|---|---|
| 1 | `(site)/page.tsx`, `lib/home-page.ts`, `components/hero-section.tsx`, `components/about-section.tsx`, `components/announcements-list.tsx` | Figma 確定 (開催中フェーズとの共通範囲は未確定) |
| 2 | `(site)/page.tsx`, `lib/home-page.ts`, `components/hero-section.tsx` | Figma 確定 (ヒーロー画像の崩れ対策の具体案は未確定) |
| 3, 4 | `(site)/page.tsx`, `lib/home-page.ts`, `components/hero-section.tsx` | 構造のみ確定 (フェーズの出し分けは `festival-phase-gate`) |
| 5, 6, 7 | `components/header.tsx`, `lib/navigation.ts`, `lib/breakpoints.ts`, 共有フォーカストラップ | 構造のみ確定 |
| 8 | `components/bottom-navigation.tsx`, `(site)/layout.tsx` | 構造のみ確定 |
| 9, 10 | `components/footer.tsx`, `lib/navigation.ts` | 構造のみ確定 |
| 11 | `components/campus-map/map-menu-button.tsx`, `lib/navigation.ts` | 構造のみ確定 |
| 12, 13 | `lib/sponsors.ts`, `components/sponsors-list.tsx`, `(site)/sponsors/page.tsx` | 取得層は確定、表示は未確定 |
| 14 | `components/topic-card.tsx`, `components/topics-list.tsx` | 構造のみ確定 |
| 15 | `components/announcements-list.tsx` | 構造のみ確定 |
| 16 | `cms/src/collections/sponsors.ts`, マイグレーション, `lib/home-page-types.ts` | 確定 |
| 17 | `lib/navigation.ts` | 確定 |
| 18 | `lib/cms.ts`, `lib/home-page.ts` | 分岐は確定、再検証の値は未確定 |
| 19 | `tailwind.config.ts`, `globals.css`, `lib/breakpoints.ts` | 基準は確定、境界値は未確定 |
| 20 | `cms/src/globals/festival-meta.ts`, マイグレーション, `lib/home-page-types.ts`, `components/hero-section.tsx` | 確定 (破壊的変更として検出される) |
| 21 | `(site)/announcements/page.tsx`, `lib/announcements.ts`, `components/announcements-list.tsx` | 構造のみ確定 |

## Testing Strategy

本リポジトリの既存方針に従い、テストは対象ファイルと同階層に `*.test.ts(x)` として置く。

- `lib/navigation.ts` — 定義が 5 つの表示部品から参照されていること、必須項目が欠けていないこと
- `lib/sponsors.ts` — `type` 配列による振り分け、`sort` 昇順、取得失敗と 0 件の区別
- `cms/src/collections/sponsors.ts` — `type` が 4 値の複数選択かつ必須であること
- `lib/home-page.ts` — `festival_meta` / `page_home` の取得失敗で throw せず、他領域の値を返すこと
- `(site)/page.tsx` — CMS 取得失敗時に主見出しが `sr-only` のみにならないこと
- `cms/src/globals/festival-meta.ts` — `event_days` が配列かつ `start_at` / `end_at` が必須であること
- `event_days` の `start_at` を用いた曜日・残り日数の算出

デザイン確定後に追加する見た目まわりのテストは、各デザイン単位のセクションへ追記する。
