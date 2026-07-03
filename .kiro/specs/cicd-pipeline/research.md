# Research & Design Decisions — cicd-pipeline

## Summary

- **Feature**: `cicd-pipeline`
- **Discovery Scope**: Complex Integration（GHA + Cloudflare Workers + GitOps + K8s Job + Infisical + GitHub App）
- **Key Findings**:
  - **デプロイ先の矛盾**: コミット済み frontend scaffold は `@opennextjs/cloudflare`（Cloudflare **Workers**）を採用済みだが、`requirements.md` と infra `terraform/pages.tf` は Cloudflare **Pages**（`wrangler pages deploy` / `.vercel/output/static`）を前提としている。両者は別製品でビルド出力・preview 機構・カスタムドメイン配線が異なり両立不可。→ **Workers を正とする**決定（後述）。
  - **既存 infra Job の技術的優位**: `aramakisai-infra` には既に `schema-apply-job.yaml` が存在し、DB へ直接接続（`DB_HOST`）して `node /directus/cli.js schema apply` + `database migrate:latest` を実行する。requirements 4.3 の「HTTP API (`http://directus.prod.svc:8055`) に対して適用」は技術的に誤り（Directus の `schema apply` CLI は HTTP API ではなく DB 接続で動作）。→ 既存の DB 接続方式を踏襲。
  - **既存 workflow は PAT 認証・仕様と乖離**: 既存 `directus-schema-sync.yml` は `INFRA_GITHUB_TOKEN`（PAT）を使用。requirements 3.6/7.1 は GitHub App + Infisical を要求。既存 `frontend-ci.yml` は検証のみで deploy/Infisical 未実装。→ この spec で仕様準拠に書き換え。

---

## Research Log

### デプロイ先: Cloudflare Pages vs Workers

- **Context**: requirements.md 全体（1.6, 6.x）が Cloudflare Pages 前提だが、frontend-scaffold spec が生成した実コードは OpenNext/Workers。設計の CD 半分が根本的に変わるため確定が必要。
- **Sources Consulted**:
  - `frontend/package.json`（`@opennextjs/cloudflare@^1.0.0`、`deploy: opennextjs-cloudflare build && opennextjs-cloudflare deploy`）
  - `frontend/wrangler.toml`（`main = ".open-next/worker.js"`、`compatibility_flags = ["nodejs_compat"]`、`[assets] directory = ".open-next/assets"`）
  - `frontend/open-next.config.ts`、`frontend/next.config.ts`（`initOpenNextCloudflareForDev()`）
  - infra `terraform/pages.tf`（`cloudflare_pages_project.aramakisai_web`、`destination_dir = ".vercel/output/static"`）
  - infra `.kiro/specs/cloudflare-pages-project/design.md`（Pages 前提、CD は cicd-pipeline spec に委譲と明記）
- **Findings**:
  - `.vercel/output/static`（Pages 用）と `.open-next/`（Workers 用）は互換なし。
  - `@cloudflare/next-on-pages` は Cloudflare 公式が事実上メンテナンスモード、後継として OpenNext (`@opennextjs/cloudflare`) を推奨。Next.js 15 / React 19 の実運用は OpenNext が本流。
  - ユーザー指示: 「フルスクラッチでの開発になるので CLAUDE.md を盲信せず、柔軟に変更していきたい」。CLAUDE.md の `@cloudflare/next-on-pages`/Pages 記述は旧前提。
- **Implications**: 設計は Workers を正とする。requirements.md の Pages 文言はデプロイ機構レベルで置換（下表）。infra `pages.tf` は別 spec 所有のため Revalidation Trigger として追従を記録。

### Cloudflare Workers の preview / prod デプロイ機構

