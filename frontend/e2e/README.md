# E2E Tests (Playwright)

このディレクトリにはPlaywrightを使用したE2Eテストを配置します。

## 画面の追加とテストの追加について

- **1画面1ファイル**: 新規画面を追加した際は、このディレクトリ(`frontend/e2e/`)にテストファイル（例: `new-page.spec.ts`）を追加するだけで済みます。
- CIの設定変更は不要です。`pnpm test:e2e` (`playwright test`) が自動的に `e2e/` 配下の `*.spec.ts` を収集しテストを実行するため、ファイル追加のみで完結します。

## Directus 連携テストの規約

Directus からデータを取得する画面のE2Eテストを作成する際は、以下の規約に従ってください。
テンプレートファイル `_template.directus.spec.ts` も併せて参照してください。

1. **依存コレクションの明記**:
   - テストファイルの冒頭にコメントで依存するDirectusのコレクション名を明記してください。
   - 例: `// Depends on Directus collections: festival_meta, page_home`
2. **読み取り専用 (Read Only)**:
   - テスト内ではデータの書き込み（作成・更新・削除）操作は行わず、読み取り（GET相当の表示確認）のみに限定してください。
3. **DOMへの反映確認**:
   - フェッチしたデータが画面（DOM）に正しく反映されていることをアサートしてください。
4. **環境依存エラーの分類**:
   - テスト前に `frontend/scripts/directus-check.ts` の `checkDirectusReachable` を使用し、Directusの疎通確認を行ってください。
   - Directusが到達不能な場合（ネットワークエラーや4xx/5xxなど）は、フロントエンドの不具合ではなく「環境起因のエラー(directus-dependency-error)」として失敗するようにしてください。

## テンプレートの使い方

Directus連携のE2Eテストを新規作成する場合は、`_template.directus.spec.ts` をコピーして新しい名前に変更し、`test.describe.skip` の `.skip` を外して実装を開始してください。
