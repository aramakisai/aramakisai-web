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
pnpm migrate                    # スキーマを適用する。起動前に必ず実行する
infisical run --env=prod -- pnpm dev
```

自動スキーマ同期 (dev push) は無効にしてある。コレクション定義に存在しない
DB 制約 (手書きマイグレーションが入れた CHECK と複合 UNIQUE) を接続のたびに
削除してしまうため。定義を変えたら `pnpm migrate:create` でマイグレーションを
作り、`pnpm migrate` で適用する。

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

## 本番の稼働構成 (aramakisai-infra)

| 対象 | 定義場所 |
|---|---|
| ArgoCD Application (本体) | `gitops/apps/prod/cms.yaml` (sync-wave 1) |
| ArgoCD Application (シークレット) | `gitops/apps/prod/cms-secrets.yaml` (sync-wave 0) |
| Deployment / Service / kustomization | `gitops/manifests/prod/cms/` |
| ExternalSecret | `gitops/manifests/prod/cms-secrets/external-secret.yaml` |
| DB ロール `payload` | `gitops/manifests/prod/directus/db-cluster.yaml` の `managed.roles` |
| OIDC プロバイダ / アプリケーション | `terraform/authentik_apps.tf` の `cms_prod` |
| DNS / トンネル | `terraform/dns.tf` / `terraform/tunnel.tf` の `cms.aramakisai.com` |
| 外形監視 | `terraform/uptimerobot.tf` の `cms` |

ExternalSecret を本体と別 Application に分けているのは、`cms` の PreSync Job が
`cms-secrets` Secret を参照して起動するため。同一 Application に置くと PreSync フックが
Sync フェーズの生成物を待つ形になり、初回同期が進まない。

データベースは Directus と同じ CNPG クラスタ `directus-db` 上の `payload` を使う。
稼働中の operator は 1.23.3 で `Database` CRD を持たないため、`CREATE DATABASE` は
PreSync Job (`cms-db-init`) が psql で冪等に実行する。そのために必要な `CREATEDB` 権限を
持つ `payload` ロールは CNPG の `managed.roles` が宣言的に作る。
Directus の `directus` データベースとロールには触れない。

Directus 撤去 (タスク 9.1) の際、`db-cluster.yaml` と `payload` ロールの定義は
`gitops/manifests/prod/cms/` へ移す。クラスタごと削除してはならない。

### イメージ

`cms-ci.yml` の `release` ジョブが同じコミットから 2 つのイメージを push する。

- `ghcr.io/aramakisai/aramakisai-cms` — Next の standalone 出力。Deployment が使う
- `ghcr.io/aramakisai/aramakisai-cms-migrate` — Dockerfile の `migrator` ステージ。
  `payload migrate` を実行する PreSync Job が使う。Payload CLI と TypeScript の
  マイグレーションは standalone 出力に含まれないため分けている

既存ワークロードはすべて公開レジストリから pull しており `imagePullSecrets` の実績がない。
これに合わせ、GHCR の 2 パッケージはいずれも **public** に設定する
(GitHub の Packages 設定 → Change visibility)。初回 push 後に一度だけ行う手作業。

### Infisical に登録が必要なシークレット (prod)

| キー | 用途 |
|---|---|
| `PAYLOAD_SECRET` | Payload のセッション署名鍵 |
| `PAYLOAD_DB_PASSWORD` | `payload` ロールのパスワード。CNPG の `managed.roles` と接続文字列の両方が使う |
| `CMS_PROD_OIDC_CLIENT_SECRET` | Authentik `cms-prod` プロバイダのクライアントシークレット |
| `TF_VAR_cms_prod_oidc_client_secret` | 同じ値。Terraform が Authentik 側の定義に使う |

`S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` は既存の `HETZNER_OS_*` を再利用する。

### Authentik

`cms-prod` プロバイダのリダイレクト URI は本番 (`https://cms.aramakisai.com/...`) と
ローカル開発 (`http://localhost:3000/...`) の 2 つ。CMS は staging を持たないため
プロバイダを分けない。ロール写像が参照するグループ `管理者` / `executive` /
`student_exhibitor` はいずれも既存のものを再利用する。

### 監視

外形監視は UptimeRobot に `https://cms.aramakisai.com/admin/login` を追加する。
Falco の許可リストには Payload 用のエントリを追加しない。現行の許可リストは
`/etc` への書き込み・k8s API への定常アクセス・標準ストリームの張り替えを行う
ワークロードだけを対象にしており、Payload はいずれにも該当しないため。
実際に発報が出た時点で、鳴っているルール名を根拠に追加する。

## ロールごとの見え方

本番同等イメージ (`docker build -t aramakisai-cms:local cms/`) をローカルの Postgres に
接続して起動し、REST 経由で確認した実挙動。管理画面も同じ access control を通るため、
一覧の絞り込みはここに書いたとおりになる。

| 操作 | 実行委員 | 出展者 | 未認証 |
|---|---|---|---|
| 学生企画の一覧 | 全件 | 自分の企画 + 他者の公開済み企画 | 公開済みのみ |
| 他者の下書きの単体取得 | 取得できる | 404 | 404 |
| 自分の企画の更新 | 更新できる | 200 | — |
| 他者の企画の更新 (公開済みを含む) | 更新できる | 403 | 403 |
| お知らせの作成 | 作成できる | 403 | 403 |
| ユーザー一覧 | 取得できる | 403 | 403 |

出展者の管理画面には**他者の公開済み企画も一覧に出る**。読み取りは公開状態に従い、
編集は所有者に限る、という二段構えのため。開こうとすると読み取り専用として開き、
保存は 403 で拒否される。出展者に他者の企画を一切見せない運用が必要になった場合は、
`src/access/policy.ts` の `canRead` から公開状態による許可を外す。

学生企画の `owner` は unique であり、1 出展者につき 1 企画しか作れない。
