# Phase 1 前提確認

## ブランチ状態

- 作業ブランチ `nightly` は `dev` の全コミットを含む (`git rev-list --count nightly..dev` = 0)。取り込み作業は不要。

## 本番 Directus のスキーマ適用状況

公開ロールで本番 API (`https://api.aramakisai.com`) を直接参照して確認した。

- `festival_meta`: `home_active_variant` (`"pre_event"`)、`admission_fee` / `payment_note` / `parking_capacity` (いずれも `null`) が残存している。`sitemap-schema-review` spec が定めるこれらフィールドの削除は本番へ未適用。
- `page_home.hero_images`: `fields=hero_images` を指定すると `FORBIDDEN` (403) を返す。フィールド自体は `fields=*,hero_images.*` 経由で存在が確認できるが、公開ロールの読み取り権限が付与されていない。
- `page_home_files` (junction collection): 直接アクセスすると `FORBIDDEN` (403)。

## Phase 1 のデプロイ前提

- `hero_images` (M2M) を参照するフロントエンドを本番へ先にデプロイすると、`sitemap-schema-review` の `snapshot.yaml` が未適用な現在の本番スキーマでは取得に失敗する。**`sitemap-schema-review` の `snapshot.yaml` を本番へ適用してから**、本 spec の Phase 1 フロントエンドをデプロイする必要がある。
- 本 spec のローカル実装・テストはこの前提の影響を受けない (ローカル Directus へ `snapshot.yaml` を適用した状態で検証する)。

## ヒーロー画像の公開読み取り権限について

`docker-compose.yaml` のローカル Directus (12.1.1) で検証した結果、`page_home.hero_images` の公開読み取りに必要な権限は、**既存の migration で既に付与済み**であることを確認した。新規 migration の追加は不要。

- `page_home_files` (junction) への PUBLIC read: `directus/migrations/20260718B-rbac-page-home-files.js` (`sitemap-schema-review` 由来、`dev` / `nightly` 双方に既にマージ済み)
- `directus_files` への PUBLIC read: `directus/migrations/20260713B-rbac-public-sponsors-files.js` (既存)
- `page_home` の PUBLIC read (`fields: "*"`) は基盤の `20260701C-rbac-roles.js` で付与済み

ローカルでこの 2 件の permission レコードを削除した状態では `page_home?fields=hero_images...` がヒーロー画像を解決できず (`hero_images` が空扱いになる)、再付与すると `directus_files_id` まで含めて正しく取得できることを確認した。

本番で `hero_images` が `FORBIDDEN` を返すのは、migration の欠落ではなく **これらの migration がまだ本番へ適用されていない (デプロイ待ち) ため**であり、上記「Phase 1 のデプロイ前提」と同根の課題である。`sitemap-schema-review` の `snapshot.yaml` 適用と合わせて、`directus database migrate:latest` が本番で実行されれば解消する。
