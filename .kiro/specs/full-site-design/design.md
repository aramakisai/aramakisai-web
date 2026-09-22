# Technical Design: full-site-design

## Overview

本 spec は、開催前の簡易ページとして作られた現行サイトを本番運用に耐える形へ作り直す。対象はトップページ、サイト共通ヘッダー、フッター、グローバルナビゲーション (ハンバーガーメニューと新規の下部ナビゲーション)、構内マップ画面のメニュー、協賛一覧、トピックとお知らせの表示である。

requirements.md が述べるとおり、これら 15 のデザイン単位は Figma での定義を単位ごとに進めている途中であり、現時点で定義済みなのは一部にとどまる。したがって本書は完成した設計書ではなく、**ビジュアルデザインの有無に関わらず確定している構造だけを置いた土台**として扱う。具体的には、ナビゲーション項目定義の配置、協賛種別のスキーマ変更、CMS 取得失敗時の分岐、再検証方針の置き場所といった、デザインが決まっても変わらない部分を書く。色・余白・タイポグラフィ・レイアウトの詳細は一切書かない。

各デザイン単位のセクションは、現時点では「どのファイルが責務を持つか」「データがどこから来るか」に限って記述する。デザインが起きた単位から、そのセクションへ設計を追記していく。

### Goals

- ナビゲーション項目定義を表示部品から切り離し、ヘッダー・ハンバーガーメニュー・フッター・下部ナビゲーション・MapMenuButton の 5 箇所が同一の定義を参照する状態にする
- `sponsors.type` を複数選択へ変更し、広告協賛一覧を実装できる取得層を用意する
- CMS の一部取得失敗がページ全体の非表示につながる現状の分岐を、領域単位の縮退へ置き換える
- 各デザイン単位について、デザイン確定後に追記するだけで実装へ進める構造を定義する

### Non-Goals

- 本 spec が扱う 15 のデザイン単位のビジュアルデザインの決定 — Figma でのデザイン作成時に確定する
- Figma フレームの作成作業そのもの
- 色・タイポグラフィのトークン自体の再定義 — `frontend/tailwind.config.ts` と `globals.css` を正とする
- `topics` / `announcements` の CMS データモデル変更
- 企画一覧・企画詳細ページ本体 (`exhibition-pages`)、構内マップの地図本体 (`campus-map`)、タイムテーブル (`timetable-page`)、サイネージ (`digital-signage`)、駐車場空き状況 (`parking-availability`)
- 固定ページ (アクセス・お問い合わせ・プライバシーポリシー等) の本文デザイン
- 地域協賛一覧ページ本体 — ヘッダー・トップページ・フッターからの導線は本 spec が持つが、遷移先のページは扱わない

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
├── breakpoints.ts           # PC / SP 境界の単一定義 (要件 19.2)
└── use-motion-preference.ts # サイト全体のモーション再生/停止の状態 (localStorage 保存・OS 設定へのフォールバック)。background-shapes.tsx・hero-section.tsx 等の JS 制御アニメーションから参照する (要件 19.5〜19.8)

frontend/src/components/
├── bottom-navigation.tsx      # 下部ナビゲーション (要件 8)
├── background-shapes.tsx      # 背景の図形装飾 (要件 22)
└── motion-toggle.tsx          # モーション再生/停止の切替ボタン (`'use client'`)。フッターに置く (要件 19.5、9、10)

frontend/src/app/(site)/sponsors/
└── page.tsx                 # 広告協賛一覧 (ルート構成は未確定。下記 Requirement 12 参照)

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
- `frontend/src/components/footer.tsx` — `footerNavigation` を廃し `lib/navigation.ts` を参照する。`components/motion-toggle.tsx` のインスタンスを埋め込む (要件 9、10)
- `frontend/src/components/campus-map/map-menu-button.tsx` — import 元を `lib/navigation.ts` へ差し替える
- `frontend/src/app/(site)/layout.tsx` — 下部ナビゲーションを追加する。外側のコンテナ要素を追加し、背景の図形装飾 (要件 22) を敷く
- `frontend/tailwind.config.ts` — 背景の図形装飾専用の色トークン `bansai-*` (要件 22) を `theme.extend.colors` へ追加する
- `frontend/src/app/globals.css` — `motion-reduce` variant を `@custom-variant` で再定義し、`prefers-reduced-motion: reduce` と `<html data-motion="reduce">` のいずれかで発火するようにする (要件 19.4〜19.8)
- `frontend/src/app/layout.tsx` — hydration 前に `localStorage` (無ければ `matchMedia`) を評価して `<html data-motion>` を設定するインラインスクリプトを `<head>` に追加する (要件 19.7)
- `frontend/src/components/icons.tsx` — `pause` / `play_arrow` (Material Symbols Sharp weight 300) を追加する (要件 19.5)
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
- 下部ナビゲーション (Requirement 8) の項目は `navigationItems` とは別の export として定義する。ヘッダーに存在しない「ホーム」を含み、アイコンという表示箇所固有の情報を持つため、`navigationItems` に表示箇所のフラグを足す形は採らない。両者は同じ `href` を指す。

### Requirement 18: CMS 取得失敗時の振る舞いとキャッシュ方針

#### 領域単位の縮退

現状の `getHomePage` は `festival_meta` と `page_home` の取得失敗で throw し、`page.tsx` がそれを catch してページ本文全体を落とす。結果として `sr-only` の `h1` だけが残る。これは要件 18.2 が明示的に禁じる状態である。

`getHomePage` の戻り値を、領域ごとに欠落を表現できる形へ改める。

