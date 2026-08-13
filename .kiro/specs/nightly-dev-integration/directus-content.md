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
| ヒーロー画像 5 点 | `directus_files` → `page_home.hero_images` | 管理画面 (ファイルアップロード + 並び替え) | 未投入。公開読み取り権限は既存 migration (`20260713B` / `20260718B`) で付与済みだが本番へ未デプロイ (`precheck.md` 参照)。デプロイ後に投入する |
| `event_days[].label` の表記 | `festival_meta.event_days` | REST API (`PATCH /items/festival_meta`) | `11/14(土)` 形式で投入済み。`11月14日` 形式へ更新が必要 |
| 概要文 | `festival_meta.overview` | 管理画面 (WYSIWYG) | 投入済みだが内容が `nightly` 版と異なる。採用内容の確定が必要 |
| SNS リンク | `festival_meta.sns_links` | — | 投入済み (Instagram / X / YouTube)。対応不要 |
| プライバシーポリシー本文 | `pages` (`slug: privacy`) の `content` | 管理画面 (WYSIWYG) | 投入済みだが章立てが `nightly` 版と異なる。`nightly` 版の内容へ更新が必要 |
| 会場名 / マップ URL / お問い合わせ URL | `festival_meta.venue_name` / `campus_map_url` / `contact_form_url` | REST API | フィールド未追加 (Phase 2 で追加後に投入) |
| テーマ関連 3 項目 | `festival_meta.theme_word` / `theme_image` / `theme_description` | 管理画面 | フィールド未追加 (Phase 2 で追加後に投入) |

REST API で投入する分は、実行内容を本ドキュメントの該当タスク実施時にリクエスト定義として追記する。本番へ適用する前に開発環境または staging で表示を確認する。
