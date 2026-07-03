# Implementation Plan

> 前提: デプロイ先は Cloudflare **Workers**（OpenNext）。requirements.md の Pages 文言の読み替えは `design.md` Overview / `research.md` を参照。
> GitHub App の作成・インストール、Infisical への secret 登録、infra リポジトリのブランチ保護設定は本 spec の boundary 外（手動事前作業）。本タスクはそれらを前提に workflow / manifest / 設定ファイルを実装する。

- [ ] 1. Foundation: Infisical 注入基盤と secret 契約の確立
- [x] 1.1 Frontend Infisical プロジェクト設定と secret 注入契約
  - `frontend/.infisical.json` を作成し、workspaceId と staging/prod 環境マッピングを定義する
  - GHA で使う secret を「GH secrets は `INFISICAL_CLIENT_ID` / `INFISICAL_CLIENT_SECRET` の 2 件のみ」に限定する方針を workflow の共通セットアップとして確立する
  - `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` / `NEXT_PUBLIC_*` / GitHub App 資格情報が全て Infisical から `infisical run --env=<env>` で注入される前提を固める
  - 完了条件: `infisical run --env=staging -- printenv` 相当が CI 上で必要な env を返し、ログに secret 値が出力されない
  - _Requirements: 7.1, 7.2, 7.3, 7.5_

- [x] 2. Frontend CI 検証パイプライン
- [x] 2.1 (P) PR / main の検証ジョブを構築
  - `pull_request`（opened/synchronize/reopened, target main）と `push:main` で発火し、`working-directory: frontend` で install（frozen-lockfile）→ type-check → lint → format:check → test → build を実行する
  - pnpm キャッシュ + `.next/cache` をラン間で保持しビルド時間を短縮する
  - 検証ジョブ実行中の進行状況を GitHub の check status に報告する
  - build は型/env スキーマ検証目的でダミー `NEXT_PUBLIC_*` を用い、fork PR でも実行可能にする
  - 完了条件: 型エラーを含む PR で検証が failed になり、成功 PR では全ステップが緑になる
  - _Requirements: 1.1, 1.3, 1.4, 1.5_
  - _Boundary: FrontendCIWorkflow_
  - _Depends: 1.1_

- [x] 2.2 fork PR に対する secret 保護ゲート
  - fork（`head.repo.fork == true`）PR では Infisical 資格情報を要するジョブを skip し、リポジトリ secret を露出しない
  - 完了条件: fork PR 実行時に Infisical/Cloudflare secret を参照するジョブがスキップされ、検証ジョブのみ走る
  - _Requirements: 7.6_

- [x] 3. Frontend Workers デプロイ（preview / prod）
- [x] 3.1 PR preview デプロイと URL 通知
  - 検証ジョブ成功後（非 fork PR）に `infisical run --env=staging -- pnpm exec opennextjs-cloudflare build` で staging 向け `NEXT_PUBLIC_*` をインライン化してビルドする
  - `wrangler versions upload` で本番トラフィックを変えずに Version Preview URL を発行し、PR にコメント（既存があれば更新）する
  - Cloudflare の Git ネイティブ連携は使わず、デプロイ経路を GHA に一本化する
  - 完了条件: PR に staging Directus 向け preview URL が 1 件コメントされ、prod Worker は変化しない
  - _Requirements: 1.2, 1.6, 1.7, 6.2, 6.6_
  - _Depends: 2.1_

- [x] 3.2 main の本番 Workers デプロイ
  - `push:main` で検証成功を前提に `infisical run --env=prod -- pnpm exec opennextjs-cloudflare build` → `opennextjs-cloudflare deploy` を実行する
  - Cloudflare 認証は Infisical 由来の `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` を使う
  - デプロイ失敗時は workflow を failed とし GHA ログにエラーを surface する
  - 前段の検証（type-check/build）が失敗した場合は deploy ジョブを実行しない
  - 完了条件: main push で prod Worker が更新され、検証失敗時は deploy がスキップされる
  - _Requirements: 6.1, 6.3, 6.4, 6.5_
  - _Depends: 3.1_

- [x] 4. Directus スキーマ変更検知と infra 自動 PR
- [x] 4.1 (P) snapshot 差分検知ジョブ
  - `push:main` かつ paths `directus/schema/snapshot.yaml`（および `directus/migrations/**`）で発火する
  - 前コミットとの diff で `snapshot.yaml` の変更有無を判定し、無変更なら PR / manifest を作らず exit 0 する
  - トリガーコミットの SHA を後続リソースの一意識別子として読み取る
  - 完了条件: 検知が 60 秒以内に完了し、無変更 push では後続処理がスキップされる
  - _Requirements: 2.1, 2.2, 2.3, 2.4_
  - _Boundary: SchemaSyncWorkflow_
  - _Depends: 1.1_