- `festival` / `theme` / `heroMessageHtml` を必須ではなく欠落しうる値として返す
- 一覧 (`sponsors` / `announcements` / `topics`) は現行どおり失敗を空配列へ倒す。ただし「0 件」と「取得失敗」を区別する必要がある広告協賛一覧 (要件 12.8) では、`lib/sponsors.ts` が `CmsResult` の失敗を空配列へ倒さずそのまま表示側へ渡す
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
- **ブレークポイント** (19.2): `frontend/src/lib/breakpoints.ts` に単一の定数として定義し、本 spec が扱う全デザイン単位でこれを用いる。境界は現行のヘッダーと同じ `lg` (1024px) を単一の値として用い、ヘッダーのナビゲーションを畳む幅と下部ナビゲーション (Requirement 8) を出す幅を一致させる。両者がずれると、ヘッダーのナビゲーションと下部ナビゲーションが同時に出る幅と、どちらも出ない幅が生まれるため。
- **フォーカス表示** (19.3): 既存コードが用いている `focus-visible` を基準とする。
- **モーションの抑制と切替** (19.4〜19.8): OS の `prefers-reduced-motion: reduce` と、フッターの `MotionToggle` (Requirement 9/10) のいずれか一方でも停止を求めていれば、自動再生される動きと遷移の演出を停止する。対象は本 spec が扱う全デザイン単位の動きで、ヒーローのスライドショーの自動送りとクロスフェード・ヘッダーの PC ドロップダウンとハンバーガーメニューの開閉・ナビゲーション項目のホバー下線・背景の図形装飾 (Requirement 22) の入場と揺れを含む。

  既存コードは Tailwind の `motion-reduce:` variant を基準にしている (`footer.tsx` の `HoverLine` が先行例)。この判定基準自体を拡張し、`frontend/src/app/globals.css` で `motion-reduce` variant を次のとおり再定義する。Tailwind v4 の既定 (`prefers-reduced-motion: reduce` のみ) を上書きし、`<html data-motion="reduce">` でも発火するようにする。

  ```css
  @custom-variant motion-reduce {
    @media (prefers-reduced-motion: reduce) {
      @slot;
    }
    &:is([data-motion="reduce"] *, [data-motion="reduce"]) {
      @slot;
    }
  }
  ```

  この再定義により、既存の `motion-reduce:` 利用箇所 (`hero-section.tsx` / `footer.tsx` / `header.tsx`) はコードを変更せずに `<html data-motion="reduce">` にも反応する。`data-motion="reduce"` 属性は切替が「停止」を示す間、`<html>` へ付与する。

  `setInterval` で自動送りするヒーローのスライドショーや、`requestAnimationFrame` で駆動する背景の図形装飾の揺れは CSS variant だけでは止まらないため、共有フック `frontend/src/lib/use-motion-preference.ts` (`components/use-background-motion.ts` から改名・移設。背景の図形装飾専用ではなく本 spec の全モーション共通のフックになったため `lib/` へ置く) が返す `reduced: boolean` を読み、`true` の間はタイマー/`requestAnimationFrame` を張らない。

  **切替 UI**: Figma コンポーネント `MotionToggle` (ページ「コンポーネント」、COMPONENT_SET `node-id=345:2601`、variant `State`=`playing` (`345:2593`) / `paused` (`345:2597`)) をフッターの著作権表示と同じ行 (PC) または著作権表示の直上 (SP) に置く (Requirement 9/10 参照)。ファイルは `frontend/src/components/motion-toggle.tsx` (`'use client'`)。`<button aria-pressed>` のトグルボタンとして実装し、アクセシブルネームは状態によらず「モーション」で固定する (可視ラベルも同じく「モーション」で固定し、状態はアイコンのみで表す)。`aria-pressed` は再生中 (`playing`) で `true`、停止中 (`paused`) で `false` とする。アイコンは `components/icons.tsx` の方式でインライン化した `pause` (再生中に表示、押すと止める) / `play_arrow` (停止中に表示、押すと再生する) を使う。パスは Material Symbols Sharp weight 300・24px の配布 SVG (`google/material-design-icons` リポジトリの `symbols/web/pause/materialsymbolssharp/pause_wght300_24px.svg`、`play_arrow` も同型のパス) をそのまま用いる。アイコン色は `color/gray-500` とし、フッター内の他のアイコン (`location_on` / `mail` / `open_in_new`) と揃える。

  **見た目**: 押せる部品として見えるよう、角丸いっぱい (pill、`cornerRadius: 9999`) の枠付きボタンとする。fill は `color/background`、stroke は `color/gray-500` 1px (INSIDE)。`FacetChip` (`2:107`) / `SearchField` (`2:212`) と同じ「fill = `color/background`・stroke 1px INSIDE」の作りに揃え、stroke の色だけ `color/gray-500` にする。新しいフッターの地 (`color/background` に `color/bansai-sage` を 18% で重ねた色、実測 `#edece3` 相当) に対し `color/gray-200` はコントラスト比 1.07 で WCAG 1.4.11 (非テキスト 3:1) を満たさず、`color/gray-500` は 4.05:1 で満たすため。padding は上下 4px・左右 12px、アイコンとラベルの間隔は 4px (変更なし)、見た目の高さは 32px。タップ領域 44px 以上は、この 32px の外側に実装側で見えない padding (擬似要素等) を足して確保する。
  **ホバー**: Figma 上に hover variant は持たない (`FacetChip` / `SearchField` も持たない)。実装では fill を `color/gray-100` に変える。
  **フォーカス表示**: Requirement 19 (19.3) の `focus-visible` に従う。

  **状態の保存** (19.6): 切替の状態を `localStorage` に保存し、再訪時に引き継ぐ。

  **既定値** (19.7): 状態が保存されていない場合は `window.matchMedia('(prefers-reduced-motion: reduce)')` の評価に従う。

  **初回描画でのちらつき回避**: 保存された状態 (または OS 設定) を `<html data-motion>` へ反映する処理は、React の hydration より前に同期的に行う必要がある。`frontend/src/app/layout.tsx` の `<head>` 内にインラインスクリプト (`<script dangerouslySetInnerHTML>`) を置き、`localStorage` → 無ければ `matchMedia` の順に評価して `document.documentElement.dataset.motion = 'reduce'` を設定する。
- **横スクロール** (19.9): スマートフォン相当の画面幅で本文に横スクロールを発生させない。
- **アイコン**: Google Fonts が配布する Material Symbols (Sharp、weight 300) を正とする。`icon/chevron_down` は `expand_more` の配布 SVG をそのまま取り込んだものである。`frontend/src/components/icons.tsx` は現在「Material Symbols Sharp (weight 300) の SVG を使用分だけインライン化する。フォント/CDN を読み込まないのは Edge ランタイムと初回表示コストのため」という方針のコメントを持つが、実際のパスは配布物と一致しない (`ChevronRightIcon` は Sharp wght200 と wght300 の中間の線幅を持ち、Sharp / Outlined / Rounded × wght100〜500 × grad 各種のいずれとも一致しない)。Figma の `icon/*` も同様に配布物と不一致であるため、Figma・コードの双方を配布 SVG から取り直したものへ移行し、`icons.tsx` の方針コメントを Google Fonts の埋め込みを用いる方針へ改める。SNS 各社のブランドアイコン (`brand-*`) は Material Symbols に存在しないため、この移行の対象外とし現状の実装を維持する。

#### 未確定

- Figma Foundations に写されているトークン (色 14 件・タイポ 9 件) で本 spec の全画面をまかなえるか、不足するトークンがあるか。Requirement 1 の実測で判明した事実: `color/background` (`#FBF8F3`) は `tailwind.config.ts` と一致した。一方 Foundations には `gray-300` / `gray-600` / `gray-700` / `gray-800` が存在せず、コード側の `text-gray-600` (お知らせの日付) や `text-gray-700` (表ヘッダー) に対応するトークンがない。また `about-section.tsx` と `hero-section.tsx` は `text-slate-950` / `text-slate-700` / `text-slate-500` という別系統のグレースケールを用いており、Foundations にも `tailwind.config.ts` の gray スケールにも一致しない。この不一致は本 spec のトップページ作り直しで解消される範囲であり、残り 14 単位についても同様の確認が必要かどうかは未確定のまま残る。 Requirement 8 の実測で判明した事実: 下部ナビゲーションのラベルに 10px が必要となり、Foundations の既存タイポトークンの最小が `body/sm` (14px) であったため、`body/xs` (10px) を Foundations とコード側の双方へ追加する。

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

### Requirement 22: 背景の図形装飾

#### 色トークン

`frontend/tailwind.config.ts` の `theme.extend.colors` へ、背景装飾の図形専用の色トークンを追加する。文字色や他の UI 部品には用いない (要件 22.4)。ただし `bansai-sage` は例外で、背景装飾の図形に加えてフッターの地 (Requirement 9/10 参照) にも用いる。Figma Foundations には `color/bansai-*` として同じ値を写す。

| トークン名 | 値 | 由来 |
|---|---|---|
| `bansai-ochre` | `#E4AB53` | 黄土 |
| `bansai-olive` | `#C9BF86` | オリーブ |
| `bansai-sage` | `#AEB49C` | セージ |
| `bansai-salmon` | `#DD9B8C` | サーモン |
| `bansai-rose` | `#E0666D` | ローズ |
| `bansai-wisteria` | `#D2C6DA` | 藤 |
| `bansai-aqua` | `#A2C2C6` | 水色 |

Requirement 19 (19.1) の「色とタイポグラフィをトークンから用いる」は本トークンにも適用され、コンポーネント側に色値を直接書かない。

#### 配置先

`frontend/src/app/(site)/layout.tsx` が `Header` と `Footer` を巻く構造であるため (Architecture 節参照)、背景装飾はこの層に置くことで `(fullscreen)/map` を自然に除外できる (要件 22.2)。配置範囲はヘッダーと本文のみとし、フッターの地には図形を配置しない (要件 22.1)。フッターの地は Requirement 9/10 が定める色面 (`color/background` に `bansai-sage` を重ねた面) が単独で担う。図形はセクション境界で切らない。ページ (ヘッダー・本文) 全体を 1 つの装飾レイヤーとして図形を配置し、切れてよいのはページ左右端のみとする (要件 22.9)。個々のセクションの frame は `fills` を持たず透過とし、地の色はルートフレームの `color/background` のみが担う (写真など color/background 以外の fill を持つ領域には図形を配置しない除外領域として扱う)。

新規ファイル `frontend/src/components/background-shapes.tsx`。現行の `SiteLayout` はラップ要素を持たない Fragment (`<><Header/><div>...</div><Footer/></>`) であるため、装飾レイヤーを敷くために外側のコンテナ要素を追加する。

ヘッダーは画面上端に固定表示し、スクロールしても高さ・背景の見え方を変えない (Requirement 5、要件 5.12)。本文・フッターに連動してスクロールする 1 枚の装飾レイヤーでは、ヘッダー背後の図形もスクロールに応じて動いてしまい、この要件と両立しない。ヘッダー領域の図形と、本文・フッター領域の図形は別レイヤーとして扱う必要がある。

Figma では、図形 1 つぶんの見た目を共通コンポーネント `BgShape` としてページ「コンポーネント」に定義し、各ページフレーム直下・全セクションより背面に `BackgroundShapes` を 1 つだけ配置する (セクションごとに分割しない)。

#### 個数・サイズ・配置の具体値

