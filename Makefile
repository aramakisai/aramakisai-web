
.PHONY: kubectl dev signage-dev dev-ps dev-stop preview cms cms-worktree

kubectl: ## kubectl を手元のコンテキスト aramakisai-prod で実行 (例: make kubectl ARGS="get pods -A")。事前に aramakisai-infra で make kube-login
	@kubectl --context aramakisai-prod $(ARGS)

dev: ## frontend の開発サーバーを起動 (ポートは worktree ごとに自動決定。CMS=worktree で cms-worktree を参照)
	@scripts/dev.sh dev $(CMS)

signage-dev: ## サイトとサイネージのハブをまとめて起動 (ポートは dev と同じ。CMS=worktree で cms-worktree を参照)
	@scripts/dev.sh signage-dev $(CMS)

dev-ps: ## 3000-4999 で listen 中の開発サーバー一覧 (ポート/役割/worktree/ブランチ/pid)
	@scripts/dev.sh dev-ps

dev-stop: ## 自 worktree の frontend サーバーを停止 (CMS=worktree で cms-worktree を停止)
	@scripts/dev.sh dev-stop $(CMS)

preview: ## ポート3000のプレビュー環境を起動 (BRANCH=<branch>) または状態表示 (BRANCH省略時)
	@scripts/dev.sh preview "$(BRANCH)"

cms: ## 共有 CMS をポート3100固定で起動 (本体ツリーの cms/、1つだけ)
	@scripts/dev.sh cms

cms-worktree: ## マイグレーションを伴うブランチ検証用: 自 worktree の cms/ を専用ポートで起動
	@scripts/dev.sh cms-worktree
