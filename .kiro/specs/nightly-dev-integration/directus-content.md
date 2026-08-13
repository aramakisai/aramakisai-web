# Directus 投入対象一覧

`nightly` が導入した静的コンテンツの棚卸しと、Directus への投入対象・手段・現状を一覧化する。

## 分類方針

- **既存スキーマ**: 既存の collection / フィールドで表現できるため、新規スキーマを追加せず Directus へ登録する
- **フィールド追加 (Phase 2)**: 既存スキーマに受け皿がなく、additive なフィールド追加が必要
- **コードに残す**: ナビゲーション定義・コピーライト等、構造的要素または更新頻度が極めて低い要素

## 一覧

| # | 要素 | 静的コード上の該当箇所 | 分類 | 格納先 | フェーズ |
|---|------|------------------------|------|--------|----------|
| 1 | ヒーロー画像 5 点 | `hero-section.tsx` `HERO_IMAGES` (`/images/top/top0.png`〜`top4.png`) | 既存スキーマ | `page_home.hero_images` | Phase 1 |
| 2 | 概要文 | `about-section.tsx` `#about-overview` 内の段落 | 既存スキーマ | `festival_meta.overview` | Phase 1 |
| 3 | 開催スケジュール (DAY1/DAY2 の日付・時刻) | `about-section.tsx` `#about-schedule` の `<time>` | 既存スキーマ | `festival_meta.event_days` | Phase 1 |
| 4 | SNS リンク 3 件 | `footer.tsx` `socialLinks` | 既存スキーマ | `festival_meta.sns_links` | Phase 1 |
| 5 | プライバシーポリシー本文 | `app/privacy-policy/page.tsx` | 既存スキーマ | `pages` (`slug: privacy`) の `content` | Phase 1 |
| 6 | 会場名「群馬大学 荒牧キャンパス」 | `about-section.tsx` `venue-details` | フィールド追加 | `festival_meta.venue_name` | Phase 2 |
| 7 | キャンパスマップ埋め込み URL | `about-section.tsx` `campusMapUrl` | フィールド追加 | `festival_meta.campus_map_url` | Phase 2 |
| 8 | テーマ語「万彩」 | `about-section.tsx` `theme-word` | フィールド追加 | `festival_meta.theme_word` | Phase 2 |
| 9 | テーマのメインビジュアル | `about-section.tsx` `theme-visual` (`/images/background1.png`) | フィールド追加 | `festival_meta.theme_image` | Phase 2 |
| 10 | テーマの説明文 | `about-section.tsx` `theme-description` | フィールド追加 | `festival_meta.theme_description` | Phase 2 |
| 11 | お問い合わせフォーム URL | `footer.tsx` `contactFormUrl` | フィールド追加 | `festival_meta.contact_form_url` | Phase 2 |
| 12 | 昨年度来場者数・目標来場者数 | `about-section.tsx` 概要文・テーマ説明文の双方 | 既存スキーマ (本文内) | `festival_meta.overview` / `theme_description` の本文に含める | Phase 1–2 |
| 13 | ヘッダー / フッターのナビゲーション項目 | `header.tsx` / `footer.tsx` | コードに残す | — | — |
| 14 | コピーライト表記 | `footer.tsx` `© 2026 群馬大学荒牧祭実行委員会` | コードに残す | — | — |
| 15 | 住所・連絡先 | `dev` 版 `footer.tsx` に存在 (`nightly` で削除、復活対象) | コードに残す | — | — |

13〜15 をコードに残す理由: ナビゲーションは URL とページ実装に結びついた構造的要素であり、Directus 上で自由記述にするとリンク切れを招く。コピーライトと住所は更新頻度が極めて低く、専用フィールドを設ける利益が薄い。

## 投入手段と現状

