# プロジェクト管理 (WBS)

## WBS の実体

GitHub Projects (v2) で管理する。

- URL: https://github.com/orgs/aramakisai/projects/1
- タイトル: 「荒牧祭Webサイト WBS」
- organization `aramakisai` 配下、project number 1

対象範囲は `aramakisai-web` と `aramakisai-infra` の両リポジトリ。開発タスク (spec) だけでなく、コンテンツ運用 (学生団体の入稿フロー)、対外調整 (協賛データ投入、掲載確認)、当日運用、開催後の引き継ぎも同じボードで管理する。開発が完了してもサイト運営は完了しないため。

## 管理粒度

**1 アイテム = 1 spec または 1 運用タスク**。末端の作業項目はボードに転記せず `.kiro/specs/<name>/tasks.md` に委ねる (二重管理を避ける)。ボード上の各アイテムから当該 spec を辿るには `Spec` フィールドの値 (spec ディレクトリ名) を使う。

## カスタムフィールド

| フィールド | 型 | 内容 |
|---|---|---|
| 区分 | single select | 開催前必須 / 開催中運用 / 基盤・CI / 見送り / コンテンツ運用 / 対外調整 / 開催後 |
| 種別 | single select | 固定ページ作成 / トピック・お知らせ作成 / 実装 / データ投入 / 判断・調整 / インフラ作業 |
| 期日 | date | |
| 開始日 | date | |
| Spec | text | spec ディレクトリ名。`.kiro/specs/<name>/tasks.md` を辿る鍵 |
| 進捗 | text | `15/17` 形式 |

## スケジュールの骨格

開催: 2026-11-14〜15

- 実装: 10/11 まで
- コンテンツ入稿: 10/31 まで
- 当日運用の準備: 10/25 まで
- 11月上旬は意図的に空けてある