図形の個数は、PC では 1 ページ全体の高さ 110px あたり 1 個、SP ではその 0.7 倍とし、1 ページあたり 4 個を下限とする (最小間隔と除外領域の制約により、狭い画面では実際の個数が目標値を下回ることがある)。サイズは一辺 22px から 104px の範囲で決定する。

配置はページ (ヘッダー・本文) 全体を 1 つの領域として行い、セクションごとに個数を配分しない。決定的乱数でページ全体の座標を試行し、既に置いた図形との中心間隔 (70px に両図形の一辺の長さの合計の 4 分の 1 を加えた距離以上、回転前のサイズで判定) と、除外領域 (本文・ナビゲーション・ボタン・入力欄などの操作要素の外側 10px。写真など color/background 以外の fill を持つセクションがあればその全体、およびフッターの地を含む) のいずれにも抵触しなければ採用する reject sampling (ダーツ投げ法) を用いる。座標はページ左右端に対して図形の一辺の 0.3 倍のはみ出しを許容する範囲で試行し、上下端はページ (フレーム) の `clipsContent` によって自然に切れる。試行回数は個数の 60 倍を上限とし、上限に達した時点でそれまでに配置できた図形数で確定する。

図形ごとに、配置 (サイズ・座標・種類・質感・色) と同じ決定的乱数列から続けて 0 度から 359 度の回転を整数で引き、図形の中心を軸に回転させる (要件 22.27)。除外領域・フッターとの重なり判定は、回転前の size×size の矩形ではなく回転後の軸並行外接矩形 (AABB、一辺 `size * (|cos θ| + |sin θ|)`) を用いる (要件 22.28)。入場アニメーション (要件 22.15) やばねの揺れ (要件 22.19〜22.23) は位置のみを変化させる `translate` 系の transform であり、`rotate` はこれらと合成されたまま図形ごとに固定で保持される。

#### 配置の決定方法

図形の配置と質感の割り当ては、ページのパス (`pathname`) を種とした決定的乱数で行い、同一ページでは常に同じ結果を SSR とクライアントの双方で描画する。`exhibition-pages` の企画カードが企画名を種とした決定的乱数 (FNV-1a 32bit ハッシュ → mulberry32) でグラデーションを決定している方式 (`.kiro/specs/exhibition-pages/design.md`) と同じ方式を用いる。

#### 質感

図形ごとに、質感なし・粒状ノイズ・網点・雲状むらの 4 種から配置と同じ決定的乱数で質感を割り当てる。質感なしの出現確率は他の質感それぞれの 2 倍とする (5 枠中、質感なし 2、粒状ノイズ・網点・雲状むらを各 1)。リング (輪) には質感を割り当てない。

#### 動き

**入場 (初回集約)**: 図形がそのページの表示中に初めて画面に入ったとき、定位置からセクション中心と反対方向へ 40px から 120px ずれた位置を起点に、1 秒 (`cubic-bezier(0.16, 0.84, 0.44, 1)`) かけて定位置へ移動する。判定には IntersectionObserver (`threshold: 0.15`) を用い、図形ごとに交差を検知した時点で個別にアニメーションを開始するため、ページ全体で見たときのずらしは画面へ入るタイミングの違いによって生じる。1 図形につき 1 回限りで、発火後は observe を解除し、画面外へ出ても定位置は変えない。

リング (輪) は 2 つの輪を 1 組とし、それぞれ別方向 (基準の角度からおよそ ±0.7rad ばらけた、ほぼ反対の方向) の起点 (40px から 120px) から寄せる。2 つ目の輪は 1 つ目に 0.1 秒遅れて追従し、定位置では 1 つ目からの相対位置を (7px, 6px) ずらして少し重なった二重の輪として静止する。

**入場後の静止と揺れ**: 入場を終えた図形は時間経過では動かない。ポインター操作またはスクロールの入力がある間だけ、定位置を原点としたばね (剛性 70〜130、減衰係数 10〜16 を図形ごとにばらつかせる) で変位を計算し `translate` へ反映する。入力が止まると同じばねが変位を 0 へ収束させ (軽いオーバーシュートを伴う)、変位・速度がいずれも 0.05 を下回ったら完全に静止させて描画ループ (`requestAnimationFrame`) を止める。

**ポインター反発**: ポインターが動いている間 (最後の `pointermove` から 120ms 以内)、図形ごとの反発半径 (120px から 180px) の内側にある図形へ、ポインターから遠ざかる向きの加速度 (最接近点で最大 1600、半径の境界で 0 へ線形に減衰) を与える。タッチ端末では `pointermove` によるこの反発は行わず、スクロールによる揺れのみが働く。

**スクロール慣性**: スクロール量 (px) に図形ごとの係数 (0.5〜1.3) と全体係数 2.4 を掛けた値を速度へ加算し、下方向のスクロールでは図形を相対的に上へ取り残す向きに、慣性で遅れて追従させる。

**共通**: 変位は図形ごとの上限 (8px から 16px) でクランプする。動かすのは `transform` 系のプロパティ (`translate`) のみとし、画面外 (ビューポート上下 60px の余白を超えた範囲) にある図形は計算を省く。1 フレームあたりの経過時間は 50ms を上限としてクランプする。

**オン・オフ切替**: 背景の図形装飾の動きは Requirement 19 のモーション切替 (`MotionToggle`、19.5〜19.8) とモーションの抑制設定 (19.4) に従う。背景の図形装飾専用の切替は持たない。

### 開催前フェーズで公開が必要になるパス

Requirement 5 が定める開催前フェーズのヘッダーは、本 spec が新設する次のページへの導線を持つ。これらは `frontend/src/lib/phase.ts` の `PRE_EVENT_PUBLIC_PATHS` (`PRE_EVENT_PUBLIC_PREFIXES` を要するものはそちらにも) へ追加し、開催前フェーズで公開する。`festival-phase-gate` が所有する値への追加自体は本 spec の実装作業であり、同 spec 自体は変更しない。

- 固定ページ: ご来場の際の注意点 / 案内所・落とし物・迷子 / ごみの分別のお願い / よくある質問 (ルートは未確定)
- `/contact` (お問い合わせ)
- 広告協賛一覧ページ (ルートは Requirement 12 で未確定)

## デザイン単位ごとの設計

以下 15 単位は、ビジュアルデザインが未定のため、現時点で確定している構造面の方針のみを記す。各単位のデザインが起きた時点で、このセクションへ設計を追記する。

### Requirement 1: トップページ 開催前フェーズ (PC)

Figma: ファイル `0kWDqHsLr6xE8b4FFgR1Zx`、ページ「トップページ」、フレーム「トップページ (開催前) / PC (1440)」(`node-id=107:3`)。

セクションは Hero (`107:4`) → 荒牧祭とは (`119:3`) → お知らせ (`107:6`) の 3 つのみで構成する (要件 1.6)。

- **Hero**: 背景に画像スライドショー (プレースホルダ画像 + スライドインジケーター) とグラデーションスクリムを敷き、その上に左右 2 ブロックを乗せる。
  - 左ブロック: 見出し「群馬大学 荒牧祭」(固定文言、CMS に依存しない) の下に、開催日 (`festival_meta.event_days`) ｜ 会場 (`festival_meta.venue_name`) を 1 行で表示する (要件 1.1)
  - 右ブロック: テーマ (`festival_meta.theme_word`) の下に、開催までの残り日数のカウントダウン (要件 1.2, 1.3) を表示する。カウントダウンの算出は横断的要件 Requirement 20 が定める `event_days.start_at` に依存する
  - `components/hero-section.tsx` の自動送り (6 秒間隔)・クロスフェード・矢印ボタン・スライドインジケーターは現行のまま残す (要件 1.10, 1.11)。ズームのキーフレーム (`aramakisai-hero-zoom` と、それを適用する `.aramakisai-hero-image--active` の `animation` 指定) と、SCROLL の文字・縦線一式 (`aramakisai-scroll-line` を含む要素) は削除する (要件 1.12, 1.13)
  - 高さは `78svh` (ビューポート高の 78%) を PC・SP 共通の基準とする (要件 1.14)。単位は `vh` ではなく `svh` (small viewport height) を用いる。モバイルブラウザで URL バーの表示・非表示により実効ビューポート高が変動しても、`svh` は変動しない最小値を基準にするため高さが動かない。`lg:h-[calc(100vh-5rem)] lg:min-h-[30rem]` という PC 専用の上書きは削除する。`min-h-[28rem]` という下限は、`78svh` の値とは独立に、極端に低いビューポートでもヒーローが著しく縮まないための実装上の安全策として残す。クロスフェードの `motion-reduce:transition-none` に加え、`setInterval` による自動送り自体を `lib/use-motion-preference.ts` の `reduced` が `true` の間は開始しない。動きを止める条件 (OS のモーションの抑制設定とモーション切替のいずれか) は Requirement 19 (19.4〜19.8) の定めに従う
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

