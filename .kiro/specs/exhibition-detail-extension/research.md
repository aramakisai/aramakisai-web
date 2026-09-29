# Research & Design Decisions

## Summary
- **Feature**: `exhibition-detail-extension`
- **Discovery Scope**: Extension (既存の学生企画コレクションと企画詳細ページの拡張)
- **Key Findings**:
  - 出演枠 (`performance_slots.event_date`) が既に「開催日をJST暦日で保持し、開催日程とは暦日で突き合わせる」方式を採っており、保存値の作り方 (`eventDayValue`)・選択肢のラベル (`buildEventDayOptions`)・表示ラベルの解決 (`toDays`) がそのまま再利用できる
  - Payload 3.88.0のtextフィールドは、管理画面で一度入力して消すと`""`、一度も触らないと未送信でDBは`NULL`になる。空の表現が2通りあるため保存時に正規化が要る
  - `cms-schema-check`の破壊的変更検出はトップレベルのフィールドの削除・型変更・必須化・多重度変更だけを見る。新しいarrayフィールドの追加 (配下の必須フィールドを含む) は検出対象外

## Research Log

### 出店日を開催日程のどの値に紐づけるか
- **Context**: 要件2.1「開催日程の日から出店日を複数選択して保持」。開催日程 (`festival_meta.event_days`) はarrayで、行は`start_at` / `end_at` / `label`とPayloadが振る行`id`を持つ
- **Sources Consulted**: `cms/src/globals/festival-meta.ts`、`cms/src/collections/performance-slots.ts`、`cms/src/components/EventDaySelect.tsx`、`cms/src/components/event-day-options.ts`、`cms/src/hooks/payload-constraints.ts` (`performanceTimeConstraint`)、`frontend/src/lib/timetable.ts` (`toDays`, `getExhibitionPerformances`)、`cms/src/migrations/20260929_093220_performance_slots_inline_time.ts`
- **Findings**:
  - 出演枠は`event_date` (date型) に「JST暦日のUTC正午」を保存し、`toJstDateKey`で暦日キーにして開催日程と突き合わせる。表示ラベルは`toDays`が暦日キー→`label || formatEventDayLabel(start_at)`で解決する
  - `EventDaySelect`は開催日程から選択肢を作り、開催日程に無い保存値は「(開催日程外)」として残す。dateフィールド用のカスタムFieldで、arrayの行の中でも`path`単位で動く
  - 開催日程の行`id`はPayloadが生成する不透明な文字列で、フロントエンドのどこからも参照されていない
- **Implications**: 暦日で紐づければ、保存値の変換とラベル解決を既存部品で賄える。タイムテーブル・出演時間と出店日で「日」の同一性の定義が揃う

### Payloadのtextフィールドを空にしたときの保存値
- **Context**: 要件3.1「価格がnullでない行を表示」、WBS本文「自由記述フィールドが空文字でない場合のみ表示する」。空の保存値がnullか "" かで判定が変わる
- **Sources Consulted**:
  - `payload@3.88.0` `dist/fields/hooks/beforeValidate/promise.js`: 型ごとの値の補正はcheckbox (`''`→false)、number (空白→null)、point、relationship/upload (`''`→null) だけで、textには補正が無い
  - `@payloadcms/ui@3.88.0` `dist/fields/Text/index.js` 127-128行: 入力欄のonChangeは`setValue(e.target.value)`で、消すと`''`がフォーム値になる
  - 既存コード`frontend/src/lib/event-day.ts` `toEventDays`のコメント: 開催日程の表示ラベルを管理画面で空にすると`''`で保存されるという実測に基づく正規化が既にある
- **Findings**:
  - 行を追加して価格欄に一度も触れない → フォーム値が未定義のまま送信されず、列は`NULL`
  - 価格を入力してから消す → `''`がそのまま保存される
  - つまり「空」の保存状態は`NULL`と`''`の2通りが混在する
- **Implications**: 要件3.1の判定を`null`だけにすると`''`の行が空欄の価格付きで表示されてしまう。保存時に空 (空白のみを含む) を`null`に寄せれば、要件の「nullでない」とWBSの「空文字でない」が同じ意味になる

