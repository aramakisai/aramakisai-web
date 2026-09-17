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
pnpm dev   # http://localhost:3000
```

## ライセンス

[MIT](./LICENSE)
