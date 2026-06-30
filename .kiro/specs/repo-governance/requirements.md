# Requirements Document

## Project Description (Input)
`aramakisai-web` GitHub リポジトリのガバナンス設定を整備する。
branch protection rules・必須ステータスチェック・GitHub Secrets (CI/CD 用) を設定し、
壊れたコードが main にマージされることと、シークレットの未設定によるデプロイ失敗を防ぐ。
`cicd-pipeline` spec の前提となるリポジトリ設定を確立する。

## Introduction

本仕様は `aramakisai-web` リポジトリの GitHub 設定を整備するものである。
`cicd-pipeline` spec が完了し GitHub Actions ワークフローが存在した後に本 spec を実装する。
ただし GitHub Secrets の登録は `cicd-pipeline` 実装前でも可能であり、並行して進めてよい。

## Boundary Context

- **In scope**:
  - `main` ブランチの branch protection rules
  - 必須ステータスチェック (CI jobs)
  - GitHub Actions Secrets の登録 (`aramakisai-web` リポジトリ)
  - Infisical staging Directus シークレットの登録 (CI/CD 前提条件)
- **Out of scope**:
  - GitHub Actions ワークフロー定義 (cicd-pipeline spec で管理)
  - GitHub チームメンバー管理・権限設定
  - aramakisai-infra リポジトリ側の設定
- **Adjacent expectations**:
  - branch protection は GitHub UI または `gh` CLI で設定 (Terraform GitHub provider は今回不使用)
  - GitHub Secrets の値は Infisical から取得して登録する

---

## Requirements

### Requirement 1: main ブランチ保護

**Objective:** 開発者として、型チェック・ビルド・デプロイが通過しないと `main` にマージできないことを望む。これにより壊れたコードが本番環境に到達することを防ぐ。

#### Acceptance Criteria

1. The `main` branch shall have branch protection rules enabled requiring at least 1 passing status check before merge is allowed.
2. The branch protection shall require the following status checks to pass: `type-check`, `build`, and the Cloudflare Pages deployment check.
3. The branch protection shall enforce status checks even for repository administrators.
4. If any required status check is absent (workflow not yet run), the CI Pipeline shall block merge until the check completes.
5. The `main` branch shall require Pull Requests — direct pushes to `main` shall be disallowed for all users including administrators.

---

### Requirement 2: GitHub Actions Secrets 登録

**Objective:** インフラ管理者として、CI/CD ワークフローが参照する全シークレットが `aramakisai-web` リポジトリに登録されていることを望む。未登録のシークレットによるワークフロー失敗を防ぐ。

#### Acceptance Criteria

1. A dedicated GitHub App shall be created (named e.g. `aramakisai-infra-pr-creator`) with `contents:write` and `pull-requests:write` permissions scoped to `aramakisai-infra` only; the App ID and private key shall be stored in Infisical (not as individual GitHub Actions secrets) and fetched at workflow runtime via the Infisical CLI. Personal Access Tokens shall not be used for cross-repo automation.
2. The `aramakisai-web` repository shall have exactly two GitHub Actions secrets: `INFISICAL_CLIENT_ID` and `INFISICAL_CLIENT_SECRET` (Infisical machine identity credentials); all other secrets and environment variables (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, GitHub App credentials, `NEXT_PUBLIC_*`) shall be stored in Infisical and injected via `infisical run --`.
3. When the Infisical machine identity credentials are rotated, the new values shall be updated in GitHub Actions secrets within 24 hours.
4. The secret values shall not be stored in any file committed to the repository.

---

### Requirement 3: Infisical staging Directus シークレット登録

**Objective:** インフラ管理者として、staging Directus の ExternalSecret が参照する Infisical キーが登録済みであることを望む。これにより staging 環境が起動時にシークレット取得に失敗しない。

#### Acceptance Criteria

1. The Infisical project shall contain the key `DIRECTUS_STAGING_SECRET` with a randomly generated secret value for the staging Directus instance.
2. The Infisical project shall contain the key `DIRECTUS_STAGING_ADMIN_EMAIL` with the staging admin email address.
3. The Infisical project shall contain the key `DIRECTUS_STAGING_ADMIN_PASSWORD` with a strong password for the staging Directus admin account.
4. The Infisical project shall contain the key `DIRECTUS_STAGING_DB_PASSWORD` with the password used by both the staging Directus pod and the CNPG `directus-staging-db-credentials` secret.
5. When the above keys are registered, the `DIRECTUS_STAGING_*` key names shall be added to the Infisical secrets list in `aramakisai-infra/.kiro/steering/tech.md` to keep the project memory current.
6. If `kubectl get externalsecret directus-staging-secrets -n staging` does not show `Ready` status after ESO sync, the Infisical key values shall be verified and corrected before proceeding with staging validation.

---

### Requirement 4: pre-commit フック設定

**Objective:** 開発者として、機密情報・秘密鍵・絶対パスがコミットされる前に自動検知・ブロックされることを望む。またコードの基本的な衛生状態 (trailing whitespace、改行コード等) を自動修正したい。`aramakisai-infra` と同等の保護レベルを `aramakisai-web` にも適用する。

#### Acceptance Criteria

1. The `aramakisai-web` repository shall include a `.pre-commit-config.yaml` at the repository root enabling pre-commit hooks for all contributors.
2. The pre-commit configuration shall include `pre-commit-hooks` (trailing-whitespace, end-of-file-fixer, check-merge-conflict, mixed-line-ending) for basic file hygiene.
3. The pre-commit configuration shall include `gitleaks` (same version as `aramakisai-infra`) to detect secrets, API keys, and credentials patterns before commit.
4. The pre-commit configuration shall include a local hook invoking `check-confidential-info.py` (copied from `aramakisai-infra/scripts/`) to detect absolute home directory paths and non-allowlisted email addresses; the script shall run on `.ts`, `.tsx`, `.js`, `.json`, `.md`, `.yaml`, `.yml` file types.
5. The pre-commit configuration shall include a `.gitleaks.toml` matching the one in `aramakisai-infra` to share the same secret detection rules across repos.
6. When a commit contains a hardcoded email address not on the allowlist, the `check-confidential-info.py` hook shall block the commit and print the offending line with instructions to append `# confidential:allow`.
7. When a commit contains an absolute path matching the committer's home directory, the `check-confidential-info.py` hook shall block the commit.
8. If a line must bypass the check (e.g., a legitimate email in config), the developer shall append `# confidential:allow` (code) or `<!-- confidential:allow -->` (Markdown) to that line to bypass only that line.
9. The `scripts/check-confidential-info.py` and `.gitleaks.toml` shall be committed to `aramakisai-web` and kept in sync with `aramakisai-infra` when the upstream script is updated.