### スキーマ変更と破壊的変更検出
- **Context**: 要件6.1。`cms-schema-check.yml`の検出を避ける必要がある
- **Sources Consulted**: `cms/scripts/collection-shape.ts` (`toShape`, `detectBreakingChanges`)
- **Findings**: 比較対象はコレクション直下の名前付きフィールドの`type` / `required` / `hasMany`と存在有無だけ。baseに無いフィールドは比較されない
- **Implications**: `menu` / `open_days`を新しいarrayとして足す限り検出されない。既存フィールドには手を入れない

### ヘッダー情報列の既存部品
- **Context**: 要件3.6・4.1・5。出演時間の移設、共有ボタンとリンクの1行化
- **Sources Consulted**: `frontend/src/app/(site)/exhibitions/[id]/[category]/page.tsx`、`frontend/src/components/exhibition-performances.tsx`、`exhibition-links.tsx`、`share-button.tsx`、`icons.tsx`、`frontend/src/app/layout.tsx`
- **Findings**:
  - 場所の行は`PlaceIcon` (20px) + テキストの`<p>` (`text-sm font-medium text-gray-600`)
  - `ExhibitionLinks`は「リンク」の小見出し (`text-xs font-medium text-gray-600`) と`<ul>`を1つのdivで返す
  - `ShareButton`はボタンの下に通知 (コピー完了・手動コピー用のURL入力欄) を出す。通知をボタンと同じ横並びの項目の中に置くと、URL入力欄の幅がボタン幅に縮む
  - Material Symbolsは`layout.tsx`の`MATERIAL_SYMBOLS_ICON_NAMES`でアイコン名によるサブセットを読み込んでおり、`calendar_month`と`schedule`は未登録
- **Implications**: 新しいアイコンはサブセット一覧への追加が要る。共有ボタンとリンクの1行化は、通知を行の外 (下) に保つ組み方にする

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 並び順 (index) | 開催日程の何番目かを数値で保存 | 保存値が小さい | 開催日程の並べ替え・途中の日の削除で、黙って別の日を指す | 誤表示が起きても気付けない |
| 行id | 開催日程の行のPayload idを保存 | 並べ替え・日付修正に追従する | 行を消して作り直す・APIで配列を置き換えると全企画の紐づけが一斉に外れる。管理画面・フロントにidを扱う部品が無く新規に作る必要がある | 既存のどこにも前例が無い |
| 暦日 (採用) | 出演枠と同じくJST暦日をdate型で保存 | 並べ替え・ラベル変更・行の作り直しに影響されない。既存の選択UI・ラベル解決・出演枠と同じ規約をそのまま使える | 開催日自体を別の日へ変えると紐づけが外れる | 外れた日は表示から消え、管理画面では「(開催日程外)」と出る。出演枠も同じ挙動 |

## Design Decisions

### Decision: 出店日は暦日で紐づける
- **Context**: 要件2.1・2.2・4.2〜4.4
- **Alternatives Considered**:
  1. 並び順 — 並べ替えで誤表示が起きる
  2. 行id — 新規部品が要り、行の作り直しで全件外れる
  3. 暦日 — 既存の出演枠と同じ
- **Selected Approach**: `open_days`に`eventDayValue`の文字列 (JST暦日のUTC正午) を複数持たせる。表示時は暦日キーで開催日程と突き合わせる
- **Rationale**: 開催日程を変更したときの挙動を比べると、並べ替え・ラベル変更・行の作り直しのどれでも紐づけが保たれるのは暦日だけ。開催日そのものを動かしたときに外れる点は出演枠も同じで、運用上「日付を変えたら紐づけ直す」という1つの規則で済む
- **Follow-up**: 範囲外・重複の値があっても表示が壊れないことをテストで確かめる

