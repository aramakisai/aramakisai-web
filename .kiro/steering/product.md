# プロダクト概要

荒牧祭実行委員会の公式サイト。フロントエンド (Next.js) と Directus のバックエンドスキーマを一つのリポジトリで管理する。単なる告知サイトではなく、学生模擬店・協賛企業・ステージ企画の出展情報を Directus 上で構造化管理し、出展者自身が一部を自己編集できる CMS 基盤を持つ。

## ドメインモデル (Directus collections)

- `student_exhibitions` (学生模擬店), `sponsors` (協賛企業) — `map_areas` の `booth_number` で紐づく出展枠
- `stages` / `performance_slots` — ステージとタイムスロットの組(`time_slots`)によるパフォーマンス予定
- `map_areas` / `time_slots` — 会場マップ区画・時間割のマスタ
- `announcements` / `faq_items` / `topics` / `festival_meta` — 告知・FAQ・トピック・祭全体メタ情報
- `page_home` / `page_access` / `page_contact` / `page_privacy` / `page_sponsor_guide` — 固定ページ用シングルトン

## RBAC (Directus 12 policies)

- `executive` ロール: 全 collection に対する CRUD (実行委員)
- `student_exhibitor` ロール: `student_exhibitions` の自分のレコード (`user_created` 一致) のみ編集可、他は `published`/`status` 条件付き READ のみ
- ロール定義・権限は `directus/migrations/20260701C-rbac-roles.js` で管理 (schema snapshot は RBAC を表現できないため)

## 想定利用シーン

- 一般来場者・学生が公式サイトで祭の情報・マップ・タイムテーブルを閲覧する
- 学生模擬店の担当者が Directus 管理画面で自分の出展情報のみ更新する (`student_exhibitor` ロール)
- 実行委員会メンバーが Directus 管理画面で全コンテンツ・出展情報を管理する
- 開発者がフロントエンドと Directus スキーマの両方を同一 PR で変更する

## 価値提案

コンテンツスキーマもコードと同様に Git でレビュー・履歴管理し、本番 DB への破壊的変更を additive-only ルール (機械チェック付き) で防ぐことで、学生主体の運営体制でも安全にサイトを継続運用できる。出展者自身への部分的な編集権限委譲により、実行委員会の運用負荷を下げる。

---
_Focus on patterns and purpose, not exhaustive feature lists_
