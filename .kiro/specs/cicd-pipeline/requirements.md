# Requirements Document

## Project Description (Input)
aramakisai-infraはこのホームページのバックエンドであるDirectusのデプロイ先です
これを踏まえてCI/CDを作成してください
またフルスクラッチでの開発になるのでCLAUDE.mdを盲信せず、柔軟に変更していきたい

## Introduction

本仕様は、荒牧祭ホームページ (`aramakisai-web`) の CI/CD パイプラインをゼロから構築するものである。
**前提**: `frontend-scaffold` spec が完了し、`frontend/` ディレクトリ・`wrangler.toml`・`pnpm type-check`/`pnpm build` スクリプトが存在する状態で本 spec を実装する。
Cloudflare Pages プロジェクト連携・GitHub Actions ワークフロー・Directus スキーマ GitOps 連携が対象。

## Boundary Context

- **In scope**:
  - Cloudflare Pages プロジェクトの GitHub リポジトリ連携・ダッシュボード設定 (`wrangler.toml` は frontend-scaffold spec で作成済みのものを使用)
  - GHA ビルドステップでの `NEXT_PUBLIC_*` 環境変数注入 (ビルド時インライン化のため dashboard/Terraform 設定では反映されない)
  - `aramakisai-web` リポジトリの GitHub Actions ワークフロー (PR 検証・スキーマ同期)
  - `aramakisai-infra` リポジトリへの自動 PR 生成ロジック
  - `aramakisai-infra` 側の Directus スキーマ適用 K8s Job マニフェスト
- **Out of scope**:
  - Terraform / Ansible の自動実行
  - Directus コンテナイメージのバージョン管理
  - Next.js フロントエンドのアプリケーションコード実装
- **Adjacent expectations**:
  - `aramakisai-infra` は ArgoCD App of Apps パターンで管理。`gitops/apps/` 配下のファイル変更が ArgoCD に自動検知される
  - シークレット管理は Infisical が Single Source of Truth
  - `@cloudflare/next-on-pages` の Edge Runtime 制約により Node.js 専用 API は使用不可

---

## Requirements

### Requirement 1: PRバリデーション

**Objective:** 開発者として、Pull Request 時に型チェック・ビルドの自動検証と Cloudflare Pages プレビュー URL による動作確認が行われることを望む。スキーマ変更・フロントエンド変更を問わず、全ての PR で staging 環境を用いた End-to-End 確認が可能であること。

#### Acceptance Criteria

1. When a Pull Request is opened, synchronized, or reopened against the `main` branch, the CI Pipeline shall execute TypeScript type-checking (`pnpm type-check`) in the `frontend/` directory.
2. When a Pull Request is opened, synchronized, or reopened against the `main` branch, the CI Pipeline shall execute a production build (`pnpm build`) in the `frontend/` directory with `NEXT_PUBLIC_DIRECTUS_URL=https://stg-api.aramakisai.com` set as a build-time environment variable so that the compiled output targets the staging Directus instance.
3. If the type-check or build step fails, the CI Pipeline shall mark the PR check as failed and prevent merge via branch protection rules.
4. While the PR validation workflow is running, the CI Pipeline shall report the in-progress status to GitHub so developers can observe progress.
5. The CI Pipeline shall cache `node_modules` and `.next/cache` between runs to reduce build time.
6. When a Pull Request is opened or synchronized, the CI Pipeline shall deploy to Cloudflare Pages preview and post the resulting URL as a PR comment or commit status so reviewers can perform End-to-End verification against the staging Directus backend (`https://stg-api.aramakisai.com`).
7. The `NEXT_PUBLIC_DIRECTUS_URL` value shall be sourced from Infisical (not the Cloudflare Pages dashboard and not hardcoded in the workflow YAML); the Infisical CLI shall inject it at build time so that Next.js inlines the correct endpoint into the compiled output.

---

### Requirement 2: Directus スキーマ変更検知

**Objective:** 開発者として、`directus/schema/snapshot.yaml` に変更が加えられたことを CI が自動検知することを望む。これにより、スキーマ変更のデプロイが手動作業に依存しない状態になる。

#### Acceptance Criteria

1. When a commit is pushed to the `main` branch, the Schema Sync Pipeline shall detect whether `directus/schema/snapshot.yaml` has changed compared to the previous commit.
2. If `directus/schema/snapshot.yaml` has not changed, the Schema Sync Pipeline shall exit without creating any Pull Request or K8s manifest.
3. The Schema Sync Pipeline shall read the commit SHA of the triggering commit for use as a unique identifier in downstream resources.
4. The CI Pipeline shall complete schema change detection within 60 seconds.

