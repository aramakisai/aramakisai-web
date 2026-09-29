# Research & Design Decisions

## Summary
- **Feature**: `timetable-page`
- **Discovery Scope**: Extension(既存のPayload CMSコレクションとNext.jsフロントエンドへの追加。light discovery)
- **Key Findings**:
  - `timeOnly`の`start_at`/`end_at`は、管理画面を開いたブラウザのローカルタイムゾーンで「編集開始時の日付(既存値があればその日付)+選んだ時刻」をUTCの`timestamptz`として保存する。日付部分は意味を持たず、同じスロットの`start_at`と`end_at`で日付がずれることもある。時刻はJSTの時・分だけを取り出して使う必要があり、生のタイムスタンプ同士の大小比較は誤りになる
  - `dayOnly`の日付はブラウザのローカル時刻を`12 - tzOffset`時に丸めて保存するため、JSTのブラウザでは選んだ日付のUTC正午(JST 21:00)になる。JSTで日付を取り出せば選んだ日付と一致する
  - `cms/scripts/collection-shape.ts`の`detectBreakingChanges`は「baseに存在したフィールドの必須化」だけを検出し、新設フィールドは必須でも検出しない。`event_date`を必須で新設する変更は`cms-schema-check`を通過し、`breaking-change-acknowledged`ラベルは不要になる
  - 公開判定: `stages`/`time_slots`/`performance_slots`は`PUBLISHED_FILTER`に無く未認証で全件読める。`student_exhibitions`は`status=published`で絞られ、Payloadはアクセス拒否された関連をpopulateせずIDのまま返す(`relationshipPopulationPromise.js`の「ids are visible regardless of access controls」)
  - フロントには日付ライブラリが無く、`frontend/src/lib/event-day.ts`の`toJstParts`(UTC+9hをUTC getterで読む)と`formatEventDayTime`/`formatEventDayLabel`が既存のJST処理である。新規依存は不要

## Research Log

### Payloadの`timeOnly`/`dayOnly`の保存値
- **Context**: 開催日と時刻を合成する前提として、既存の`start_at`/`end_at`に何が保存されているかを確定する必要がある
- **Sources Consulted**:
  - `cms/node_modules/@payloadcms/ui/dist/elements/DatePicker/DatePicker.js`(payload 3.88.0)
  - Payload docs `fields/date.mdx`(context7 `/payloadcms/payload`): 「pickerAppearanceは表示だけに影響し、常に完全な日時が保存される」「時刻を持たない日付は12:00に正規化される」
  - `cms/src/migrations/20260827_082729_initial.ts`: `time_slots.start_at`/`end_at`は`timestamp(3) with time zone NOT NULL`
  - `cms/src/payload.config.ts`: `admin.timezones`設定なし(管理画面はブラウザのローカルタイムゾーンで表示・入力する)
  - `cms/scripts/seed-dev-exhibitions.ts`: シードは`2026-10-24T10:00:00.000+09:00`形式で投入
- **Findings**:
  - `DatePicker`の`onChange`は`dayOnly`/`default`/`monthOnly`のときだけ`setHours(12 - tzOffset, 0)`で正規化し、`timeOnly`は正規化しない。react-datepickerの時刻選択は選択中の値(無ければ今日)の日付に時刻を載せる
  - したがって`timeOnly`の値は「ブラウザのローカル時刻で選んだ時・分」を正しく表すが、日付部分は編集した日や既存値に依存する
  - `dayOnly`でJSTのブラウザから11月14日を選ぶと`2026-11-14T12:00:00.000Z`になる。UTC-11〜UTC+11の範囲のブラウザならUTCの暦日は選んだ日と一致し、JSTでの暦日も一致する
- **Implications**:
  - 時刻は`toJstParts`相当でJSTの時・分(0〜1439の分)に変換してから比較・合成する
  - 1.3の「終了≤開始」判定も分単位で比較する。生のタイムスタンプ比較は日付部分のずれで誤判定する
  - 管理画面をJST以外のブラウザで操作すると時刻がずれる。運営は国内で行うため許容し、管理画面の説明文で「日本時間で入力」と示す

### スキーマ変更検出の挙動
- **Context**: 1.6の「破壊的変更検出の手続き」を具体化する
- **Sources Consulted**: `cms/scripts/check-schema-changes.ts`、`cms/scripts/collection-shape.ts`、`.github/workflows/cms-schema-check.yml`、`docs/cms-operations.md`
- **Findings**:
  - `detectBreakingChanges`はbaseのフィールドを走査し、削除・型変更・必須化・多重度変更を検出する。headにだけ存在するフィールドは見ない(「追加は破壊的でないため検出しない」)
  - ワークフローは`breaking-change-acknowledged`ラベルで検出をスキップする
