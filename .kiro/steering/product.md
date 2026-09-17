# プロダクト概要

荒牧祭実行委員会の公式サイト。フロントエンド (Next.js) と Payload CMS のバックエンドを一つのリポジトリで管理する。単なる告知サイトではなく、学生模擬店・協賛企業・ステージ企画の出展情報を CMS 上で構造化管理し、出展者自身が一部を自己編集できる基盤を持つ。

## ドメインモデル (Payload collections / globals)

- `student_exhibitions` (学生模擬店), `sponsors` (協賛企業) — `map_areas` の区画に紐づく出展枠
- `stages` / `performance_slots` — ステージとタイムスロットの組(`time_slots`)によるパフォーマンス予定
- `map_areas` / `time_slots` — 会場マップ区画・時間割のマスタ
- `announcements` / `faq_items` / `topics` — 告知・FAQ・トピック
- `pages` — 固定ページ (アクセス・お問い合わせ・プライバシー・協賛案内等) を `slug` で束ねる単一コレクション
- `festival_meta` / `page_home` — 祭全体メタ情報・トップページ用の単一レコード global
- `media` — アップロード。用途別サイズを WebP で生成し S3 互換ストレージに保存

## RBAC (Payload access control)

- `executive` ロール: 全 collection に対する CRUD (実行委員)
- `student_exhibitor` ロール: `student_exhibitions` の自分のレコード (`owner` 一致) のみ編集可、他コレクションは各々の公開判定に従う READ のみ
- 未認証は公開済みレコードのみ READ 可 (公開判定はコレクションごとに異なり `cms/src/access/policy.ts` の `PUBLISHED_FILTER` で定める)
- ロールは Authentik の OIDC グループ (`管理者`/`executive`/`student_exhibitor`) から `cms/src/auth/role-mapping.ts` の静的写像で決まる。ローカル認証は実行委員の緊急用としてのみ有効

## 想定利用シーン

- 一般来場者・学生が公式サイトで祭の情報・マップ・タイムテーブルを閲覧する
- 学生模擬店の担当者が CMS 管理画面で自分の出展情報のみ更新する (`student_exhibitor` ロール)
- 実行委員会メンバーが CMS 管理画面で全コンテンツ・出展情報を管理する
- 開発者がフロントエンドと CMS コンテンツモデルの両方を同一 PR で変更する

## 価値提案

コンテンツモデルもコードと同様に Git でレビュー・履歴管理し、破壊的変更をフロントエンド対応済みかどうかで機械ゲートすることで、学生主体の運営体制でも安全にサイトを継続運用できる。出展者自身への部分的な編集権限委譲を、行レベルの access control で実際に成立させることで、実行委員会の運用負荷を下げる。

---
_Focus on patterns and purpose, not exhaustive feature lists_
