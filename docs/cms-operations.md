# CMS 運用手順

Payload CMS (`cms/`) の運用手順。Directus からの移行に伴い、コンテンツモデルの変更経路が
管理画面から Git 管理下のコードへ移る。

## 旧ワークフローの撤去対象と後継

| 撤去対象 | 役割 | 後継 | 撤去時期 |
|---|---|---|---|
| `.github/workflows/directus-schema-sync.yml` | snapshot.yaml と custom migration を infra へ同期 | `.github/workflows/cms-ci.yml` の `release` ジョブ | Directus 撤去時 (タスク 9.2) |
| `.github/workflows/additive-schema-check.yml` | snapshot.yaml の破壊的変更検出 (`if: false` で停止中) | `.github/workflows/cms-schema-check.yml` | Directus 撤去時 (タスク 9.2) |
| `frontend/scripts/check-additive-schema.ts` | 上記の検出ロジック (YAML 比較) | `cms/scripts/check-schema-changes.ts` (TypeScript 定義の比較) | Directus 撤去時 (タスク 9.2) |
| `frontend/additive-schema-check*.workflow.test.ts` | 上記の構造テスト | `frontend/cms-schema-check.workflow.test.ts` | Directus 撤去時 (タスク 9.2) |
| `frontend/directus-schema-sync.workflow.test.ts` | 同期ワークフローの構造テスト | `frontend/cms-ci.workflow.test.ts` | Directus 撤去時 (タスク 9.2) |
| `directus/schema/snapshot.yaml` | Directus のスキーマ定義 | `cms/src/collections/` / `cms/src/globals/` | Directus 撤去時 (タスク 9.2) |
| `directus/migrations/*-rbac-*.js` | Directus の権限定義 | `cms/src/access/policy.ts` | Directus 撤去時 (タスク 9.2) |

撤去は Payload への切り替え (タスク 7.2) と稼働リソース削除 (タスク 9.1) の完了後に行う。
ロールバック可能期間中は Directus 側の資産を残す。

## コンテンツモデルの変更手順

非開発者からの要求が本番へ反映されるまでの経路。

1. **要求** — 実行委員が変更内容 (どのコレクションに何のフィールドが必要か、必須か、選択肢は何か) を
   開発者へ伝える
2. **定義の変更** — 開発者が `cms/src/collections/<slug>.ts` または `cms/src/globals/<slug>.ts` を編集する
3. **マイグレーション生成** — `cd cms && pnpm migrate:create <name>` で差分マイグレーションを生成し、
   `cms/src/migrations/index.ts` に登録されていることを確認する
4. **型の再生成** — `pnpm generate:types` を実行する。`frontend/src/cms-types.ts` も同時に更新される
5. **PR** — 上記の差分を含む PR を出す。`cms-ci` の検証と `cms-schema-check` の破壊的変更検出が走る
6. **ローカル確認** — 本番同等イメージをローカルで起動し、管理画面の表示と REST の応答を確認する
7. **マージ** — `main` へマージすると `cms-ci` の `release` ジョブがイメージを push し、
   `aramakisai-infra` へタグ更新の PR を作る
8. **適用** — infra の PR をマージすると ArgoCD が同期する。PreSync Job が `payload migrate` を
   実行し、成功後に Deployment が新しいイメージへ切り替わる

## 開発者の介在が必要になった操作

Directus では管理画面で完結していたが、Payload では開発者によるコード変更と PR が必要になる。

- コレクションの追加・削除
- フィールドの追加・削除・型変更・必須化
- 選択肢 (ドロップダウンの `options`) の追加・変更
- 既定値の変更
- リレーションの追加・変更
- 権限 (どのロールがどのコレクションを操作できるか) の変更
- 管理画面の表示設定 (一覧のカラム、表示名に使うフィールド、並び順の既定)

管理画面だけで完結する操作は以下に限られる。

- レコードの作成・編集・削除
- メディアのアップロードと差し替え
- ユーザーのロール割り当て (Authentik 側のグループ変更で自動反映されるため、通常は不要)

## ローカル開発

```bash
cd cms
pnpm install
pnpm db:up                      # ローカル Postgres (localhost:5433)
infisical run --env=prod -- pnpm dev
```

`.env` は作らない。接続情報は Infisical からシェルの環境変数として渡す。
S3 の接続情報 (`S3_BUCKET` 等) が未設定の場合はディスク保存へフォールバックする。

必要な環境変数:

| 変数 | 用途 | 必須 |
|---|---|---|
| `DATABASE_URL` | Postgres 接続文字列 | 必須 |
| `PAYLOAD_SECRET` | セッション署名鍵 | 必須 |
| `CMS_PUBLIC_URL` | 公開 URL (OIDC リダイレクト先の組み立てに使う) | Authentik 連携時 |
| `S3_BUCKET` / `S3_ENDPOINT` / `S3_REGION` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | メディア保存先 | 本番 |
| `S3_PREFIX` | メディアのキー接頭辞 (既定 `payload-uploads`) | 任意 |
| `AUTHENTIK_ISSUER_URL` / `AUTHENTIK_CLIENT_ID` / `AUTHENTIK_CLIENT_SECRET` | Authentik OIDC | 本番 |
| `CMS_CORS_ORIGINS` | CORS 許可オリジン (カンマ区切り) | 本番 |

## リソース実測値

`next build` した本番相当のサーバー (Node 26 / standalone) をローカルで起動し、
プロセスの RSS を計測した値。

| 状態 | RSS |
|---|---|
| 起動直後 (アイドル) | 144 MiB |
| 管理画面 15 回 + REST 30 回の連続アクセス後 | 192 MiB |

**判定**: Directus 撤去後のノード空き容量 (約 1.4 Gi) に十分収まる。
design.md の見込み (512Mi〜1Gi) より小さい。

**リソース設定の推奨値**: requests `memory: 256Mi` / `cpu: 250m`、
limits `memory: 512Mi` / `cpu: 500m`。Directus と同じ値。

**未計測の項目**: `sharp` による画像変換を HTTP 経由で走らせた際のピークは計測できていない
(ローカル計測では認証セッションを確立できなかった)。Directus でも同じ理由で
limits を 512Mi に据え置いていた経緯があるため、同値から始めて本番で
大きな画像の連続投入時のピークを確認すること。