- **Implications**:
  - 必須フィールドの新設は検出されない。1.6は「検出が通る形で変更し、既存行はマイグレーションで埋める」ことで満たす。フィールドを任意で追加→後続PRで必須化する2段階にすると2段目が検出対象になりラベル運用が必要になるが、得るものが無いため1段階で行う
  - 読み手側(フロント)にとって新設フィールドは非破壊である。フロントは新設フィールドを前提に読むため、CMSの本番反映をフロントの本番反映より先に行う

### 既存の制約パターン
- **Context**: 1.3/1.4/1.8/1.9の検証の置き場所
- **Sources Consulted**: `cms/src/hooks/constraints.ts`、`cms/src/hooks/payload-constraints.ts`、`cms/src/collections/performance-slots.ts`、`cms/src/migrations/20260827_084500_schema_constraints.ts`
- **Findings**:
  - 純粋関数(`validate*`、`ConstraintViolation[]`を返す)と、DBを引いて純粋関数へ渡し`ValidationError`へ変換する`beforeValidate`フック(`raise`)の2層構成
  - `performance_slots`には`UNIQUE(stage_id_id, time_slot_id_id)`(`performance_slots_stage_time_slot_unique`)があり、同一ステージ×同一タイムスロットの重複はDBで拒否される
- **Implications**:
  - 重なり判定は純粋関数+呼び出し側のDB参照に分ける。UNIQUE制約は「同じタイムスロット=必ず重なる」の部分集合であり、重なり検証と矛盾しないため残す

### フロントの取得・描画パターン
- **Context**: データ取得層の置き場所と現在時刻の扱い
- **Sources Consulted**: `frontend/src/lib/cms.ts`、`frontend/src/lib/exhibitions.ts`、`frontend/src/lib/event-day.ts`、`frontend/src/lib/festival-meta.ts`、`frontend/src/app/layout.tsx`、`frontend/src/app/sitemap.ts`、`frontend/src/lib/phase.ts`、`frontend/src/lib/crawl-targets.ts`、`frontend/src/lib/route-classification.test.ts`
- **Findings**:
  - `cms.findMany`/`findGlobal`は`CmsResult`を返し、一覧系の取得関数は失敗時に例外を投げて`(site)/error.tsx`に委ねる規約
  - ルートレイアウトが`cookies()`を読むため全ページがリクエスト時SSRになる。OpenNextにincremental cache設定が無く、ページはキャッシュされない
  - `/timetable`は`PRE_EVENT_PUBLIC_PATHS`に無く、開催前は既存middlewareが`/gated`へrewriteする。ナビ導線(`navigation.ts`、`bottom-navigation.tsx`、`primary-nav-card.tsx`)は実装済み
  - 新規ルートは`route-classification.test.ts`の分類一覧への登録が必須。sitemapは`LIVE_ONLY_CODE_ROUTES`と`OWN_HANDLING_ROUTES`で扱う
  - 企画詳細は`/exhibitions/[id]/[category]`。ステージの場所表示はカテゴリ`stage`のページだけで行う既存規約がある(`resolveLocationForCategory`)
- **Implications**:
  - 取得・結合・現在枠判定を`frontend/src/lib/timetable.ts`に置き、UIから切り離す。`digital-signage`は同じ関数を呼べる
  - サーバー描画時刻をpropsで渡してクライアントの初期状態に使い、hydration後にクライアント時刻へ切り替える

### UI資産
- **Sources Consulted**: `frontend/tailwind.config.ts`、`frontend/src/components/icons.tsx`、`frontend/src/components/section-heading.tsx`、`frontend/src/components/exhibition-filters.tsx`、`frontend/src/lib/breakpoints.ts`
- **Findings**: 色トークン(`primary`/`info`/`gray-*`/`text`/`background`)、`aria-pressed`付きの丸型チップ、`SectionHeading`、`MaterialIcon`(Material Symbolsのリガチャ)、PC/SPの境界`lg`(1024px)が既存
- **Implications**: 開催日切替とステージタブは既存チップの見た目を再利用し、表示の出し分けはCSS(`lg:`)で行う

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 開催日フィールド追加+時刻合成 | `event_date`を新設し、表示・判定時にJST時刻と合成 | 管理画面の入力が要件どおり(日付のみ/時刻のみ)。既存フィールドの型変更なし | 合成ロジックがCMSとフロントに1つずつ要る(別ワークスペースで共有不可) | 採用 |
| `start_at`/`end_at`を`dayAndTime`へ変更 | 日時を1フィールドで持つ | 合成不要 | 1.2に反する。既存値の日付部分が無意味なため移行で全行の書き換えが要る | 不採用 |
| performance_slotsを`depth=1`で取得 | 関連を1リクエストで解決 | 公開判定をCMSのアクセス制御に委ねられる(非公開団体はIDのまま返る) | 企画本文も載るため応答が大きい | 採用。件数は数十件規模 |
| 全公開企画を別取得して突合 | `exhibitions.ts`と同じ結合方式 | 既存と同形 | 全企画を取得するため無駄が大きい | 不採用 |

