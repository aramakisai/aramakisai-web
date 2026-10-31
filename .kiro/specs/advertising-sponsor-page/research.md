# 広告協賛ページ 調査・設計判断

## Summary

- **対象**: 既存システムの拡張。企業・個人の一覧、ナビゲーション、Media保護を調査。
- **結果**: 企業は既存取得とMediaを利用。個人は専用コレクションで公開表示名と順序のみを管理する。
- **注意点**: 一覧ページは既存と同じ `revalidate = 60` と `loadForIsr` で描画する。Media参照保護は `beforeDelete` での参照数確認で足りる。

## Research Log

### 企業・個人

- `cms/src/collections/sponsors.ts` の `type` は複数選択、`tier` と `logo` は任意、`orderable` は有効。企業の必須条件は非破壊なhookで判定する。
- `frontend/src/lib/sponsors.ts` は `_order` で全件取得し、種別へ振り分ける。トップとサイネージが既存企業情報を利用する。
- 個人を既存 `sponsors` に加えると他の企業用入力欄が残る。別コレクションなら入力項目と他画面への非混入を満たせる。自動メタデータを除く業務入力は表示名のみで、順序はPayloadに任せる。

### 公開・キャッシュ

- `cms/src/access/policy.ts` は公開状態を持たないコレクションの未認証readを許可し、書込は実行委員に限定する。新コレクションは登録口の既存accessを通す。
- `frontend/src/lib/isr.ts` の `loadForIsr` はビルド中の失敗だけを空値に置き換え、実行時は例外を投げ直す。既存の一覧ページ (例: タイムテーブル) は `export const revalidate = 60` とこれを併用しており、再検証の失敗時は直前の正常なページが保たれる。
- 個人情報や公開前ロゴは公開CMSに保存しない。MediaのS3直URLや既存キャッシュに対し新たな非公開保証を設けない。

### ロゴ削除

- `cms/src/collections/media.ts` の `guardPublishedMedia` は学生団体の公開企画向け。初期migrationの `sponsors_logo_id_media_id_fk` は `ON DELETE SET NULL`。現状は企業のロゴ参照を保証しない。
- インストール済みPayload 3.88.0の `deleteByID.js` と `delete.js` では `beforeDelete` がファイル削除 (`deleteAssociatedFiles`) より先。`beforeDelete` で `sponsors` の `logo` 参照数を `payload.count` で数え、1件以上なら拒否すれば、ファイルも残る。

### ナビゲーション・画面

- `frontend/src/lib/get-navigation.ts` はCMS、長期保持、コード定数の順で縮退する。liveの導線は、コード定数 (`navigationItemsByPhase.live`) への追加と、本番CMS `navigation` global への運用登録の2つで揃える。
- Figmaの [Desktop](https://www.figma.com/design/0kWDqHsLr6xE8b4FFgR1Zx?node-id=1410-26)、[Mobile](https://www.figma.com/design/0kWDqHsLr6xE8b4FFgR1Zx?node-id=1410-27)、[SponsorLogoCard](https://www.figma.com/design/0kWDqHsLr6xE8b4FFgR1Zx?node-id=1409-38) を参照。既存サイトの切替は `lg` 1024px。カードのHoverは枠色の変化で、共通部分は既存コンポーネントを維持する。
- `frontend/src/components/text-link.tsx` は矢印を含むため外部リンクアイコンなしのD表示にそのまま使えない。下線部品 `HoverLineText` は再利用できる。

## Architecture Pattern Evaluation

| 方式 | 利点 | 制約 |
| --- | --- | --- |
| 既存企業一覧のページ側分類 | 他の利用者を変更せず `_order` を再利用 | ページで不正値を防御する必要がある |
| 個人を `sponsors` の別種別に追加 | 既存コレクションを流用 | 不要な入力欄が残り、他画面への非混入を別途保証する必要がある |
| 個人専用コレクション | 公開表示名・表示順だけに限定でき、既存取得から分離 | migrationと生成型の更新が必要 |

## Design Decisions

- 企業は既存 `getSponsors` の結果を利用し、ページ用変換だけ追加する。個人は専用コレクションを選択する。
- 既存Media参照の削除を防ぐため、`media` の `beforeDelete` で `sponsors` の参照数を確認し、1件以上なら拒否する。DB外の直削除は対象外。
- 描画は既存一覧ページと同じ `revalidate = 60` と `loadForIsr` にし、長期fallbackを新たに導入しない。URL空欄は許容し、非空の不正URLは書込時に拒否する。
- 共通UI・既存CIを採用し、新しいUI基盤や重複フィールドを追加しない。

## Risks & Mitigations

- 本番CMSの `navigation` global「開催中」タブに「広告協賛」を実行委員が登録しないと、liveの導線がCMS値で上書きされて出ない。公開前の運用手順に含める。
- Media削除ガードはPayloadが `beforeDelete` をファイル削除より前に呼ぶ順序に依存する。Payloadのバージョンを上げる際は順序を再確認する。
- 登録即公開のため、担当者が公開可能な名前と画像を登録前に確認する。