---

### Requirement 3: aramakisai-infra への自動PR作成

**Objective:** 開発者として、Directus スキーマが変更された際に `aramakisai-infra` への Pull Request が自動作成されることを望む。これにより、GitOps の原則を維持しながらスキーマ変更をクラスターに反映できる。

#### Acceptance Criteria

1. When `directus/schema/snapshot.yaml` changes on the `main` branch, the Schema Sync Pipeline shall create a new branch in the `aramakisai-infra` repository named `schema-apply/<commit-sha>`.
2. When creating the infra branch, the Schema Sync Pipeline shall write a `ConfigMap` manifest to `gitops/manifests/prod/directus/schema-snapshot-cm.yaml` containing the full content of `snapshot.yaml` as a data entry.
3. When creating the infra branch, the Schema Sync Pipeline shall write a K8s `Job` manifest to `gitops/manifests/prod/directus/schema-apply-job.yaml` with a unique name incorporating the commit SHA to avoid ArgoCD deduplication.
4. When the branch and manifests are ready, the Schema Sync Pipeline shall open a Pull Request against `aramakisai-infra`'s `main` branch with a descriptive title including the originating commit SHA and a body linking to the source commit in `aramakisai-web`.
5. If a Pull Request for the same commit SHA already exists in `aramakisai-infra`, the Schema Sync Pipeline shall skip PR creation and exit successfully.
6. The Schema Sync Pipeline shall authenticate to `aramakisai-infra` using a dedicated GitHub App (not a personal access token) by generating a short-lived installation token at workflow runtime; the App shall have `contents:write` and `pull-requests:write` permissions scoped to `aramakisai-infra` only.
7. All Directus schema changes committed to `aramakisai-web` shall be backward-compatible (additive only: new collections/fields allowed; destructive changes such as field deletion or type change forbidden until the corresponding frontend code has been deployed and confirmed stable); this rule shall be documented in `CLAUDE.md` and enforced by PR review process.

---

### Requirement 4: K8s スキーマ適用ジョブ (infra 側マニフェスト)

**Objective:** インフラ管理者として、ArgoCD が検知してデプロイできる K8s Job が `aramakisai-infra` に存在することを望む。これにより、PR マージ後に ArgoCD が自動的に Directus スキーマを本番クラスターへ適用できる。

#### Acceptance Criteria

1. The Schema Apply Job shall run a container using the same `directus/directus` image version as the production Deployment to ensure CLI compatibility.
2. When the Job starts, the CI Pipeline shall mount the `schema-snapshot-cm` ConfigMap as a file at `/schema/snapshot.yaml` inside the container.
3. When mounted, the Job shall execute `npx directus schema apply /schema/snapshot.yaml --yes` against the production Directus instance (`http://directus.prod.svc.cluster.local:8055`).
4. The Job shall inherit `DIRECTUS_ADMIN_EMAIL` and `DIRECTUS_ADMIN_PASSWORD` from the existing `directus-secrets` ExternalSecret to authenticate the schema apply operation.
5. If the schema apply command exits with a non-zero code, the Job shall be marked as failed and ArgoCD shall report the failure.
6. The Job shall have `restartPolicy: Never` and `backoffLimit: 1` to prevent repeated application of a potentially destructive schema change.
7. The Job manifest shall include the annotation `argocd.argoproj.io/hook: Sync` and `argocd.argoproj.io/hook-delete-policy: HookSucceeded` so that ArgoCD treats it as a sync hook and automatically deletes it upon successful completion, preventing resource accumulation.
8. The Job manifest shall include `spec.ttlSecondsAfterFinished: 3600` as a fallback cleanup mechanism in case ArgoCD hook deletion does not trigger.
9. The Schema Apply Job shall be listed under an ArgoCD Application that has `automated.selfHeal: true` so that ArgoCD deploys the Job immediately after the infra PR is merged.

---

### Requirement 5: ステージング環境でのスキーマ事前検証

**Objective:** 開発者として、本番適用前にステージング環境でスキーマが正常に適用できることを確認したい。また、infra PR 作成時点でステージング環境が整備済みであることを前提とし、staging での動作確認を本番マージの必須条件とする。

#### Acceptance Criteria