### Decision: 出店日のフィールド型はtextのhasMany
- **Context**: ユーザー決定で、入力UIは開催日程の日をチェックボックスで並べる形。保存は暦日のまま。追加だけのスキーマ変更で`cms-schema-check`に検出されないこと
- **Alternatives Considered**:
  1. array + 行ごとの`EventDaySelect` — チェックボックスにならない (ユーザー決定で不採用)
  2. array + array全体を置き換えるカスタムField — チェックの付け外しをフォームの行追加・削除 (`addFieldRow` / `removeFieldRow`) に写す必要があり、行idも絡んで部品が複雑になる
  3. select `hasMany` — 選択肢がコードに固定され、Postgresではenum型になる。開催日程に合わせて選択肢を変えるたびにマイグレーションが要り、動的な日付を持てない
  4. json — 列1つの追加で済むが、生成される型が`unknown`系になりフロントエンドで形の検査が要る。値の形の検証もPayload側に無い
  5. text `hasMany` — 値は文字列の配列 (`string[] | null`の型)。カスタムFieldは`useField<string[]>`で配列を丸ごと`setValue`するだけで済む。DBは`student_exhibitions_texts`テーブルの新規作成 (追加のみ)
- **Selected Approach**: 5。`admin.components.Field`に新しい`EventDayCheckboxes`を指定する
- **Rationale**: チェックボックスの状態 (選んだ日の集合) と保存値 (文字列の配列) が1対1で対応し、部品が最も小さい。`collection-shape.ts`の検出はbaseに無いトップレベルのフィールドを比較しないため、新規追加は破壊的変更にならない
- **Trade-offs**: 保存値が型としては任意の文字列なので、範囲外や解釈できない値が入り得る。管理画面は「(開催日程外)」で見せ、フロントエンドは解釈できない値と範囲外を読み飛ばす

### Decision: 価格は空をnullに正規化して保存する
- **Context**: 要件3.1・3.2・3.4、WBS本文
- **Alternatives Considered**:
  1. フロントエンドで`null`と`''`の両方を除外する — 要件の「nullでない」と実装の判定がずれ、APIの利用者ごとに同じ判定を持つことになる
  2. 保存時に空を`null`へ寄せる — 判定は`null`だけで済む
- **Selected Approach**: `price`のフィールド単位`beforeValidate`フックで、空白を除くと空になる文字列を`null`にする。それ以外の文字列は加工せずそのまま保存する
- **Rationale**: 管理画面・RESTのどちらから保存しても同じフックを通るため、正規化が1か所で済む。要件3.4 (入力された文字列のまま表示) を壊さない
- **Trade-offs**: 空白だけの価格は「未入力」と同じ扱いになる

### Decision: 共有ボタンが行の中身を受け取る
- **Context**: 要件5.6〜5.8
- **Alternatives Considered**:
  1. ページで共有ボタンとリンクをflexで並べる — 通知のURL入力欄がボタン幅に縮む
  2. `ShareButton`に`children`を足し、ボタンとchildrenを1行に並べ、通知はその行の下に全幅で出す
- **Selected Approach**: 2
- **Rationale**: 変更は`ShareButton`のprops 1つと並べ方だけで、通知の見た目を保てる

## Risks & Mitigations
- `pnpm migrate:create`の差分に本件と無関係な`media.prefix`のDROPが混ざる — 生成されたマイグレーションから本件の2テーブル以外の文を取り除く
- ローカル起動で`importMap.js`からZitadel/S3のエントリが消える — その差分はコミットしない。`git restore`してから`pnpm generate:importmap` (ダミー環境変数付きでZitadel/S3のエントリを保つ) を再実行し、差分が`EventDayCheckboxes`の分だけであることを確かめる
- Figmaの参照ノード (ステージPC `2:468`、出店PC `802:731`、SP `2:531`) はdesign.mdの表のとおり。実装時に最新のノードを実測する

## References
- `cms/node_modules/payload/dist/fields/hooks/beforeValidate/promise.js` (payload 3.88.0) — textに型補正が無いこと
- `cms/node_modules/@payloadcms/ui/dist/fields/Text/index.js` (3.88.0) — 入力欄を消すと`''`がフォーム値になること
- `cms/scripts/collection-shape.ts` — 破壊的変更の検出範囲
