# 広告協賛ページ 調査・設計判断

## Summary

- **対象**: 既存システムの拡張。企業・個人の一覧、ナビゲーション、Media保護を調査。
- **結果**: 企業は既存取得とMediaを利用。個人は専用コレクションで公開表示名と順序のみを管理する。
- **注意点**: 一覧取得の長期キャッシュは現行では動かず、Media参照保護には削除前の排他制御が必要。

## Research Log

### 企業・個人

- `cms/src/collections/sponsors.ts` の `type` は複数選択、`tier` と `logo` は任意、`orderable` は有効。企業の必須条件は非破壊なhookで判定する。
- `frontend/src/lib/sponsors.ts` は `_order` で全件取得し、種別へ振り分ける。トップとサイネージが既存企業情報を利用する。
- 個人を既存 `sponsors` に加えると他の企業用入力欄が残る。別コレクションなら入力項目と他画面への非混入を満たせる。自動メタデータを除く業務入力は表示名のみで、順序はPayloadに任せる。

### 公開・キャッシュ

- `cms/src/access/policy.ts` は公開状態を持たないコレクションの未認証readを許可し、書込は実行委員に限定する。新コレクションは登録口の既存accessを通す。
- `frontend/src/lib/cms.ts` の `findMany` は `ttlSeconds` と `version` のみを `request` に転送する。60秒キャッシュがヒットすれば正常値を返すが、`retained` は `findGlobal` と異なり転送されず、一覧の長期保持は現行では存在しない。
- 個人情報や公開前ロゴは公開CMSに保存しない。MediaのS3直URLや既存キャッシュに対し新たな非公開保証を設けない。

### ロゴ削除と競合

- `cms/src/collections/media.ts` の `guardPublishedMedia` は学生団体の公開企画向け。初期migrationの `sponsors_logo_id_media_id_fk` は `ON DELETE SET NULL`。現状は企業のロゴ参照を保証しない。
- インストール済みPayload 3.88.0の `deleteByID.js` と `delete.js` では `beforeDelete` がファイル削除より先。削除のトランザクションで対象Media行をロック後、同じ主DBトランザクションで参照を確認する。Payloadのセッション利用例は `cms/scripts/regional-sponsor-map-migration.int.test.ts` にある。
- [Payloadのトランザクション](https://payloadcms.com/docs/database/transactions) と [PostgreSQLの行ロック](https://www.postgresql.org/docs/17/explicit-locking.html) を参照。既存実装依存のため同時操作とS3の統合検証を実装時に必須とする。

### ナビゲーション・画面

- `frontend/src/lib/get-navigation.ts` はCMS、長期保持、コード定数の順で縮退。`navigationFromCms` はCMS値をそのまま変換する。両フェーズの導線保証にはCMS値・保持済み値・フォールバックの全経路が必要。
- Figmaの [Desktop](https://www.figma.com/design/0kWDqHsLr6xE8b4FFgR1Zx?node-id=1410-26)、[Mobile](https://www.figma.com/design/0kWDqHsLr6xE8b4FFgR1Zx?node-id=1410-27)、[SponsorLogoCard](https://www.figma.com/design/0kWDqHsLr6xE8b4FFgR1Zx?node-id=1409-38) を参照。既存サイトの切替は `lg` 1024px。カードのHoverは枠色の変化で、共通部分は既存コンポーネントを維持する。
- `frontend/src/components/text-link.tsx` は矢印を含むため外部リンクアイコンなしのD表示にそのまま使えない。下線部品 `HoverLine` は再利用できる。

## Architecture Pattern Evaluation

| 方式 | 利点 | 制約 |
| --- | --- | --- |
| 既存企業一覧のページ側分類 | 他の利用者を変更せず `_order` を再利用 | ページで不正値を防御する必要がある |
| 個人を `sponsors` の別種別に追加 | 既存コレクションを流用 | 不要な入力欄が残り、他画面への非混入を別途保証する必要がある |
| 個人専用コレクション | 公開表示名・表示順だけに限定でき、既存取得から分離 | migrationと生成型の更新が必要 |

## Design Decisions

- 企業は既存 `getSponsors` の結果を利用し、ページ用変換だけ追加する。個人は専用コレクションを選択する。
- 既存Media参照の競合を防ぐため、削除処理の同一トランザクションで行ロックと参照確認を行う。DB外の直削除は対象外。
- CMS更新の既存60秒キャッシュは維持し、長期fallbackを新たに導入しない。URL空欄は許容し、非空の不正URLは書込時に拒否する。
- 共通UI・既存CIを採用し、新しいUI基盤や重複フィールドを追加しない。

## Risks & Mitigations

- navigationの必要な親がCMSにないと子項目を追加できない。公開前に担当者が確認し、勝手に最上位項目を増やさない。
- Media削除ガードはPayloadのトランザクションセッションと外部ストレージの削除順序に依存する。実DB・ストレージで並行処理を検証し、取引が使えない場合は削除を拒否する。
- 登録即公開のため、担当者が公開可能な名前と画像を登録前に確認する。