1. The Schema Sync Pipeline shall also write a staging Job manifest (`gitops/manifests/staging/directus/schema-apply-job.yaml`) and corresponding ConfigMap (`gitops/manifests/staging/directus/schema-snapshot-cm.yaml`) in the same infra PR.
2. The staging Job shall connect to `http://directus.staging.svc.cluster.local:8055` and use staging-specific secrets (`directus-secrets` in the `staging` namespace).
3. The staging Directus deployment (`gitops/manifests/staging/directus/`) shall be fully operational — including DB cluster, ExternalSecret, and Service — before this CI/CD pipeline is deployed to production.
4. When the infra PR body is generated, the CI Pipeline shall include a mandatory checklist item requiring the reviewer to confirm that the staging schema-apply Job completed successfully before merging to prod, and shall embed the Cloudflare Pages staging deployment URL as a direct link so the reviewer can perform end-to-end verification via the frontend; the staging Directus admin URL (`https://stg-api.aramakisai.com`) shall be listed as a secondary reference for API-level inspection only.
5. The infra PR shall use a GitHub branch protection rule requiring the checklist to be checked before the prod Job manifests are merged.

---

### Requirement 6: Cloudflare Pages デプロイ (GitHub Actions 経由)

**Objective:** 開発者として、型チェック・ビルドを通過したコードのみが Cloudflare Pages にデプロイされることを望む。GitHub Actions を唯一の CD トリガーとし、Cloudflare Pages ネイティブ GitHub 連携は使用しない。
**前提**: Pages プロジェクト自体の作成・環境変数・カスタムドメイン設定は `aramakisai-infra` の `cloudflare-pages-project` spec で Terraform 管理されており、本 spec の実装時点で完了済みであること。

#### Acceptance Criteria

1. The CI Pipeline shall define a deploy workflow that runs `wrangler pages deploy` after all validation steps (type-check, build) have passed; if any prior step fails the deploy step shall not execute.
2. When a Pull Request is opened or synchronized, the CI Pipeline shall inject environment variables via `infisical run --env=staging --` before executing `pnpm build`, so that `NEXT_PUBLIC_DIRECTUS_URL` and other build-time variables are sourced from Infisical (staging environment) rather than hardcoded in the workflow; the built artifact is then deployed with `wrangler pages deploy --branch <branch-name>`.
3. When a commit is pushed to `main`, the CI Pipeline shall inject environment variables via `infisical run --env=prod --` before executing `pnpm build`, so that production values are sourced from Infisical (prod environment); the built artifact is then deployed with `wrangler pages deploy --branch main`.
4. The CI Pipeline shall authenticate to Cloudflare Pages using `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` stored as GitHub Actions secrets.
5. If the `wrangler pages deploy` command fails, the CI Pipeline shall mark the workflow as failed and surface the error in the GitHub Actions log.
6. The Cloudflare Pages native GitHub App integration shall be disabled so that deployments are triggered exclusively through GitHub Actions.

---

### Requirement 7: シークレット・権限管理

**Objective:** セキュリティ担当者として、CI/CD パイプラインが最小権限の原則に従ってシークレットを扱うことを望む。

#### Acceptance Criteria

1. The CI Pipeline shall authenticate to `aramakisai-infra` using a dedicated GitHub App (not a personal access token); the App ID and private key shall be stored in Infisical and fetched via `infisical run --` at workflow runtime; a short-lived installation token shall be generated using `actions/create-github-app-token`.
2. Infisical is the Single Source of Truth for all environment variables and secrets; the only values stored directly as GitHub Actions secrets shall be the Infisical machine identity credentials (`INFISICAL_CLIENT_ID`, `INFISICAL_CLIENT_SECRET`) used to authenticate the Infisical CLI within GHA.
3. `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `NEXT_PUBLIC_DIRECTUS_URL`, `NEXT_PUBLIC_SITE_URL`, and the GitHub App credentials shall all be stored in Infisical and injected into GHA workflows via `infisical run --env=<env> --`; they shall not be stored as individual GitHub Actions secrets.
4. The CI Pipeline shall not require Hetzner, Tailscale credentials directly — schema apply credentials are handled entirely by the K8s Job via the existing ESO/ExternalSecret mechanism.
5. The CI Pipeline shall not log or echo the value of any secret environment variable.
6. When the PR validation workflow runs on a fork Pull Request, the CI Pipeline shall not expose any repository secrets to the forked workflow.