Figma: ファイル `0kWDqHsLr6xE8b4FFgR1Zx`、ページ「トップページ」、フレーム「トップページ (開催中) / PC (1440)」(`node-id=154:48`)。

セクションは上から Hero (`154:49`) → トピック (`155:54`) → 主要導線「会場で使う」(`155:734`) → 企画 (`156:49`) → お知らせ (`156:751`) → 荒牧祭とは (`156:783`) → アクセス (`156:786`) → 協賛 (`156:798`) の 8 つで構成する。ファイル構成とデータ取得は Requirement 1 と同一の方針に従い、フェーズごとの出し分けは `festival-phase-gate` に従う。

- **Hero**: 高さは `50svh` (ビューポート高の 50%) とする (要件 3.9)。`svh` を用いる理由と `min-h` による下限の考え方は Requirement 1 (要件 1.14) と同一。参照ビューポート高 900px での参考値は 450px。背景は画像スライドショーのプレースホルダ + 黒のグラデーションスクリム (下端に向かって不透明度 55% まで上がる) + スライドインジケーター。重ねる要素は上から見出し「群馬大学 荒牧祭」(固定文言、44px) → テーマ (`festival_meta.theme_word`、88px) → メタ情報「開催日 (`festival_meta.event_days`) ｜ 会場 (`festival_meta.venue_name`)」の 1 行の順で、すべて左揃え・白抜きとする。テーマは見出しの 2 倍のサイズとし Hero 内で最大の要素にする。「開催日：」のようなラベルは付けない。`page_home.hero_message_html` は表示しない (要件 3.1)。開催までの残り日数のカウントダウンと、画像スライドの手動切替 (前後の矢印ボタン) は持たない。前者は開催中に残り日数が意味を持たないため、後者は Requirement 1 (要件 1.11) と異なりスライドショーが装飾に徹するため
- **トピック**: 見出し「トピック」(`SectionHeading` の `h2`) の下に、Figma コンポーネント `TopicCard` (ページ「コンポーネント」、`node-id=166:113`、単体 COMPONENT + `Title` の TEXT プロパティ。構成は Requirement 14 参照) のインスタンスを 4 枚、カード幅 302px・gap 24px (`spacing/6`) で横並びする (要件 3.5)。企画セクションの `ExhibitionCard` 4 枚、および `/topics` の 4 列と同じ寸法で、302×4 + 24×3 = 1280 でコンテンツ枠の幅と一致する。末尾に「トピック一覧へ」(`/topics`) を添える。0 件のときはセクションごと非表示にする (要件 3.6)。表示部品は既存の `components/topics-list.tsx` / `topic-card.tsx` を起点に改める
- **主要導線「会場で使う」**: 見出し「会場で使う」の下に、Figma コンポーネント `PrimaryNavCard` (COMPONENT_SET、`node-id=181:130`、`Destination` variant) のインスタンスを `exhibitions` / `map` / `timetable` / `parking` の 4 種類、カード幅 302px・gap 24px で 4 列横並びする。遷移先は企画一覧 (`/exhibitions`)・構内マップ (`/map`)・タイムテーブル (未実装、`timetable-page` が扱う)・駐車場空き情報 (未実装、`parking-availability` が扱う) で、この 4 つへの導線を持つことで要件 3.2 を満たす。バリアントが `exhibitions` / `map` / `timetable` / `parking` の固定 4 種であるため、`CategoryBadge` (`2:106`) と同じ COMPONENT_SET + variant の作りに揃える。アイコンは `components/icons.tsx` の方式 (Material Symbols Sharp weight 300 の SVG を使用分だけインライン化) に揃え、`festival` / `map` / `calendar_clock` / `parking_sign` を追加する。アイコンの色は `color/text` とする (カード背景に淡い色が乗るため、トークン色のままだと背景に埋没する)。カード背景は各バリアントのトークン色 (`exhibitions`→`primary` / `map`→`secondary` / `timetable`→`info` / `parking`→`accent`) を `color/background` に 18% で重ねた濃度とし、stroke `color/gray-200` 1px・角丸 `radius/md` でカード全体を 1 つの面として扱う
- **企画**: 見出し「企画」(固定文言) の下に、既存コンポーネント `SearchField` (`node-id=2:212`) のインスタンス (幅 480px、プレースホルダはマスターの「企画名・団体名で検索」をそのまま使い上書きしない) を置く。送信時に `/exhibitions` へクエリを渡して遷移させるだけの単純な入力とし、トップページ内では絞り込まない (要件 3.2 の検索導線)。`lib/exhibitions.ts` の `buildExhibitionsHref` で URL を組み立てる点は `components/exhibition-filters.tsx` (`/exhibitions` ページ側の即時絞り込み) と共通化できるが、送信時にのみ遷移する点で同コンポーネントの挙動とは異なるため、別の新規コンポーネントとする。その下にランダムに選んだ企画を、既存コンポーネント `ExhibitionCard` (`node-id=2:139`、`Image=true, State=Default`) のインスタンス (`components/exhibition-card.tsx`) で 4 枚、カード幅 302px・gap 24px (企画一覧 PC `2:217` の `CardGrid` と同じ寸法) で横並びし、末尾に「企画一覧へ」(`/exhibitions`) を添える
- **お知らせ**: 見出し「お知らせ」の下に、既存コンポーネント `NoticeItem` (`node-id=127:108`) のインスタンスを 5 件、幅はインスタンス側の FILL で吸収して並べ、「お知らせ一覧へ」(`/announcements`) を添える (要件 3.4)。表示部品は Requirement 1 と同じ `components/announcements-list.tsx` の `limit` prop を使う
- **荒牧祭とは**: 見出し「荒牧祭とは」(固定文言) と概要文 (`festival_meta.overview_html`) を表示する (要件 3.7)。`festival_meta.name` は本文に表示しない (要件 3.10)。Requirement 1 (要件 1.8) と同じ扱い
- **アクセス**: 見出し「アクセス」の下に、地図のプレースホルダ (720×320) を左、アクセス情報のテキスト (536px、上下中央揃え) を右に gap 24px で並べ、末尾に「アクセス詳細へ」(`/access`) を添える (要件 3.8)。地図は実際の地図タイルの見た目を模写せず、プレースホルダとして扱う
- **協賛**: 見出し「協賛」の下に、協賛ロゴのプレースホルダを 4 枚、4 列で表示し、「広告協賛へ」「地域協賛へ」の 2 つの導線を添える (要件 3.3)。広告協賛一覧と地域協賛一覧が別ページのため 2 つに分ける。「広告協賛へ」の遷移先ルートは Requirement 12 のページ構成が未確定のため未確定、「地域協賛へ」の遷移先ページは本 spec の対象外。全件は各一覧ページ側で見せ、トップページではロゴ数枚に留める

見出しは Figma コンポーネント `SectionHeading` (COMPONENT_SET、`node-id=208:118`、`Level` variant: `h1` 44px / `h2` 32px / `h3` 24px / `h4` 20px、`Heading` の TEXT プロパティ) のインスタンスで、上記 7 セクションの見出しはすべて `h2` を使う。このコンポーネントは開催前トップ・企画一覧・企画詳細のセクション見出しにも適用する。

セクションの背景色はルートフレームの `color/background` のみが持ち、配下のセクション・カード・行は fill を持たず透過させる。カードの境界は `color/gray-200` 1px の stroke で作る。`FacetChip` (`2:107`) や `SearchField` (`2:212`) が「地と同色の fill + gray-200 の stroke」で境界を作る作りに揃えている。余白は auto-layout の itemSpacing / padding で制御し、座標の手計算に依存しない。セクション上下 padding は 48px (`spacing/12`)、見出しと本文の間隔は 24px (`spacing/6`) を基準とする。寸法・余白・色は既存の variable にバインドする (要件 19.1)。

### Requirement 4: トップページ 開催中フェーズ (SP)

Figma: ファイル `0kWDqHsLr6xE8b4FFgR1Zx`、ページ「トップページ」、フレーム「トップページ (開催中) / SP (390)」(`node-id=158:107`)。