- [x] 4.2 GitHub App 認証と infra リポジトリ取得
  - Infisical から GitHub App ID / private key を注入し、`actions/create-github-app-token` で短命 installation token を生成する
  - App 権限は `aramakisai-infra` の `contents:write` + `pull-requests:write` のみに限定し、生成 token で infra を checkout する
  - schema apply の DB 認証情報は K8s Job 側 ESO が担い、GHA では扱わないことを保証する
  - 完了条件: PAT を使わず短命 App token で infra への読み書きが成立する
  - _Requirements: 3.6, 7.1, 7.4_
  - _Depends: 4.1_

- [x] 4.3 prod / staging の ConfigMap 生成とブランチ push
  - `snapshot.yaml` を data 化した ConfigMap（`directus-schema`）を prod / staging 双方に生成する（`kubectl create configmap --dry-run=client -o yaml`）
  - 必要に応じ `directus/migrations/*.js` を migrations ConfigMap として prod / staging 双方に生成する
  - `directus-schema-<sha8>` ブランチを作成して push し、差分が無ければ skip する
  - 完了条件: infra ブランチに prod / staging の ConfigMap が commit される
  - _Requirements: 3.1, 3.2, 3.3, 5.1_
  - _Depends: 4.2_

- [x] 4.4 infra PR 生成と staging gate / additive-only ルール
  - infra `main` 宛に PR を作成し、title / body にトリガー SHA と web ソースコミットへのリンクを含める
  - 同一 SHA の PR が既存なら作成を skip し exit 0 する
  - PR body に「staging schema-apply Job 成功確認」チェックリスト項目、staging Cloudflare preview URL（frontend E2E 用直接リンク）、`stg-api.aramakisai.com`（API 参照）を埋め込む
  - additive-only（破壊的変更禁止）ルールを PR チェックリスト項目として明文化し、`CLAUDE.md` にも記載する
  - 完了条件: 変更時に infra PR が 1 件作られ、同 SHA 再実行で重複しない
  - _Requirements: 3.4, 3.5, 3.7, 5.4_
  - _Depends: 4.3_

- [x] 5. K8s スキーマ適用 Job マニフェスト（infra 側）
- [x] 5.1 (P) prod schema-apply Job マニフェスト
  - prod Deployment と同一の `directus/directus:12.1.1` イメージで Job を定義し、`directus-schema` ConfigMap を `/snapshot/snapshot.yaml` にマウントする
  - コンテナ起動時に `database migrate:latest` → `schema apply --yes /snapshot/snapshot.yaml` を実行し、DB 直結（`DB_HOST`）+ `envFrom: directus-secrets` で認証する
  - 非 0 終了で Job を failed とし、`restartPolicy: OnFailure` + `backoffLimit: 1` で破壊的変更の連続再試行を防ぐ
  - ArgoCD hook（`PostSync`）+ `hook-delete-policy: HookSucceeded` + `ttlSecondsAfterFinished: 3600` を付与する
  - 完了条件: infra PR マージ後に ArgoCD が Job を実行し、成功時に自動削除される
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_
  - _Boundary: SchemaApplyJob_

- [x] 5.2 staging Job マニフェストと ArgoCD 連携確認
  - staging Job を `http://directus.staging.svc.cluster.local:8055` 相当の staging DB 直結 + `directus-staging-secrets`（namespace `staging`）で定義する
  - ArgoCD `directus` / `directus-staging` App が `automated.selfHeal: true` で PR マージ直後に Job を反映することを確認する
  - staging Directus 基盤（DB / ExternalSecret / Service）が稼働済みである前提を検証する
  - 完了条件: staging PR マージで staging Job が適用され、prod と同一フローで動く
  - _Requirements: 4.9, 5.2, 5.3_
  - _Depends: 5.1_

- [x] 5.3 infra ブランチ保護による staging gate 設定
  - `aramakisai-infra` に、prod Job manifest マージ前にチェックリスト完了を必須とするブランチ保護ルールを設定する
  - 完了条件: staging 確認チェック未完了の infra PR が prod にマージできない
  - _Requirements: 5.5_
  - _Depends: 5.2_

- [ ] 6. 統合・検証
- [ ] 6.1 パイプライン統合テスト
  - 検証ゲート（型エラー PR で deploy skip）、非 fork PR の preview 発行、fork PR の secret 非露出、snapshot 無変更の PR 非生成、同一 SHA の冪等 PR を確認する
  - 完了条件: 上記シナリオが期待どおり pass / skip する
  - _Requirements: 1.3, 2.2, 3.5, 6.1, 7.6_
  - _Depends: 3.2, 4.4_

- [ ] 6.2 生成物の静的検証
  - 生成 ConfigMap を `kubectl apply --dry-run=server` で検証し、GitHub App 権限が `aramakisai-infra` 限定・`contents+pull_requests` のみであることを確認する
  - 完了条件: dry-run が成功し、過剰権限の token が存在しない
  - _Requirements: 3.6, 4.2_
  - _Depends: 4.3, 5.1_