| 対象 | 投入先 | 投入手段 | 現状 (本番) |
|------|--------|----------|-------------|
| ヒーロー画像 5 点 | `directus_files` → `page_home.hero_images` | REST API (`POST /files` + `PATCH /items/page_home`) | 投入済み。本番スキーマデプロイ (`precheck.md` 参照) 完了後、`top0.png`〜`top4.png` を `sort:1`〜`5` で登録完了 (2026-08-13) |
| `event_days[].label` の表記 | `festival_meta.event_days` | REST API (`PATCH /items/festival_meta`) | 投入済み。`11月14日` / `11月15日` 形式へ更新完了 (2026-08-13) |
| 概要文 | `festival_meta.overview` | REST API (`PATCH /items/festival_meta`) | 投入済み。現行 Directus 版の内容を採用し、HTML の二重エスケープを修正して更新完了 (2026-08-13) |
| SNS リンク | `festival_meta.sns_links` | — | 投入済み (Instagram / X / YouTube)。対応不要 |
| プライバシーポリシー本文 | `pages` (`slug: privacy`) の `content` | REST API (`PATCH /items/pages/1`) | 投入済み。`nightly` 版の内容 (全10節) へ更新完了 (2026-08-13) |
| 会場名 / マップ URL / お問い合わせ URL | `festival_meta.venue_name` / `campus_map_url` / `contact_form_url` | REST API | フィールド未追加 (Phase 2 で追加後に投入) |
| テーマ関連 3 項目 | `festival_meta.theme_word` / `theme_image` / `theme_description` | 管理画面 | フィールド未追加 (Phase 2 で追加後に投入) |

REST API で投入する分は、実行内容を本ドキュメントの該当タスク実施時にリクエスト定義として追記する。本番へ適用する前に開発環境または staging で表示を確認する。

### 実施記録 (2026-08-13)

- 認証: Directus admin (email/password は Infisical `--env=prod` から取得)
- `event_days`: `PATCH /items/festival_meta` で `label` を `11/14(土)` → `11月14日`、`11/15(日)` → `11月15日` に更新
- `overview`: `PATCH /items/festival_meta` で実 HTML タグ (`<h3>` 等) を送信して更新。既存値は HTML が二重エスケープされ `&lt;h3&gt;` のような生文字が格納されていたが、実タグ送信で正しく解消されたことを GET で確認済み
- `pages/1` (`slug: privacy`) `content`: `nightly` ブランチの静的プライバシーポリシー (`frontend/src/app/privacy-policy/page.tsx`, コミット `9e091f1`) を元に、見出し (`h2`) ・段落 (`p`) ・箇条書き (`ul`/`li`) の構造を保った HTML へ変換して `PATCH /items/pages/1` で更新
- ヒーロー画像 (4.1) は Phase 1 デプロイ前提未達 (`precheck.md`) のため未投入のまま据え置き (2026-08-13 時点)

### 実施記録 (2026-08-13 続き): ヒーロー画像投入

- 前提: `precheck.md` の「本番スキーマデプロイ実施記録」参照。本番 Directus スキーマデプロイ完了により `page_home.hero_images` が公開ロールで到達可能になったことを確認済み
- `POST /files` (multipart) で `frontend/public/images/top/top0.png`〜`top4.png` を Directus ファイルライブラリへ登録 (`storage: s3`)
  - 発行された `directus_files` ID (sort 順): `079cb354-ad68-4384-9107-b08f719e7dd7` (1) / `f8dac7bd-32eb-4df3-845d-a296ca1730a7` (2) / `7dcb31b7-1d26-459b-a4d2-dc387c66a314` (3) / `8910f907-7ed0-48c1-a528-37b192c7bf81` (4) / `6fc63f5a-1058-4441-a2e0-f4d3b91afb57` (5)
- `PATCH /items/page_home` (singleton につき ID 指定不要) で `hero_images` に上記 5 件を junction オブジェクト (`{directus_files_id, sort}`) として一括登録
- 公開ロールで `GET /items/page_home?fields=hero_images.directus_files_id,hero_images.sort` が 200 を返し、5 件が sort 順どおりに取得できることを確認済み
