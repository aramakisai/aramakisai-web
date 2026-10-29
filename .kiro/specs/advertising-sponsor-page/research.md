# 調査・設計判断記録

## Summary

- **対象**: `advertising-sponsor-page`、既存システムへの拡張。
- **調査範囲**: 既存CMS・Frontend、Figma、最新 `origin/dev`、担当者のPRレビュー。
- **結論**: 企業は既存の `sponsors`・Mediaと取得処理を再利用する。個人協賛の保存先は未決。登録されるデータとロゴは公開可能であることが前提。

## Research Log

### レビューと承認

- [PR #246 レビュー](https://github.com/aramakisai/aramakisai-web/pull/246#pullrequestreview-5685470844) は `COMMENTED`。全体コメントとインラインコメントは取得結果では0件。明示承認はない。
- 担当者は既存フィールドと `_order`、条件付きのプラン・ロゴ必須、金額・公開状態なし、ワンショット取込を指示。個人の保存先は未決。ユーザーはこのレビューを優先し未承認の設計案を作るよう指示した。
- `spec.json` のRequirements承認を変更しない。未決事項がありレビューゲートは通過していないため、確定版とは区別して `design-draft.md` に記録する。

### 既存実装

- `cms/src/collections/sponsors.ts`: `type` は複数選択、`tier` と `logo` は任意、`orderable: true`。`local_import_id` は地域協賛固有であり広告用に流用しない。
- `frontend/src/lib/sponsors.ts`: `_order` 昇順、全件取得、複数種別ごとに分類。トップ等の既存利用者があるためページ固有の整形は分離する。
- `cms/src/access/policy.ts`: `sponsors` は未認証で全件読取可。`media` は `used_in_published` がfalse以外を公開し、実行委員アップロードは通常null。`cms/src/collections/media.ts` の配信エンドポイントはread権限を評価してURLにリダイレクトし、sharpによるWebPと派生サイズを生成する。S3自体の非公開保証は確認できていない。
- `frontend/src/app/(site)/sponsors/[kind]/page.tsx` は404。`frontend/src/lib/crawl-targets.ts` と `frontend/src/app/sitemap.ts` は現在 `/sponsors/ad` を実体ルートとして扱わない。既存テストにもその期待がある。
- `frontend/package.json` と `cms/package.json` では両方 Next.js 16.4.2、Payloadは3.88.0。steeringのFrontend Next.js 15とのバージョン表記差はあるが、依存変更は提案しない。
- `.github/workflows/frontend-ci.yml` にはfixture E2E、OpenNext成果物検査、Workers previewとpreview E2Eの既存ジョブがある。preview buildはCMSの公開データを本番から読み取る設定であり、利用には既存の実行条件と権限が必要。新たなゲートを追加する判断とは分ける。

### Figma

- [Desktop](https://www.figma.com/design/0kWDqHsLr6xE8b4FFgR1Zx?node-id=1410-26) と [Mobile](https://www.figma.com/design/0kWDqHsLr6xE8b4FFgR1Zx?node-id=1410-27) のスクリーンショットを読み取り専用で確認。プランごとのカードと文字一覧、個人一覧を確認した。最終承認状態は未確認。図中の企業・個人は実データとして使用しない。

### 最新dev

- fetch時の `origin/dev` は `8de83f78`、対象ブランチは `0b840216`、1 ahead / 5 behind。差分はサイネージの11ファイルでCMS・migrationの変更はない。
- PR #245 が直近のdevマージ。地域協賛マップPR #222とそのmigrationは共通履歴に含まれる。現時点で設計に必要なdev側の未取り込みCMS変更はなく、mergeは行っていない。

## Architecture Pattern Evaluation

| 選択肢 | 利点 | 懸念 |
| --- | --- | --- |
| 既存取得結果のページ側分類 | トップ等の利用を変更せず、追加機構が少ない | 正式順序は入力運用に依存 |
| 個人を既存 `sponsors` に追加 | コレクション再利用 | 複数種別・既存取得・他画面・型への影響を検証する必要 |
| 個人の別コレクション | 企業との責務を分離しやすい | スキーマ、migration、型、権限が必要 |

個人の選択肢はどちらも決定していない。

## Design Decisions

- **再利用と簡素化**: 既存協賛取得・Media・共通レイアウト・既存CIを利用し、公開状態や金額の別管理機構を設けない。企業の分類は既存一覧を壊さないページ側で行う。
- **順序**: 申込順を運用側で `_order` に設定する。申込日時の保存やシステム内の金額ソートを追加しない。個人の表示順も担当者が事前に確定する。
- **公開境界**: CMSの公開判定を拡張せず、公開できない情報は投入しない。Media APIの判定だけでS3直URLを保護できると仮定しない。
- **未決**: 個人の保存先、既存不備レコードへの条件付き必須検証、Figma承認状態。結果により詳細設計を再評価する。

## Risks & Mitigations

- 登録即公開のため誤登録が公開につながる。担当者による登録前確認を必要とし、非公開データ・ロゴを投入しない。
- 条件付き必須検証が不備ある既存レコードの更新を妨げうる。既存データを点検し適用と修正方針を合意する。
- 未決の保存先は他機能やmigrationに影響する。選択前に実装タスク化しない。
- 公開リポジトリの過去コミットには一般化前の記載が残る。今回の通常pushでは履歴を消去できないため、担当者が履歴対応の要否を判断する。