## Design Decisions

### Decision: 時刻はJSTの「日の分」に正規化して扱う
- **Context**: `timeOnly`の日付部分が無意味で、`start_at`と`end_at`の日付がずれうる
- **Alternatives Considered**:
  1. 生のタイムスタンプで比較する
  2. JSTの時・分を0〜1439の分に変換して比較・合成する
- **Selected Approach**: 2。CMSの検証では分同士を比較し、フロントでは開催日(JSTの暦日)と分から絶対時刻を合成する
- **Rationale**: 保存値の実態に依存しない唯一の方法
- **Trade-offs**: 日跨ぎ(24:00以降)の枠は表せない。1.3により登録自体が拒否されるため整合する
- **Follow-up**: 編集日と異なる日付部分を持つ`start_at`/`end_at`の組でテストする

### Decision: `event_date`は1段階で必須として新設し、既存行はマイグレーションで埋める
- **Context**: 1.5/1.6。本番に既存`time_slots`があるかは不明
- **Alternatives Considered**:
  1. 任意で追加→データ投入→後続PRで必須化(2段階、2段目でラベル運用)
  2. 必須で新設し、マイグレーション内で「列追加(NULL可)→既存行を埋める→NOT NULL化」
- **Selected Approach**: 2。埋める値は`festival_meta_event_days`の最初の開催日(JSTの暦日のUTC正午)。既存行があり開催日程が未登録ならマイグレーションを失敗させる
- **Rationale**: 既存行0件でも数件でも同じマイグレーションで通り、PreSync Jobが失敗すればDeploymentは切り替わらない
- **Trade-offs**: 既存行が2日目の枠だった場合、自動では意図した開催日にならない。マイグレーション適用後、公開(live切替)前に実行委員が管理画面で確認・修正する手順を運用に含める
- **Follow-up**: マージ前に本番の既存件数を`make kubectl`経由で確認し、件数をPRに記録する

### Decision: 現在時刻はサーバー描画時刻で初期化し、クライアントで30秒ごとに更新する
- **Context**: 6.3(1分以内に更新)とhydrationの一致
- **Alternatives Considered**:
  1. クライアントでのみ`Date.now()`を使う(初期描画は強調なし)
  2. サーバーで判定した結果だけを描画する
  3. サーバー描画時刻をpropsで渡して初期状態にし、マウント後に`Date.now()`へ切り替えて`setInterval`で更新
- **Selected Approach**: 3
- **Rationale**: SSRとhydrationの初回描画が同じ時刻から計算されるため不一致が起きない。全ページがリクエスト時SSRなのでサーバー時刻とクライアント時刻の差は通信時間程度
- **Trade-offs**: 端末時計が大きくずれていると強調がずれる。許容する

### Decision: PC表とSPリストを両方描画しCSSで出し分ける
- **Context**: 3.1/4.1。サーバーでは画面幅が分からない
- **Selected Approach**: `lg:`境界で`hidden`を切り替える(`bottom-navigation.tsx`と同じ方式)
- **Trade-offs**: DOMが二重になる。`hidden`(`display:none`)なので支援技術の対象からも外れる

### Decision: 企画詳細の出演時間はカテゴリ`stage`のページにだけ表示する
- **Context**: 企画詳細はカテゴリごとの別ページで、出演枠はステージ企画に属する(`validateStageAssignment`がステージ未選択の企画への割り当てを拒否)
- **Selected Approach**: `/exhibitions/[id]/stage`でだけ出演時間とタイムテーブルへのリンクを表示する
- **Rationale**: 既存の場所表示(`resolveLocationForCategory`)と同じ規約。タイムテーブルからの遷移先もこのページ

## Risks & Mitigations
- 管理画面をJST以外のブラウザで操作すると時刻がずれる — 管理画面の説明文で日本時間での入力を示す
- 既存行への開催日の自動設定が意図と異なる — 適用後・live切替前に管理画面で確認する手順をPRと運用に含める
- フロントがCMSより先に本番反映されると`event_date`が無い — CMSの反映(infra PRマージ・PreSync完了)を確認してからフロントのPRをマージする。どちらのページも開催前は非公開のため来場者影響は無い
- 重なり検証は読んでから書くため同時保存で競合しうる — 管理者は少数で同時編集は想定しない。同一タイムスロットの重複はDBのUNIQUE制約が最後の砦になる

## References
- Payload Date Field(context7 `/payloadcms/payload`、`docs/fields/date.mdx`) — pickerAppearanceは表示のみ、完全な日時を保存
- `cms/node_modules/@payloadcms/ui/dist/elements/DatePicker/DatePicker.js` — `dayOnly`の正午正規化、`timeOnly`は正規化なし
- `cms/node_modules/payload/dist/fields/hooks/afterRead/relationshipPopulationPromise.js` — アクセス拒否時はIDのまま返す
- `docs/cms-operations.md` — コンテンツモデルの変更手順
