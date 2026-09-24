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
   `cms/src/migrations/index.ts` に登録されていることを確認する。`migrate:create` / `generate:importmap` /
   `generate:types` は S3 と Authentik をダミー値で常に有効化した状態で実行される
   (`cms/package.json` 参照)。これらのプラグインは本番で有効なため、実行者の環境変数の有無で
   スキーマ・生成物が変わらないようにしている
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

出展者ロールは荒牧祭SSO (OIDC) からは発行されず、ローカル認証アカウントとしてのみ存在する
(「出展者ローカルアカウントの発行」参照)。ロールの変更は実行委員による `ユーザー` の編集で行う。

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

型の自動生成は無効にしてある。`dev` / `test` / `build` は S3 を無効にした状態で走るため、
自動生成に任せると `media.prefix` を欠いた型が書き戻される。型は `pnpm generate:types` で更新する。
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
| `SMTP_HOST` | 招待メール送信先 (docker-mailserver)。設定時だけ SMTP アダプタを有効化する | 任意 (本番のみ設定) |
| `NOREPLY_SMTP_PASSWORD` | 送信専用アカウント `noreply@aramakisai.com` のパスワード | `SMTP_HOST` 設定時は必須 |

`infisical run --env=prod` には `SMTP_HOST` が入らないため、ローカルはメール送信が無効
のままで起動し、送信は Payload 既定のコンソール adapter (宛先と件名だけを出力) になる。
招待メールのパスワード設定リンクを確かめるには、ローカル DB からトークンを直接引く。

```sql
SELECT reset_password_token FROM users WHERE email = '<宛先のメールアドレス>';
```

得られたトークンで `http://localhost:3000/admin/reset/<トークン>` を開く。

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
| DB ロール `payload` | `gitops/manifests/prod/cms/db-cluster.yaml` の `managed.roles` |
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

Directus 撤去 (タスク 9.1) 完了済み。`db-cluster.yaml` と `payload` ロールの定義は
`gitops/manifests/prod/directus/` から `gitops/manifests/prod/cms/` へ移設した
(クラスタごと削除するとこの `payload` DB も失われるため、Directus の Deployment 等
とは分けて cms Application 側に残した)。

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
| `NOREPLY_SMTP_PASSWORD` | 送信専用アカウント `noreply@aramakisai.com` の SMTP パスワード |

`S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` は既存の `HETZNER_OS_*` を再利用する。
`SMTP_HOST` は Infisical に登録せず、`cms-secrets` の ExternalSecret に固定値
`mailserver.prod.svc.cluster.local` を直接書く。

### Authentik

`cms-prod` プロバイダのリダイレクト URI は本番 (`https://cms.aramakisai.com/...`) と
ローカル開発 (`http://localhost:3000/...`) の 2 つ。CMS は staging を持たないため
プロバイダを分けない。ロール写像 (`src/auth/role-mapping.ts`) が参照するグループは
`管理者` / `executive` のみで、いずれも既存のものを再利用する。出展者ロールは
荒牧祭SSO からは発行されず、`student_exhibitor` グループだけを持つ利用者はロール無しとして
ログインを拒否される (「出展者ローカルアカウントの発行」参照)。

### 監視

外形監視は UptimeRobot に `https://cms.aramakisai.com/admin/login` を追加する。
Falco の許可リストには Payload 用のエントリを追加しない。現行の許可リストは
`/etc` への書き込み・k8s API への定常アクセス・標準ストリームの張り替えを行う
ワークロードだけを対象にしており、Payload はいずれにも該当しないため。
実際に発報が出た時点で、鳴っているルール名を根拠に追加する。

## ロールごとの見え方

`src/access/policy.ts` の判定 (REST・管理画面共通)。出展者の管理画面ナビには
学生企画とメディア以外のコレクション・グローバルが出ない (`isHiddenInAdmin`)。