- Requirement 3 と同一のコンポーネントがレスポンシブに対応する。SP 専用のページ・ルートは作らない。
- フレーム幅 390px、左右パディング 16px (コンテンツ幅 358px) は Requirement 2 で確定した値と同じ基準を用いる (Requirement 19 参照)。
- セクション構成は Requirement 3 と同じ 8 つ (Hero `158:108` → トピック `159:107` → 主要導線 `160:108` → 企画 `160:125` → お知らせ `160:828` → 荒牧祭とは `160:861` → アクセス `161:161` → 協賛 `161:173`)。この下に下部ナビゲーション回避のための余白を表す Figma 上のフレーム (`161:191`) があるが、これは構図上の表現であり、実装は次項の通り `(site)/layout.tsx` 側で与える。
- **Hero**: 高さは Requirement 3 (要件 3.9) と共通の `50svh` を用いる。Figma 上の 422px は参照ビューポート高 844px での参考値。要件 4.2 (「ヒーロー画像を表示領域に対して崩れのない形で表示する」) はこの高さの基準で満たされるため、SP 側に別の数値を持つ受入基準は追加しない。Requirement 1 / 2 の対と同じ構成で、数値は PC 側の要件 (要件 3.9) が持ち、SP はそれを参照する。重ねる要素 (`HeroContentColumn`、`node-id=158:117`) は見出し「群馬大学 荒牧祭」(32px) → 開催日 (`festival_meta.event_days`) → 会場 (`festival_meta.venue_name`) → テーマ (`festival_meta.theme_word`、64px) の順で縦に積み、PC (`HeroContent`、`node-id=154:58`。見出し (44px) → テーマ (88px) → メタ情報 1 行) とは並び順が異なる。PC の「開催日｜会場」の 1 行区切り表記はコンテンツ幅 358px には収まらず開催日・会場を別行に分ける必要があり、PC の並び (見出し→テーマ→メタ情報 1 行) をそのまま縦に積めないため、テーマをメタ情報より後ろへ送っている。テーマが見出しの 2 倍のサイズで Hero 内最大の要素になる関係は PC と共通だが、画面幅に対して PC と同じ絶対値では大きすぎるため、見出し 32px・テーマ 64px と PC より縮小する
- **トピック**: 横スクロールに変える。カード幅 260px、gap 24px (`spacing/6`)
- **主要導線「会場で使う」**: 2 列 × 2 行。カード幅 171px、gap 16px
- **企画**: `SearchField` の幅は 358px。`ExhibitionCard` は横スクロールで 3 枚、カード幅 280px、gap 24px
- **お知らせ・荒牧祭とは**: PC と同じ内容・同じコンポーネントをそのまま使う
- **アクセス**: 地図プレースホルダとテキストを 1 カラムに縦積みする (PC は横並び)
- **協賛**: ロゴを 2 列 × 2 行で表示する
- 下部ナビゲーションに隠れない余白 (要件 4.3) は、個々のセクションではなく `(site)/layout.tsx` のコンテンツ領域に下端余白を与えて確保する。下部ナビゲーションの高さ 64px (Requirement 8) と `env(safe-area-inset-bottom)` を足した値を用いる。この手当ては Requirement 2 (要件 2.5、開催前フェーズでは余白を設けない) と同じ仕組みを、開催中フェーズでは逆に余白を与える形で使う。

### Requirement 5: サイト共通ヘッダー (PC)

Figma: ファイル `0kWDqHsLr6xE8b4FFgR1Zx`、ページ「コンポーネント」(`2:2`)。コンポーネント `Header` (COMPONENT_SET、`232:956`、variant `Device`=`PC`/`SP` × `Phase`=`before`/`during`)。PC/during `231:112`、PC/before `232:115`。ドロップダウンを開いた状態は `233:118` (during) / `256:1161` (before)。現在地の下線色一覧は参照用フレーム `247:206`。

- ファイル: `frontend/src/components/header.tsx` (`'use client'`)。`(site)/layout.tsx` が巻くため、要件 5.13 は現行構造で満たされる。
- ナビゲーション項目は `lib/navigation.ts` から受ける (Requirement 17)。間引きコメント (`header.tsx:17`) を削除する。定義は次の表のとおりで、フェーズによる差を `lib/navigation.ts` 側で持つか表示側で絞るかは Requirement 17 の未確定事項に従う。

  | フェーズ | 順 | ラベル | 遷移先 | 子項目 |
  |---|---|---|---|---|
  | during | 1 | 企画一覧 | `/exhibitions` | なし |
  | during | 2 | 構内マップ | `/map` | なし |
  | during | 3 | タイムテーブル | 未実装 (`timetable-page`) | なし |
  | during | 4 | お知らせ | — (子項目のみ) | お知らせ一覧 `/announcements` / トピック `/topics` |
  | during | 5 | ご案内 | — (子項目のみ) | アクセス `/access` / ご来場の際の注意点 / 案内所・落とし物・迷子 / ごみの分別のお願い / よくある質問 / お問い合わせ `/contact` |
  | before | 1 | 荒牧祭について | `/#about` | なし |
  | before | 2 | お知らせ | `/announcements` | なし |
  | before | 3 | ご案内 | — (子項目のみ) | during と同一の 6 項目 |
  | before | 4 | 協賛 | — (子項目のみ) | 広告協賛 / 地域協賛 (ルート未確定。広告協賛は Requirement 12 参照、地域協賛の遷移先ページは本 spec の対象外) |

  「ご来場の際の注意点」「案内所・落とし物・迷子」「ごみの分別のお願い」「よくある質問」の 4 ページのルートは本 spec の対象外で未確定 (下記「開催前フェーズで公開が必要になるパス」参照)。
- during と before でナビゲーション項目の構成が異なるのは、`festival-phase-gate` の `PRE_EVENT_PUBLIC_PATHS` / `PRE_EVENT_PUBLIC_PREFIXES` (`frontend/src/lib/phase.ts`) が定める開催前フェーズの公開範囲による。企画一覧・構内マップ・トピックは開催前に 404 を返すため before のナビゲーションから外す (要件 5.3)。協賛は before のみ出し、during は当日導線 (企画・マップ等) を優先して外す。
- **現在地の表現** (要件 5.10, 5.11): `usePathname()` と `aria-current="page"` に加え、ラベル直下に厚さ 2px の下線を常時 100% の不透明度で表示する。下線色は親項目ごとに固定し、ラベルの文字色 (`color/text`) は変えない。企画一覧 `color/primary` / 構内マップ `color/secondary` / タイムテーブル `color/info` / お知らせ `color/warning` / ご案内 `color/success` / 荒牧祭について `color/accent-alt` / 協賛 `color/accent`。テキスト色を変えない理由は `color/secondary` (`#7fc8ad`) や `color/info` (`#80c1c6`) が地の `color/background` (`#fbf8f3`) に対してコントラスト比が不足するため。
- **上端固定** (要件 5.12): 現行の実装を維持する。地は `color/background` の不透明、下端に `color/gray-200` 1px の境界線。スクロールしても高さ・背景・境界線の見え方を変えない。
- **寸法**: 高さ 80px、左右 padding 80px (コンテンツ枠 1280px)。ロゴは左・ナビゲーションは右、ナビゲーション項目間は 32px。ロゴは `frontend/public/images/logo-2026.png` (1700×306、比率 5.556:1) を 222×40 で表示する (要件 5.14)。ラベルは `body/md`、色は `color/text`。
- **PC ドロップダウン** (要件 5.15): 幅 224px、地は `color/background`、stroke `color/gray-200` 1px。各行は `body/sm`、padding 12/16、行の高さ 44px 以上。親項目の水平中央に揃え、コンテンツ枠 (左 80px / 右 1360px) を越える場合は越える側の端をコンテンツ枠に合わせて止める。during の「ご案内」は 5 項目中最後 (中央 1326) のため中央揃えでは右端が 1438 となり 78px 超過するので右端を 1360 に止める (左端 1136)。before の「ご案内」は 4 項目中 3 番目 (中央 1242) のため中央揃えのまま左端 1130 / 右端 1354 に収まる。開閉のアニメーションは不透明度 0→1 と `translateY` -4px→0 を 200ms ease-out で行い、`motion-reduce:` (OS のモーションの抑制設定とモーション切替のいずれか、Requirement 19、19.4/19.8) で無効化する。
- **ホバー**: ナビ項目にカーソルを重ねると、その項目の色の下線が中央から左右へ (`scale-x` 0→1) 200ms ease-out で伸びると同時に不透明度が 0→80% になる。現在地の下線 (常時表示・不透明度 100%) と区別する。

