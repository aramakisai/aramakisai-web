# aramakisai-web

荒牧祭実行委員会の公式サイト用リポジトリ。フロントエンド (Next.js) と Payload CMS を管理する。

- 本番サイト: https://aramakisai.com (Cloudflare Workers)
- CMS 管理画面: https://cms.aramakisai.com

## 構成

```
frontend/   Next.js アプリケーション (Cloudflare Workers にデプロイ)
cms/        Payload CMS アプリケーション
.kiro/      Spec-Driven Development の仕様書 (steering / specs)
```

詳細なディレクトリ構成・コマンド・デプロイフロー・スキーマ変更手順は [CLAUDE.md](./CLAUDE.md) を参照。

## セットアップ

```bash
cd frontend
pnpm install
cd ..
make dev   # worktree ごとに決まるポートで起動
```

### CMS (ローカル)

```bash
cd cms
pnpm install
pnpm db:up      # ローカル Postgres (localhost:5433)
pnpm migrate
pnpm seed:dev   # 開発用データを投入する
cd ..
make cms        # http://localhost:3100/admin
```

`pnpm seed:dev` で作られる実行委員アカウントで管理画面にログインできる。

- メールアドレス: `seed-exhibitor-executive@example.invalid`
- パスワード: `seed-dev-password-1234`

シードの学生団体アカウントは、初期パスワードが推測できない乱数になるためログインできない。

## ライセンス

[MIT](./LICENSE)