| 操作 | 実行委員 | 出展者 | 未認証 |
|---|---|---|---|
| 学生企画の一覧・件数 | 全件 | 自分の企画のみ | 公開済みのみ |
| 他者の学生企画の単体取得 (公開・下書き問わず) | 取得できる | 404 | 公開済みなら 200、下書きは 404 |
| 学生企画の作成 | 作成できる | 403 (受け皿レコード方式。実行委員が作成する) | 403 |
| 下書きの自分の企画の更新 | 更新できる | 200 | — |
| 公開済みの自分の企画の更新 | 更新できる | 403 (M-E01) | — |
| 他者の企画の更新 | 更新できる | 403 | 403 |
| マップ配置エリア・ブース番号・マップ表示ラベル・公開状態の変更 | 変更できる | 値を送っても保存されない (捨てられる) | — |
| メディアの一覧・件数 | 全件 | 自分が所有者のメディアのみ | 所有者なし・所有者が実行委員・公開企画で使用中のいずれか |
| 使用中の自分のメディアの更新・削除 | 可能 | 403 (M-E05) | — |
| 他人の画像 ID を自分の企画に指定して保存 | — | 400 (M-E17) | — |
| お知らせの作成 | 作成できる | 403 | 403 |
| ユーザーの一覧 | 全件 | 自分のレコードのみ | 403 |
| ユーザーのロール・メールアドレスの変更 | 変更できる | 値を送っても保存されない (捨てられる) | — |

学生企画の `owner` は unique であり、1 出展者につき 1 企画しか作れない。

## 出展者ローカルアカウントの発行

出展者ロールは荒牧祭SSOからは発行されないため、実行委員が管理画面または API でローカル
認証アカウントを作成する。

### 管理画面での作成

1. `ユーザー` > 新規作成を開く
2. メールアドレスを入力する (ロールは既定で「出展者」が選ばれている)
3. **パスワード欄・確認欄には何も入力せず、そのまま保存する** — 新規作成画面ではこの 2 欄に
   サーバー側で推測できない乱数が自動入力される (`AutoFillInitialPassword.tsx`)。入力しても
   保存時にサーバー側の乱数へ差し替えられるため、内容を書いても意味がない

保存すると招待メールが自動で送信される (下記)。

### API での作成

実行委員としてログインし、`POST /api/users/login` で得たトークンを使う。

```bash
curl -X POST https://cms.aramakisai.com/api/users \
  -H "Authorization: JWT <実行委員のトークン>" \
  -H "Content-Type: application/json" \
  -d '{"email": "example-team@aramakisai.example"}'  # confidential:allow
```

`role` は省略すると出展者になる。`password` を指定しても無視され、サーバー側の乱数に
差し替えられる。

Local API (サーバー内スクリプト) から行う場合も同様に、`password` は指定しても差し替えられる。

```ts
await payload.create({
  collection: 'users',
  data: { email: 'example-team@aramakisai.example' },  // confidential:allow
});
```

### 招待メールの自動送付

作成 (`afterChange`) の直後にジョブキューに積まれ、最大 10 秒以内に送信される
(ローカルは `SMTP_HOST` 未設定のためコンソール出力になる。「ローカル開発」参照)。
送信元は `noreply@aramakisai.com`、件名は M-01、本文にパスワード設定リンク・ログイン画面の
URLを含む。パスワード設定リンクの有効期限は、発行 (再送を含む) から72 時間。

問い合わせ先 URL は「祭基本情報」の「出展者向け問い合わせ先URL」に設定した値を本文に
差し込む。未設定の場合は招待メールに問い合わせ先の記載自体が載らない。

### 「招待メール」列の見方

ユーザー一覧の「招待メール」列 (`invite_status`) は次のいずれかになる。

| 表示 | 意味 |
|---|---|
| (空欄) | ジョブがまだ実行されていない (作成直後の一瞬、または元々出展者でない) |
| 送信済み | 招待メールを送信できた |
| 送信失敗 | 送信に失敗した。対象ユーザーの「送信エラー」欄 (`invite_error`) に理由が入る |

送信エラーが「メール送信の設定がありません」の場合は cms-secrets の SMTP 設定 (`SMTP_HOST` 等) を確認する。

「招待送信日時」欄 (`invite_sent_at`) には最後に送信を試みた日時が入る。

### 送信失敗・期限切れ・紛失時の再送

対象ユーザーの編集画面を開き、「招待メールを再送」にチェックを入れて保存する。新しい
パスワード設定トークンが発行され (有効期限は発行から改めて 72 時間)、以前のリンクは
無効になる (開くと M-E06 の案内が出る)。

## 受け皿レコードの作成と割当

次の順序で行う。ステージ出演枠は、企画がステージに出演する場合だけ作成する。

1. アカウント作成 (上記)
2. 企画作成 (所有者・団体名・カテゴリ・マップ配置エリア・ブース番号・マップ表示ラベル)
3. ステージ出演枠の作成

### 管理画面