- **Context**: Pages の「preview URL」「native GitHub 連携」は Workers に存在しない。Workers での同等機能を確認。
- **Sources Consulted**: Cloudflare Workers `wrangler versions upload` / `wrangler deploy`、OpenNext Cloudflare adapter ドキュメント。
- **Findings**:
  - **Prod デプロイ**: `opennextjs-cloudflare deploy`（内部で `wrangler deploy`）で本番 Worker を更新。
  - **PR preview**: `wrangler versions upload` が本番トラフィックを切り替えずに **Version Preview URL**（`<version-prefix>-<worker>.<subdomain>.workers.dev`）を発行。GHA から URL を取得し PR にコメント可能。
  - `NEXT_PUBLIC_*` は **ビルド時に JS へインライン化**されるため、`opennextjs-cloudflare build` 実行時に環境変数が確定している必要がある。Cloudflare ダッシュボード / Terraform の環境変数はビルドに反映されない（requirements 前提と一致）。
  - 認証は `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`（Worker deploy 権限を持つトークン）。
- **Implications**: preview は `wrangler versions upload --preview-alias`（対応時）または版プレビュー URL 抽出。deploy は build → deploy の 2 段。「native GitHub 連携の無効化」（req 6.6）は Workers では非該当 → 「GitHub 連携（Deploy hooks / Git integration）を有効化しない」と読み替え。

### 既存 infra スキーマ適用 Job の実装

- **Context**: requirements 4.x の Job 仕様が既存 infra Job と乖離。どちらを採るか。
- **Sources Consulted**: `gitops/manifests/prod/directus/schema-apply-job.yaml`、`schema-configmap.yaml`、`deployment.yaml`、`external-secret.yaml`、`gitops/apps/prod/directus.yaml`、staging 相当。
- **Findings**:
  - 既存 Job: `image: directus/directus:12.1.1`、`node /directus/cli.js database migrate:latest` → `schema apply --yes /snapshot/snapshot.yaml`、DB 直結（`DB_HOST=directus-db-rw.prod.svc.cluster.local`）、`envFrom: directus-secrets`、ConfigMap `directus-schema` を `/snapshot` にマウント、migrations ConfigMap を `/directus/extensions/migrations` に。
  - ArgoCD hook: `PostSync` + `hook-delete-policy: HookSucceeded` + `ttlSecondsAfterFinished: 3600`、`restartPolicy: OnFailure`。
  - ConfigMap ファイル名 `schema-configmap.yaml`（名前 `directus-schema`）、migrations は `migrations-configmap.yaml`（名前 `directus-migrations`）。
  - staging secret 名は `directus-staging-secrets`（requirements 5.2 の `directus-secrets` と相違）、namespace `staging`。
  - `directus.yaml` App は `automated.selfHeal: true`（req 4.9 と一致）。
  - web リポジトリには `directus/migrations/*.js`（RBAC 等）が存在し、既存 workflow が migrations ConfigMap も生成する。requirements は migrations に言及していないが実運用で必要。
- **Implications**: 既存の DB 直結 + migration 併走方式を踏襲。requirements 4.3/4.4 の HTTP API・ADMIN 認証は DB 直結・`envFrom directus-secrets` に読み替え。命名は既存 infra に合わせ、SHA 一意化は「ConfigMap 内容が SHA ごとに変わる → PostSync Job が毎回再実行」で満たす（Job 名の SHA 埋め込みは不要と判断、req 3.3/4 の意図＝再適用の確実性は ConfigMap 更新で達成）。

### Infisical CLI + GitHub App 認証

- **Context**: req 7.x が Infisical を SSoT とし、GH secrets は Infisical machine identity のみ。GitHub App トークンを runtime 生成。
- **Sources Consulted**: `infisical run` CLI、`actions/create-github-app-token`、既存 `.infisical.json`（workspaceId 設定済み）。
- **Findings**:
  - `infisical run --env=<env> --projectId=<id> -- <cmd>` で環境変数注入。認証は `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET`（machine identity）を `infisical login --method=universal-auth` 相当で使用。
  - GitHub App: `actions/create-github-app-token@v1` に App ID + private key を渡し短命 installation token を生成。App ID / private key は Infisical に保管し `infisical run` で注入。App 権限は `aramakisai-infra` の `contents:write` + `pull-requests:write` のみ。
  - requirements 6.4（CLOUDFLARE_* を GH secrets とする）と 7.3（CLOUDFLARE_* を Infisical とする）が矛盾。→ **7.3 を採用**（Infisical SSoT 原則を優先）。GH secrets は `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET` の 2 つのみ。