**未確定**: 本文へ直接移動する手段 (スキップリンク) を置くかどうか。

### Requirement 6: サイト共通ヘッダー (SP)

Figma: `Header` (`232:956`) の SP/during (`232:942`) / SP/before (`232:949`)。

- Requirement 5 と同一コンポーネント内で、`lib/breakpoints.ts` の境界を用いて出し分ける。
- 非表示側を支援技術とキーボードから除外する (要件 6.4) ため、`hidden` によらず表示側のみを DOM に描くか、`hidden` 属性で除外する。現行の `lg:hidden` / `hidden lg:flex` による出し分けは、CSS の `display: none` で両者とも除外されるため要件を満たすが、境界定数への置き換えに合わせて見直す。
- セーフエリア (要件 6.3) は `env(safe-area-inset-top)` を用いる。
- **寸法**: 高さ 64px。ロゴは `frontend/public/images/logo-2026.png` を 178×32 で表示する (要件 6.5)。`Phase` による閉じた状態の見た目の差はない (要件 6.7)。
- **開閉ボタン**: 44×44 のタップ領域に、幅 24px・太さ 2px の横線 3 本を 8px 間隔で配置する (要件 6.6)。開いた状態では上下 2 本が ±45° 回転して中央で交差し、中央の 1 本の不透明度が 1→0 になる (要件 6.8)。200ms ease-out、`motion-reduce:` (OS のモーションの抑制設定とモーション切替のいずれか、Requirement 19、19.4/19.8) で無効化。
- **ハンバーガーメニューの併存** (要件 6.9): 開催中フェーズでも残す。下部ナビゲーション (Requirement 8) は当日の 5 導線に絞られ、お知らせ・ご案内・協賛への導線を持たないため。開催前フェーズでは下部ナビゲーションを表示しないため、いずれのフェーズでもハンバーガーメニューが必要となる。

### Requirement 7: ハンバーガーメニュー展開状態

Figma: `Header / SP Menu Open` (during `234:138` / before `256:256`)。

- 現行の `header.tsx:152-280` の開閉ボタンとドロップダウンを起点とする。開閉状態・子項目の開閉状態・Esc での復帰は現行実装が持っている。
- フォーカストラップ (要件 7.4) は現行のヘッダーには無く、`map-menu-button.tsx` が Tab のループ処理を持っている。両者で同じ処理を二重に書かないよう、フォーカストラップを共有のフックへ切り出して両方から使う。
- **展開形式** (要件 7.8): ヘッダー直下に展開するドロップダウン。全画面オーバーレイやサイドスライドは採らない。
- **行の見た目** (要件 7.9〜7.11): 各行の高さ 48px、行間に `color/gray-200` 1px の区切り線。子項目は 16px インデントし、左に `color/gray-200` 1px の縦線を添え、ラベルは `body/sm`。子を持つ項目の行の右端に chevron (`icon/chevron_down`) を置き、開閉状態を示す。
- **アニメーション** (要件 7.12, 7.13): 不透明度 0→1 と `translateY` -8px→0 を 200ms ease-out で行う。`motion-reduce:` (OS のモーションの抑制設定とモーション切替のいずれか、Requirement 19、19.4/19.8) で無効化する。

**未確定**: 背面の本文のスクロール抑止と読み上げ除外、外側クリックでの close、SNS をメニュー内に含めるか。

### Requirement 8: 下部ナビゲーション

Figma: ファイル `0kWDqHsLr6xE8b4FFgR1Zx`、ページ「コンポーネント」。コンポーネント `BottomNavigation` (`267:358`)。現在地の表現は参照用フレーム `BottomNavigation / Active States` (`270:1255`)。SP トップページ (開催中) (`158:107`) の下端にインスタンス (`271:734`) を置いている。

- 新規ファイル `frontend/src/components/bottom-navigation.tsx`。`(site)/layout.tsx` に置く。
- 表示はフェーズに依存し、開催中フェーズでのみ描画する (要件 8.1, 8.3)。開催前フェーズでは DOM に出さない。現在のフェーズをどう判定するかは `festival-phase-gate` が定めるため、本 spec はフェーズを受け取って描画を切り替えることのみを前提とする。
- **項目** (要件 8.8): 左から企画 (`/exhibitions`)・マップ (`/map`)・ホーム (`/`)・タイムテーブル (未実装、`timetable-page` が扱う)・駐車場 (未実装、`parking-availability` が扱う) の 5 つで、ホームを中央に置く。遷移先は Requirement 3 の主要導線カード `PrimaryNavCard` の 4 種にホームを加えたものと一致し、アイコンも同じものを用いる (`festival` / `map` / `home` / `calendar_clock` / `parking_sign`)。当日その場で参照する導線に絞っており、お知らせ・ご案内・協賛はヘッダーのハンバーガーメニューが受け持つ。
- **項目定義の持ち方** (要件 8.4): `lib/navigation.ts` に `navigationItems` とは別の export として下部ナビゲーション用の配列を置く (Requirement 17)。ヘッダーに存在しない「ホーム」を含み、かつアイコンという下部ナビゲーション固有の情報を持つため、`navigationItems` 側に表示箇所のフラグを足す形は採らない。両者は同じ `href` を指す。
- **寸法**: 高さ 64px。5 項目を等幅で並べ、フレーム幅 390px では 1 項目 78px となる。各項目はアイコン 24px とその下のラベル (`body/xs`、10px) で構成し、いずれも項目の水平中央に置く (要件 8.9)。ラベルを 10px とするのは、最長のラベル「タイムテーブル」7 文字が Noto Sans JP ではほぼ全角幅となり、`body/sm` (14px) では 98px、12px でも 84px となって 78px の項目幅に収まらないため。10px では 70px となり左右に 4px ずつ残る。項目全体 (78×64) がタップ領域となるため、ラベルを小さくしても操作対象は縮まない。 ラベルの文言も「企画」「マップ」「ホーム」「タイムテーブル」「駐車場」と、ヘッダーや主要導線カードの「企画一覧」「構内マップ」より短い語を用いる。同じ遷移先に別のラベルを当てることになるが、78px の項目幅に収めるためであり、アイコンと併記するため短くしても指す先は読み取れる。
- 地は `color/background` の不透明、上端に `color/gray-200` 1px の境界線。ヘッダーが下端に同じ線を持つのと対になる。
- **現在地の表現** (要件 8.7, 8.10, 8.11): 項目の上端に幅いっぱい・厚さ 2px のインジケーターを表示し、`usePathname()` と `aria-current="page"` を併せて用いる。色は項目ごとに固定で、企画 `color/primary` / マップ `color/secondary` / ホーム `color/accent-alt` / タイムテーブル `color/info` / 駐車場 `color/accent`。`PrimaryNavCard` のバリアントごとの色割当と揃えている。アイコンとラベルの色を `color/text` のまま変えない理由は Requirement 5 (要件 5.11) と同じ。
- **スクロール連動を持たない** (要件 8.12): 常時固定とする。下端固定バーを持つ既存の学園祭・イベントサイト (三田祭、出雲オロチフェス) も常時固定であり、スクロールに応じて隠す実装は、隠れている間の支援技術からの除外・フォーカス中の項目が画面外に出ないための手当て・`prefers-reduced-motion` の尊重を要する割に、64px の確保で得られる表示領域が小さい。
- **構内マップページでの非表示** (要件 8.13): `/map` は `(fullscreen)` ルートグループに属し `(site)/layout.tsx` を通らないため、下部ナビゲーションは構造上そこに現れない。同ページでは `MapMenuButton` (Requirement 11) がその役を担う。
- **ハンバーガーメニューとの併存**: 開催中フェーズでもヘッダーのハンバーガーメニューを残す (要件 6.9)。下部ナビゲーションが当日の 5 導線に絞られ、お知らせ・ご案内・協賛への導線を持たないため。
- PC 相当での除外 (要件 8.2) とセーフエリア (要件 8.5) は Requirement 6 / 19 と同じ手段を用いる。操作領域は `env(safe-area-inset-bottom)` の内側に収め、バーの地はその外側まで伸ばす。
- 本文・フッターとの重なり回避 (要件 8.6) は Requirement 4 の下端余白で担保する。下端余白は下部ナビゲーションの描画と同じ条件で与える。

### Requirement 9: フッター (PC)

Figma: ファイル `0kWDqHsLr6xE8b4FFgR1Zx`、ページ「コンポーネント」(`2:2`)。コンポーネント `Footer` (COMPONENT_SET、`291:1537`、variant `Device`=`PC`/`SP` × `Phase`=`before`/`during`)。PC/during `308:609`、PC/before `329:540` (いずれも 1440×595)。`Header` (`232:956`) と同じ variant 構成を採る。企画ページの各フレームの末尾にはこのコンポーネントのインスタンスを置いている。