1. `学生企画` > 新規作成を開く
2. 所有者に手順 1 で作成したアカウントを選ぶ (出展者ロールのユーザーしか選べない。同じ
   ユーザーを既に所有者に持つ企画があると M-E02 で拒否される)
3. 団体名・カテゴリ (1 つ以上) を入力する
4. カテゴリに「展示」「出店」を含む場合は、マップ配置エリア・ブース番号・マップ表示ラベルを
   設定する
5. 保存する (公開状態は既定で「下書き」)
6. カテゴリに「ステージ」を含む場合、`ステージ出演枠` コレクションで新規作成し、ステージ・
   タイムスロット・団体 (`exhibition_id` に手順 5 の企画を指定) を設定する。企画側の
   「ステージ出演枠」欄は読み取り専用の一覧で、ここでは作成できない

### API

```bash
# 企画作成
curl -X POST https://cms.aramakisai.com/api/student_exhibitions \
  -H "Authorization: JWT <実行委員のトークン>" \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "<出展者ユーザーの ID>",
    "organization_name": "○○部",
    "categories": ["vendor"],
    "area_id": "<マップエリアの ID>",
    "booth_number": 12,
    "booth_label": "○○部"
  }'

# ステージ出演枠の作成 (ステージに出演する場合)
curl -X POST https://cms.aramakisai.com/api/performance_slots \
  -H "Authorization: JWT <実行委員のトークン>" \
  -H "Content-Type: application/json" \
  -d '{
    "stage_id": "<ステージの ID>",
    "time_slot_id": "<タイムスロットの ID>",
    "exhibition_id": "<企画の ID>"
  }'
```

Local API から行う場合は `payload.create({ collection: 'student_exhibitions', data: {...} })` /
`payload.create({ collection: 'performance_slots', data: {...} })` を、上記と同じフィールドで呼ぶ。

## 学生団体のパスワード再設定

出展者本人が、ログイン画面の「パスワードをお忘れですか？」からメールアドレスを入力して
再設定メールを受け取る (Payload 標準の forgot-password。件名・本文は既定のまま)。
再設定リンクの有効期限は 1 時間。実行委員が代行して再設定する経路は無いため、リンクを
紛失した場合は招待メールの再送 (上記) で案内し直す。

## 出展者から見た操作範囲

**見える** (管理画面ナビに出るのはこの 2 つだけ):
- 学生企画: 自分の企画のみ
- メディア: 自分がアップロードした画像のみ

**編集できる** (下書き状態の自分の企画のみ): 団体名・カテゴリ・各カテゴリの企画内容
(企画名・紹介文・画像)・リンク。画像は各カテゴリ 5 枚まで (6 枚以上は M-E07 で拒否)。
公開中の企画で使用中の画像は変更・削除できない (M-E05)。

**編集できない** (読み取り専用): マップ配置エリア・ブース番号・マップ表示ラベル・
公開状態・ステージ出演枠。いずれも実行委員が設定する。

**公開までの流れ**: 招待メールのリンクからパスワードを設定してログイン →
下書きの自分の企画を編集して保存 → 実行委員が内容を確認し公開状態を「公開」に変更 →
公式サイトに掲載される。公開後は出展者側で編集できない (保存しようとすると M-E01 で
拒否される)。

## 確認と公開

`学生企画` の一覧を公開状態で絞り込み (例: 「下書き」だけ表示)、内容を確認する。
問題がなければ対象の企画を開き、公開状態を「公開」に変更して保存する。公開すると、
その企画が参照する画像が未認証 (公式サイト) からも読めるようになる。

## 公開後の修正依頼

出展者から修正の依頼を受けたら、対象の企画を開いて公開状態を「下書き」に戻して保存する。
**下書きに戻している間、その企画 (と参照する画像) は公式サイトから見えなくなる。**
出展者が修正して保存した後、「確認と公開」の手順で再び公開する。

## 公開前の修正依頼の連絡手段

公開前の確認で修正が必要な場合、CMS 上に差し戻し機能は無い。実行委員会が団体との連絡に
普段使っている手段 (システム外、メール等) で直接修正を依頼する。

## 既存の荒牧祭SSO出展者アカウントの移行

本変更より前に荒牧祭SSO (OIDC) のグループ写像で作成された、出展者ロールかつ
`authentik_sub` を持つユーザーは、ロール写像から `student_exhibitor` グループが
外れたことで荒牧祭SSO からログインできなくなる。該当ユーザーには招待メールを再送し、
ローカル認証のパスワード設定へ移行してもらう。