- **Implications**: 両 workflow 冒頭で Infisical CLI setup → `infisical run` ラップで build/deploy/PR 作成を実行。fork PR では secrets を露出しない（`pull_request` イベントの制約 + Infisical creds を expose しない条件付き実行）。

---

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| GHA を唯一の CD トリガー（採用） | PR/main push を GHA が受け、検証 → Infisical 注入ビルド → Workers デプロイ → schema 差分検知 → infra PR 自動化 | 単一責務境界、secret を Infisical に集約、監査可能 | GHA 障害時に手動フォールバック要 | requirements 6.6 の意図（CD 経路を GHA に一本化）に合致 |
| Cloudflare 側 Git 連携併用 | Cloudflare の Git integration も有効化 | 設定簡易 | 二重デプロイ・env 不整合・secret 分散 | 却下（req 6.6） |
| Pages + next-on-pages | requirements 文言に忠実 | infra pages.tf と一致 | scaffold 巻き戻し、非推奨アダプタへ逆行 | 却下（Workers 決定） |

---

## Design Decisions

### Decision: デプロイ先を Cloudflare Workers（OpenNext）に確定

- **Context**: requirements/infra は Pages、コミット済みコードは Workers。両立不可。
- **Alternatives Considered**:
  1. Workers 採用 — infra `pages.tf` 1 リソースを Workers 化する追従のみ。
  2. Pages 採用 — frontend ツールチェーンを next-on-pages へ巻き戻し（scaffold spec 再オープン）。
- **Selected Approach**: Workers 採用。CD は `opennextjs-cloudflare build/deploy`、preview は `wrangler versions upload`。
- **Rationale**: 実装済みコードとの整合、変更量最小、非推奨アダプタ回避、ユーザー方針（CLAUDE.md 非盲信）。
- **Trade-offs**: requirements.md の Pages 文言と infra `pages.tf` の書き換えが必要（後者は別 spec 所有 → Revalidation Trigger 化）。
- **Follow-up**: cloudflare-pages-project spec 側で `cloudflare_pages_project` → `cloudflare_workers_script`（またはダッシュボード管理 + custom domain route）へ移行。CLAUDE.md の Pages 記述更新。

### Decision: スキーマ適用 Job は既存 infra の DB 直結方式を踏襲

- **Context**: requirements 4.3/4.4 は HTTP API + ADMIN 認証だが、Directus `schema apply` CLI は DB 接続で動作。
- **Selected Approach**: 既存 `schema-apply-job.yaml` の DB 直結（`DB_HOST` env + `envFrom directus-secrets`）+ `migrate:latest` 併走 + `schema apply --yes` を踏襲。
- **Rationale**: 技術的に正しい唯一の方式。既存 infra と一致し ArgoCD 運用実績あり。
- **Trade-offs**: requirements 文言との差分を明示的にドキュメント化する必要。
- **Follow-up**: staging secret 名は `directus-staging-secrets`（req 5.2 と相違）を採用。

### Decision: SHA 一意化は Job 名でなく ConfigMap 内容で担保

- **Context**: req 3.3/4 は「SHA を Job 名に埋めて ArgoCD 重複排除回避」。
- **Selected Approach**: ArgoCD PostSync hook + ConfigMap（snapshot 内容が変わる）更新で Job を毎回再実行。Job 名は静的 `directus-schema-apply`。
- **Rationale**: PostSync hook は sync のたびに Job を再生成するため SHA 埋め込み不要。既存パターンを維持し複雑性を下げる。
- **Trade-offs**: req 文言（一意名）から逸脱。意図（確実な再適用）は満たす。