- ファイル: `frontend/src/components/footer.tsx` (サーバーコンポーネント)。`(site)/layout.tsx` が巻くため要件 9.10 は現行構造で満たされる。
- サイト案内・ご案内ブロックは `footerNavigation` を廃して `lib/navigation.ts` から導出する (要件 9.2, 9.14)。
- SNS とお問い合わせの条件付き非表示 (要件 9.4, 9.6, 9.7) と取得失敗時の継続 (要件 9.9) は現行実装が満たしている。
- **構成** (要件 9.11〜9.13): 上から ナビゲーション (3 列) → 主催者情報と公式 SNS → 区切り線 → 著作権。ナビゲーションと主催者情報の間には区切り線を置かず、ブロック間の余白で分ける。ナビゲーションを主催者情報より先に置くのは、フッターでの利用頻度がナビゲーションの方が高いため。
- **地と外周**: 地は `color/background` の上に `color/bansai-sage` を不透明度 18% で重ねた色 (`bg-secondary/[.18]` ではなく `bg-bansai-sage/[.18]` を `color/background` の上に重ねる形で表す。新しい色トークンは追加しない)。`PrimaryNavCard` (`181:130`) のバリアント背景と同じ「トークン色を `color/background` に 18% で重ねる」作りだが、フッターは実装上も 2 層のまま重ねて表現する。上端の境界線は置かない。ヘッダーとの境界はこの地の色の切り替わりで作る。内容はフレームの水平中央に寄せ、左端 x = 208・右端 x = 1232 の幅 1024px (Tailwind の `max-w-5xl`) に収める。
- **上段のナビゲーション**: 左から サイト案内・ご案内・サポート の 3 列。各列の幅はその列の最長ラベルの幅とし、1024px の中で列同士の間隔を均等に配分する (サイト案内の左端 = 208、サポートの最長ラベルの右端 = 1232)。列幅を揃えて間隔を固定すると、列ごとの文字幅の違い (約 97 / 154 / 140px) がそのまま見かけの余白の差になるため。during の実測では列間はいずれも約 318px。
  - during — サイト案内: 企画一覧 / 構内マップ / タイムテーブル / お知らせ一覧 / トピック。ご案内: アクセス / ご来場の際の注意点 / 案内所・落とし物・迷子 / ごみの分別のお願い / よくある質問
  - before — サイト案内: 荒牧祭について / お知らせ / 広告協賛 / 地域協賛。ご案内は during と同じ
  - サポート (共通): お問い合わせ (外部フォームのため `open_in_new` を添える) / プライバシーポリシー
  - ヘッダーの「ご案内」の子項目をそのままご案内ブロックとし、それ以外をサイト案内に置く (要件 9.14)。ヘッダーで「ご案内」の子であるお問い合わせはサポートにのみ置く (要件 9.15)。
  - ラベルは折り返さない (要件 9.19)。
- **下段**: 左端 (x = 208) に主催者情報、右端 (x = 1232 に右揃え) に公式 SNS (要件 9.13)。公式 SNS は見出し・アイコン列の両方を右揃えにする。主催者情報の左端はサイト案内の左端に、公式 SNS の右端はサポートの文字の右端に揃える。
  - 主催者情報 (要件 9.5, 9.16): ロゴ (`frontend/public/images/logo-2026.png` を 122×22) → 実行委員会名称 (`label/bold`・`color/text`) → 所在地 3 行 (`body/sm`) → メールアドレス。所在地とメールには `location_on` / `mail` を添える (要件 9.18)。ロゴはヘッダー (222×40) より小さくし、フッター内では他ブロックの見出しと同じ役割に留める。
  - 公式 SNS: アイコン 24px・gap 16px の横一列。各サービスの公式ブランド配色のまま用いる (`components/sns-icon.tsx` と同じ方針)。
- **見出し** (要件 9.17): `label/sm` (Noto Sans JP Medium 12px)・letter-spacing 0.2em・`color/gray-600`。項目 (`body/sm` 14px・`color/text`) より小さく薄くすることで、項目と役割を分ける。すべて日本語 (「サイト案内」「ご案内」「サポート」「公式SNS」)。現行実装の `SUPPORT` / `OFFICIAL SNS` という英字表記は廃する。
- **間隔**: 次の値はいずれも描画結果の文字・図形の端から端までの距離で、テキストの行ボックスの上下余白は含めない。実装では行ボックスの余白を差し引いた値をマージンに与える。
  - 見出し (またはロゴ) → 最初の項目: 32px
  - 項目の行高: 32px (描画上の項目間は 20px)
  - ブロック間 (ナビゲーション → 主催者情報・公式 SNS、主催者情報 → 区切り線): 48px
  - 区切り線 → 著作権: 24px
- **アイコンと文字の揃え**: `location_on` / `mail` / `open_in_new` は、図形の上下中心と隣接する文字 1 行目の上下中心を一致させる。Material Symbols は 24px グリッドに余白を含み、和文の視覚中心は行ボックスの中央より下にあるため、要素の枠同士を中央揃えにしても一致しない。描画結果で合わせる。
- **著作権** (要件 9.8): `label/sm`・`color/gray-600`。区切り線はグリッドと同じ x = 208〜1232 に引き、著作権はその水平中央に置く。
- **見出し・著作権の文字色** (`color/gray-600`): フッターの地 (`color/background` に `color/bansai-sage` を 18% で重ねた色、実測 `#edece3` 相当) に対し、`color/gray-500` のコントラスト比は 4.05 で WCAG AA (4.5:1) を下回るため、`color/gray-600` (6.43) を用いる。`color/text` (14.6) の文字は変更しない。
- **アイコン** (要件 9.18): Material Symbols Sharp weight 300 を `components/icons.tsx` の方式でインライン化する。`place` は Material Symbols に単独では存在せず `location_on` に統合されているため、Figma・実装とも `location_on` を用いる (実装側の既存 `PlaceIcon` は同一図形を `icon-place` の testId で持つ)。アイコンは非テキストで 3:1 以上あればよいため、`color/gray-500` (4.05) のまま変更しない。SNS のブランドアイコンは各社のブランド配色のまま変更しない。
- **モーション切替** (Requirement 19、19.5〜19.8): Figma コンポーネント `MotionToggle` (ページ「コンポーネント」、COMPONENT_SET `node-id=345:2601`、`State=playing` のインスタンスを使う) を著作権表示と同じ行に置き、右端をグリッドの右端 (x = 1232) に揃える。著作権表示は幅 1024px の中央のまま変えない。実装は `components/motion-toggle.tsx` のインスタンスを `footer.tsx` (サーバーコンポーネント) の中に埋め込む形で行う。

同種サイト 10 件 (五月祭・駒場祭・三田祭・早稲田祭・京大 11 月祭・北大祭・名大祭・まちかね祭・九大祭・一橋祭) を PC 1440px / SP 390px で実地調査した結果を、次の根拠としている。

- 見出しを日本語のみにするのは 8/10 (英字は早稲田祭のみ)
- PC のカラム数は 3 カラムが最多で 4 件。列幅は均等が 10/10
- サイトマップを主催者情報・SNS より先に置く: 早稲田祭・北大祭・三田祭・京大 11 月祭。11 月祭は住所をフッターの最後尾に置く
- 主催者情報をナビゲーションのカラムとは別の枠に置く: 五月祭・駒場祭 (左に主催者情報、右にリンク)、九大祭 (上段にロゴと SNS、区切り線の下にメニュー)
- ナビゲーションのラベルを折り返す例は 0/10
- フッターにロゴを置くのは 3/10 と少数派だが、置く 3 件 (11 月祭・九大祭・一橋祭) はいずれも大学ロゴではなくその年のテーマロゴで、11 月祭は高さ 22px (221×22) で置く。`logo-2026.png` (「荒牧祭2026」) はこれに該当するため置く側を採る

### Requirement 10: フッター (SP)

Figma: `Footer` (`291:1537`) の SP/during (`310:633`、390×1060) / SP/before (`331:540`)。