### Decision: Secret は Infisical SSoT、GH secrets は machine identity のみ

- **Context**: req 6.4 と 7.3 が矛盾。
- **Selected Approach**: `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET` のみ GH secrets。他は全て `infisical run` 注入。
- **Rationale**: req 7.2/7.3 の SSoT 原則を優先。攻撃面最小化。
- **Trade-offs**: 各 job で Infisical CLI setup のオーバーヘッド。

---

## requirements.md → 設計の読み替え表

| Req | 原文（Pages/HTTP 前提） | 設計での読み替え（Workers/DB 直結） |
|-----|------------------------|-------------------------------------|
| 1.2 | `pnpm build` with `NEXT_PUBLIC_DIRECTUS_URL=https://stg-api...` | `infisical run --env=staging -- pnpm exec opennextjs-cloudflare build`（値は Infisical staging） |
| 1.6 | Cloudflare Pages preview URL を PR コメント | `wrangler versions upload` の Version Preview URL を PR コメント |
| 6.1/6.2 | `wrangler pages deploy` (staging) | PR: `wrangler versions upload`（preview） |
| 6.3 | `wrangler pages deploy --branch main` (prod) | main: `opennextjs-cloudflare deploy`（prod Worker 更新） |
| 6.4 | CLOUDFLARE_* を GH secrets | Infisical に保管（7.3 優先） |
| 6.6 | native Pages GitHub 連携を無効化 | Workers の Git integration を有効化しない（同義） |
| 4.3 | `npx directus schema apply` を HTTP `:8055` に | `node /directus/cli.js schema apply --yes /snapshot/snapshot.yaml`（DB 直結） |
| 4.4 | ADMIN_EMAIL/PASSWORD で認証 | `envFrom directus-secrets`（DB_PASSWORD で DB 認証、CLI は DB で動作） |
| 4.6 | restartPolicy Never / backoffLimit 1 | 既存の restartPolicy OnFailure を踏襲（破壊的変更防止は backoffLimit 1 で補強） |
| 4.7 | hook: Sync | 既存の hook: PostSync（apply 後に確実実行、同義の運用） |
| 3.1/3.3 | branch `schema-apply/<sha>` / Job 名に SHA | branch `directus-schema-<sha8>` / Job 名は静的（ConfigMap 更新で再実行） |
| 5.2 | staging secret `directus-secrets` | `directus-staging-secrets`（既存 infra） |

---

## Risks & Mitigations

- **infra pages.tf との不整合** — Workers 移行を cloudflare-pages-project spec の追従作業として明記。移行前は prod デプロイ不可のため、CD の prod deploy job は Worker 実体が存在するまで手動 gate。
- **`wrangler versions upload` の preview URL 抽出の脆さ** — CLI JSON 出力（`--json` 対応版）または stdout パースをフォールバック併用。wrangler バージョンを pin。
- **`NEXT_PUBLIC_*` の誤環境インライン化** — build と deploy で同一 `--env` を使用。preview=staging、prod=prod を job 単位で固定。
- **fork PR での secret 露出** — `pull_request` イベントでは Infisical creds を使う job を `github.event.pull_request.head.repo.fork == false` 条件で gate。
- **破壊的スキーマ変更の本番適用** — additive-only ルールを CLAUDE.md + PR チェックリストで強制、`backoffLimit: 1` で連続再試行を防止、staging 検証を prod マージ必須条件化。

---

## References

- [OpenNext Cloudflare adapter](https://opennext.js.org/cloudflare) — Workers 用 Next.js アダプタ（scaffold 採用）
- [Cloudflare Workers Versions & Deployments](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/) — `wrangler versions upload` preview URL
- [actions/create-github-app-token](https://github.com/actions/create-github-app-token) — 短命 App installation token
- [Infisical CLI `run`](https://infisical.com/docs/cli/commands/run) — secret 注入
- infra `.kiro/specs/cloudflare-pages-project/design.md` — Pages 前提の隣接 spec（要 Workers 追従）