- Requirement 9 と同一コンポーネントがレスポンシブに対応する。
- 最下端の余白 (要件 10.2) は Requirement 4 の下端余白と同じ値を用いる。フッターが個別に持たない。下部ナビゲーションを表示しない開催前フェーズではこの余白も与えない。Figma の SP バリアントにもこの余白は含めていない。
- **積み方** (要件 10.3, 10.4): 左右 padding 16px (コンテンツ幅 358px) の 1 列に、サイト案内 → ご案内 → サポート → 主催者情報 → 公式 SNS → 区切り線 → 著作権 の順で積む。PC と同じく、ナビゲーションを主催者情報より先に置く。
- **間隔**: PC と同じ値を用いる。見出し (またはロゴ) → 最初の項目 32px、ブロック間 48px、区切り線 → 著作権 24px。ブロック内 32px とブロック間 48px の差によって、見出しがどのブロックに属するかを示す。
- **折りたたみを持たない** (要件 10.5): アコーディオンは採らない。上記の実地調査で折りたたみを使っていたのは北大祭 1 件のみで、9/10 は SP でも全項目を展開したまま縦積みする。北大祭は PC で 5 カラムと調査対象中最多のリンク数を持つのに対し、本サイトは最大 12 項目にとどまる。
- **ロゴと SNS** (要件 10.6): ロゴは PC と同じ 122×22。SNS アイコンは PC と同じ 24px・gap 16px の横一列で、SP では左揃え。
- 著作権はコンテンツ幅の水平中央に置く。実地調査では中央揃えが 7/10 で標準だった (PC のみ左揃えとする 11 月祭が 1 件、著作権表示自体を持たない五月祭・駒場祭が 2 件)。
- **モーション切替** (Requirement 19、19.5〜19.8): `MotionToggle` (`node-id=345:2601`、`State=playing`) を著作権表示の直上に、著作権と同じくコンテンツ幅の水平中央で置く。

### Requirement 11: 構内マップの MapMenuButton

- ファイル: `frontend/src/components/campus-map/map-menu-button.tsx`。本 spec はメニューの中身と配置要件のみを扱い、構内マップページのレイアウトには踏み込まない。
- import 元を `lib/navigation.ts` へ差し替える (要件 11.2)。
- フォーカストラップと Esc、地図より先にキー操作を処理する `document` 捕捉 (要件 11.3, 11.4) は現行実装が持っている。Requirement 7 で切り出す共有フックへ移す。
- 地図コントロールとの重なり回避 (要件 11.5) は `campus-map` 側の配置に依存するため、同 spec の配置を前提に確認する。

**未確定**: ボタンの見た目、開いたメニューの展開形式と大きさ、子項目の扱い、セーフエリアと他コントロールとの位置関係。

### Requirement 12: 広告協賛一覧

- 取得は `frontend/src/lib/sponsors.ts` に置く。`cms.findMany('sponsors', { sort: ['sort'], limit: 0, depth: 1 })` を単一の取得とし、種別による振り分けはその結果に対して行う。種別ごとに CMS を叩かない。
- `type` 配列が `'ad'` を含むものを対象とする (要件 12.1)。並び順は `sort` 昇順 (要件 12.6) で、CMS 側の `defaultSort: 'sort'` および取得時の `sort` 指定で満たされる。
- 取得失敗 (要件 12.8) と 0 件 (要件 12.7) を区別する必要があるため、`lib/sponsors.ts` は失敗を空配列へ倒さず `CmsResult` の形のまま表示側へ渡す。
- 表示部品は既存の `components/sponsors-list.tsx` を起点とする。現行は 0 件で `null` を返すため、0 件表示 (要件 12.7) に合わせて改める。
- 外部リンクは `target="_blank" rel="noopener noreferrer"` (要件 12.5)。現行実装が持っている。

**未確定**: `tier` の一覧への反映、プラン未設定の協賛の扱い、`description` を出すか、ロゴの並べ方、ページ構成。

### Requirement 14: トピックカード

- ファイル: `frontend/src/components/topic-card.tsx` と `topics-list.tsx`。データは `lib/topics.ts` の `TopicSummary` で、`imageId` を既に持つ (要件 14.3)。
- `topics` コレクションの定義は変更しない (要件 14.6)。
- 構成: 角丸 `radius/xl` (12px、`ExhibitionCard` と同じ) の四角をカード全体とし、その全面を 4:3 のサムネイル (`object-fit: cover`) で埋める。サムネイルの上に、上端 `color/gray-800` 不透明度 0% から下端 55% へ濃くなる縦方向のグラデーション (Hero のスクリムと同じ到達濃度)を重ね、その下寄りの領域にタイトルを置く。本文・日付を置く Body は持たない。
- タイトル: `heading/h4` (Zen Old Mincho Bold 20px、`ExhibitionCard` のタイトルと同じ)、色 `color/gray-50` (Hero の白抜き文字と同じ)。カード下端から `spacing/4` (16px) の padding で左揃え・下揃えに置き、2 行で打ち切る (`line-clamp-2`)。長いタイトルが 2 行に折り返すときも下端の位置は変えず、行は上方向へ増やす。カードの高さは幅と 4:3 の比率だけで決まるため、タイトルの行数によらず揃う (要件 14.7)。
- Figma の `TopicCard` (`node-id=166:113`) は画像 298×160 の下に `Title` / `Date` の Body を置いた暫定版であり、上記の構成で作り直す。`Date` プロパティは削除する (要件 14.1)。
- カード全体を 1 つの `<a>` とし、画像とタイトルを個別のリンクにしない (要件 14.5)。
- 本文・添付ファイルを描画しないため、`topic-card.tsx` から `RichText` / `AttachmentGallery` の利用を外す。サムネイルは `imageId` のみから求め、現行の「最初の画像添付を優先する」処理は削除する (要件 14.3)。
- 代替画像 (要件 14.4) は `imageId` が `null` のときに用い、`ExhibitionCard` の画像なし表示 (中央に `icon/image`) と同じ作りにする。グラデーションとタイトルは画像がある場合と同じく重ねる。
- 並び順は `lib/topics.ts` の `getTopics` の `sort` を `['-published_at']` に変える (要件 14.8)。`topics.sort` フィールドは残るが並び順には使わない。トップページの 4 枚もこの順の先頭から取る。
- `/topics` の並べ方は企画一覧と同じ PC 4 列 (カード幅 302px、gap 24px `spacing/6`)・SP 1 列とする (要件 14.9)。件数が少ないためページングは設けない。
- サムネイルは 4:3 で切り取られるため、パンフレット表紙のような縦長・文字主体の画像は上下が欠ける。`topics.image` には 4:3 で見せる前提の画像を登録する運用とする。

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
| 9, 10 | `components/footer.tsx`, `components/motion-toggle.tsx`, `lib/navigation.ts` | Figma 確定 (`MotionToggle` の配置を含む。メールアドレスの実値、ルート未確定 4 ページの遷移先は未確定) |
| 11 | `components/campus-map/map-menu-button.tsx`, `lib/navigation.ts` | 構造のみ確定 |
| 12 | `lib/sponsors.ts`, `components/sponsors-list.tsx`, `(site)/sponsors/page.tsx` | 取得層は確定、表示は未確定 |
| 14 | `components/topic-card.tsx`, `components/topics-list.tsx`, `(site)/topics/page.tsx`, `lib/topics.ts` | Figma 確定 (`TopicCard` `166:113`、トピックページ PC `381:2` / SP `382:834`) |
| 15 | `components/announcements-list.tsx` | 構造のみ確定 |
| 16 | `cms/src/collections/sponsors.ts`, マイグレーション, `lib/home-page-types.ts` | 確定 |
| 17 | `lib/navigation.ts` | 確定 |
| 18 | `lib/cms.ts`, `lib/home-page.ts` | 分岐は確定、再検証の値は未確定 |
| 19 | `tailwind.config.ts`, `globals.css`, `lib/breakpoints.ts`, `components/motion-toggle.tsx`, `lib/use-motion-preference.ts` | 表示の基準は確定、境界値は未確定。モーション切替 (`MotionToggle`) の仕様・配置は確定 |
| 20 | `cms/src/globals/festival-meta.ts`, マイグレーション, `lib/home-page-types.ts`, `components/hero-section.tsx` | 確定 (破壊的変更として検出される) |
| 21 | `(site)/announcements/page.tsx`, `lib/announcements.ts`, `components/announcements-list.tsx` | 構造のみ確定 |
| 22 | `components/background-shapes.tsx`, `lib/use-motion-preference.ts`, `(site)/layout.tsx`, `tailwind.config.ts` | 色トークン・配置先・個数/サイズ/最小間隔・配置方式 (決定的乱数)・質感・動きの仕様は確定。動きのオン・オフは Requirement 19 のモーション切替に従う |

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
