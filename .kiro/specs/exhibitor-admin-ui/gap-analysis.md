# ギャップ分析: exhibitor-admin-ui

> requirements は未承認 (`approvals.requirements.approved: false`)。分析結果を要件の修正に使えるよう、要件側の修正候補も末尾に記載する。

## 1. 分析サマリ

- 行レベル access は `policy.ts` の「関数 1 つで管理画面と REST を兼ねる」構成が既にあり、要件 1・2・3・10 の大半は既存パターンの拡張 (Where の差し替え、`admin.hidden` 関数、フィールド単位 access) で済む。
- 最大の穴は承認制 (要件 7・8)。「公開中の版を保ったまま編集を承認待ちにする」(7.5) は Payload の versions/drafts でしか素直に満たせない。status 値の追加だけでは公開中の内容の退避先がない。
- 公開サイトの画像は `/api/media/serve/:id/:size` 経由で配信される。このエンドポイントは Local API の既定 `overrideAccess: true` で `findByID` しており、media の read access を強めてもそのままでは素通りする (要件 7.6 の必須修正点)。
- OIDC による乗っ取り経路は `role-mapping.ts` から `student_exhibitor` 写像を外すことと、callback で既存ユーザーが実行委員以外なら拒否するガード 1 つとで塞げる。
- 工数は全体で M 上限〜L 下限 (5〜8 日相当)。2026-09-28 (残り 4 日) に全要件を揃えるのは厳しい。アカウント発行 (10/1) までに要る部分と、初回承認 (入稿締切 10/24 前) までに要る部分とに分けて段階的に出すのが現実的。

## 2. 現状調査

### 関連資産

| 領域 | ファイル | 現状 |
|---|---|---|
| 認可 | `cms/src/access/policy.ts` | `canRead` は出展者 × `student_exhibitions` に `or: [status=published, owner=me]` を返す。`media` は `PUBLISHED_FILTER` に無いため全員 `true`。`canUpdate/Delete` は出展者 × OWNED_COLLECTIONS (`student_exhibitions` のみ) に owner Where |
| 結線 | `cms/src/access/payload-access.ts`, `collections/index.ts` | `withAccess` が `access` を丸ごと `{read,create,update,delete}` で上書きする。`readVersions` / `unlock` 等は未定義のため Payload 既定 (ログイン済みなら許可) になる |
| 企画 | `cms/src/collections/student-exhibitions.ts` | `owner` は `admin.hidden: true` + `unique`。`status` (published/draft) は誰でも変更できる。`area_id` / `booth_number` / `booth_label` はフィールド access が無い。`performance_slots` は join で閲覧のみ |
| メディア | `cms/src/collections/media.ts` | owner 無し。`/serve/:id/:size` が `req.payload.findByID({ collection:'media', id, depth:0, req })` を呼ぶ (`overrideAccess` 未指定 = true) |
| ユーザー | `cms/src/collections/users.ts` | `auth: true` (ローカル認証有効)。`role` は既定値 `student_exhibitor`。フィールド access 無し |
| OIDC | `cms/src/auth/authentik-endpoints.ts:149-175`, `role-mapping.ts` | `authentik_sub` → `email` の順で既存ユーザーを引き、sub・email・role を上書きする。無ければ作る。`GROUP_TO_ROLE` に `student_exhibitor` がある |
| 設定 | `cms/src/payload.config.ts` | `email` アダプタ未設定。S3 は `s3Storage({ collections: { media: { prefix } } })` で、`disablePayloadAccessControl` 未指定 |
| テスト | `access/policy.test.ts`, `access/access.int.test.ts`, `collections/media.int.test.ts` | ロール別 access の単体・実 DB 統合テストの型がある (要件 11.1 の置き場) |

### フロントエンドの参照経路 (変更対象外。互換性の制約として確認)

- 一覧・マップ: `frontend/src/lib/exhibitions.ts:424`, `lib/campus-map.ts:173` が `where[status][equals]=published&depth=0` で `student_exhibitions` を未認証 REST 取得する。
- 詳細: `lib/exhibitions.ts:472` が `findById(..., {depth:1})` の結果について `exhibition.status !== 'published'` なら 404 扱いにする。
- 画像: `lib/cms-asset-url.ts:27` が `${CMS_URL}/api/media/serve/${fileId}/${size}` を組み立てる。media の URL フィールドは使わず、ID だけを使う。
- **制約**: フロントは `status` フィールドを直接見ている。drafts を導入しても `status=published` の意味 (= 承認済みの公開版) を保たなければ公開サイトが壊れる。

### S3 配信経路

- `@payloadcms/plugin-cloud-storage` は `disablePayloadAccessControl` が未指定のとき、`doc.url` を `/api/media/file/<filename>` にする。このルートは `uploads/checkFileAccess.js` が collection の `read` access を評価して DB を照合してから返す (Where も効く)。
- よって公開経路は `serve` (302) → `/api/media/file/<filename>` → S3 取得。`serve` 側で access を効かせれば、`file` 側も同じ read access で守られる。
- **Research Needed**: バケット自体が匿名 GET を許すか (aramakisai-infra 側の設定)。公開バケットでファイル名 (元ファイル名 + `.webp`) が推測できると、access を迂回して直接取得できる。

## 3. 要件 → 資産マップ

| 要件 | 必要なもの | ギャップ |
|---|---|---|
| 1 他団体の企画を隠す | 出展者の read を `owner=me` のみにする | **Missing** (`canRead` の Where 差し替えのみ。小) |
| 2 無関係コレクションを隠す | `admin.hidden: ({user}) => user?.role !== 'executive'` を 10 コレクション + 2 グローバルに付ける | **Missing** (小)。**Unknown**: hidden にした `map_areas` への relationship の表示名が出展者画面で解決されるか (read access は公開なので API 上は可) |
| 3 受け皿レコード | owner を実行委員に表示し、`filterOptions` で出展者ロールに絞る。重複時のメッセージ。割当 3 項目 + owner + status のフィールド単位 `access.update` を実行委員限定にする。出展者の create を禁止する | **Missing**。owner の `admin.hidden` と beforeChange の書き換えが要る。**Constraint**: unique 違反の既定エラーはユーザー名を示さないため、`validate` か `beforeValidate` で事前検索が要る |
| 4 ローカルアカウント発行 | 実行委員によるユーザー作成 (既存 UI で可)。初回ログイン手段の通知。本人によるパスワード変更。role のフィールド access | **Missing**: 出展者は `users` の read/update が全拒否のため、アカウント画面とパスワード変更ができない (`canRead` が PRIVATE_COLLECTIONS で false)。本人に限る Where と `role` / `authentik_sub` のフィールド access が要る。メール送信経路は未実装 |
| 5 OIDC から切り離す | 出展者グループでのログイン拒否。既存出展者との紐づけ拒否 | **Missing** (小) |
| 6 運用手順 | `docs/cms-operations.md` への追記 | **Missing** (文書のみ) |
| 7 公開の承認制 | 出展者は公開不可。公開中の版を保ったまま編集を保持。未承認メディアの非公開 | **Missing** (大)。§4.1, §4.3 |
| 8 承認・差し戻し | 承認待ちの一覧フィルタ、差分確認、承認、差し戻し理由、非公開化 | **Missing** (中)。drafts なら Publish/Unpublish と version 比較画面が標準で付く |
| 9 ラベル・説明文 | `admin.description` の書き換え | **Missing** (小)。`NULL=マップ非掲載`, `area_id+booth_number UNIQUE` 等が現存 |
| 10 メディアの本人限定 | `media.owner` の追加、read/update/delete の owner Where、承認済みメディアの保護 | **Missing** (中)。§4.2 |
| 11 検証 | `access.int.test.ts` の拡張 | 既存パターンあり |

## 4. 論点別の選択肢とトレードオフ

### 4.1 承認制の実現手段

Payload 3.88 のソースと現行ドキュメント (context7 `/payloadcms/payload` drafts.mdx) で次の点を確認した。
- `updateByID` は `beforeOperation` フックの戻り値で `args.draft` を上書きできる。`draft: true` の保存は versions テーブルにだけ書き込み、本体テーブル (= 未認証 REST が返す公開版) を更新しない (`collections/operations/utilities/update.js` の `if (!isSavingDraft) db.updateOne`)。
- ドキュメントが示す「出展者の publish を禁じる」方法は、`update` access に `{_status: {equals: 'draft'}}` を返すことである。この方法は、公開済みドキュメントを出展者が一切更新できなくする。7.5 (公開中の企画を編集して承認待ちにする) と両立しない。
- `draft=true` を付けた読み取りは、read access を満たせば最新ドラフトを返す。drafts を入れる場合は、未認証の read Where を `_status` で絞らないと承認前の編集が漏れる (ドキュメントの Important バナー)。

| 案 | 内容 | 長所 | 短所 |
|---|---|---|---|
| **A: versions/drafts** | `versions: { drafts: true }`。出展者の保存は `beforeOperation` で `draft=true` に固定する。Publish ボタンは出展者に出さない (custom `PublishButton` か `admin.components` の差し替え)。承認・差し戻しの状態は `review_state` (none/pending/rejected) と `review_note` の追加フィールドで持つ。`status` は afterChange/beforeChange で `_status` の写しとして維持し、フロント互換を保つ | 7.5 を標準機能で満たす。承認 = Publish、非公開化 = Unpublish (8.7)、差分確認 = version 比較画面 (8.2) が標準で付く | 追加テーブル (`_student_exhibitions_v` 系) と `_status` 列が増える (追加のみなので schema-check には掛からない見込み)。既存レコードの `_status` を `status` から埋めるデータ移行が要る。`readVersions` access を結線に足す必要がある (現状は未定義 = ログイン済み全員が全版を読める) |
| B: status に値を追加 | `status` に `pending` / `rejected` を足し、出展者は `published` を選べないようにフィールド access を付ける | スキーマ差分が小さい | 公開中の内容を保持する場所が無く、7.5 を満たせない。満たすには公開用スナップショット列が要り、フロントの読み先変更 (スコープ外) が必要になる |
| C: B + 公開後の出展者編集を禁止 | 承認後は出展者を読み取り専用にし、修正は差し戻し (`published` → `rejected` で非公開化) で行う | 最小工数 | 7.5 を要件から外すことになる。修正のたびに公開サイトから消える |

- 7.5 を残すなら A 一択。7.5 を緩められるなら C が最速。
- **Research Needed (A)**
  - 管理画面の一覧は最新ドラフトを表示するか。これにより `review_state=pending` の絞り込み (8.1) を一覧のフィルタでそのまま行えるかが決まる。
  - 公開ボタンだけを出展者から隠す最小の差し替え方法 (`admin.components.edit.PublishButton` をロール条件で空にする、など)。
  - 未認証で `?draft=true` を付けたとき、read Where `_status=published` が versions 側でどう評価されるか。
  - 既存行に version 行が無い状態で管理画面が正常に表示されるか。

### 4.2 メディアへの owner 追加と既存メディアの扱い

- 追加するフィールドは `owner` (users への relationship、非必須、フィールド access で出展者には非表示) と `approved` (checkbox)。どちらも nullable の追加なので破壊的変更にならない。
- owner は `beforeChange` で create 時に `req.user.id` を入れる。実行委員のアップロード分は同時に `approved=true` とする。
- 既存メディアは owner NULL のままとする。read Where を「実行委員: true / 出展者: `owner=me` / 未認証: `or: [{owner: {exists:false}}, {approved: {equals:true}}]`」にすれば 10.8 をマイグレーション無しで満たせる。
- 出展者の update/delete は `and: [{owner=me}, {approved: {not_equals:true}}]` の Where にする。
  - 承認済みの画像を差し替え・削除すると、公開版から参照しているファイルがその場で変わる (upload の hasMany は rels テーブル経由で、削除時は参照が即座に外れる)。10.6 を満たすには承認済みメディアを出展者から不変にするしかない。差し替えは「新規アップロード → 企画ドラフトで参照を差し替え → 承認」で行う。
  - 代替案は media にも drafts を入れること。upload コレクションでのファイル差し替えと drafts の組み合わせは挙動が不確か (**Research Needed**) で、工数も大きい。

### 4.3 未承認メディアを公開サイトから隠す

1. `media.ts` の `serve` エンドポイントの `findByID` に `overrideAccess: false` を付ける。これが無いと read access を何に変えても素通りする。
2. `/api/media/file/<filename>` は `checkFileAccess` が read Where を評価するため、1 と同じ Where で守られる (`disablePayloadAccessControl` を今後も立てないこと)。
3. `approved` を立てるのは承認時とする。企画の `afterChange` で `_status` が `published` に遷移したとき、各カテゴリ `images` の参照先メディアを `overrideAccess:true` で `approved=true` に更新する。
4. **Research Needed**: S3 バケットの匿名 GET 可否 (§2)。

### 4.4 管理画面でコレクションを隠す

- `admin.hidden` は collection・global ともに `({ user }) => boolean` を受け付ける (3.88 の型定義で確認)。hidden にするとナビ・ダッシュボード・管理画面のルートから消える。
- ただし hidden は管理画面の表示制御にすぎず、REST は access でしか守れない。出展者に不要なコレクションの read は現状公開 (`true`) であり、公開サイトが使うため絞れない。したがって「hidden (UI) + access (データ)」の役割分担になる。
- 実装位置は 2 案。
  - (a) 各定義ファイルに書く。
  - (b) `collections/index.ts` の `withAccess` と同じ登録口で、出展者向け許可リスト (`student_exhibitions`, `media`) 以外に一括で付ける。付け忘れが起きず、既存の「登録口で結線する」方針と揃う。
- `users` は hidden にしても、アカウント画面 (`/admin/account`) で本人の read/update が要る。`canRead/canUpdate` に出展者 × `users` で `{id: {equals: me}}` を足す。`role` / `authentik_sub` には実行委員限定のフィールド access を付ける (4.6 対策)。

### 4.5 メール送信経路

| 案 | 内容 | 長所 | 短所 |
|---|---|---|---|
| **手動送付 + 仮パスワード** | 実行委員が作成時に仮パスワードを設定し、自分のメールで送る | コード 0 | 平文パスワードがメールに残る。本人にパスワード変更を促す運用が要る |
| **forgot-password トークン流用** | `payload.forgotPassword({ disableEmail: true })` が返すトークンから `/admin/reset/<token>` を組み立て、実行委員向けの管理画面ボタンか endpoint で表示する。実行委員は手動でメールする | SMTP 不要。平文パスワードを送らない。再発行 (4.5) にも同じ操作を使える | 小さな custom endpoint/UI が要る。トークン有効期限 (`auth.forgotPassword.expiration`、既定 1 時間) を数日に延ばす必要がある |
| email adapter (`@payloadcms/email-nodemailer` 等) | SMTP を設定し、標準の forgot-password メールを自動送信する | 本人によるリセット (4.5 の「出展者本人の操作」) が標準で動く | 依存の追加、SMTP 資格情報の調達 (Infisical・k8s secret・infra 側)、送信ドメインの SPF/DKIM。4 日で揃える見込みが薄い (**Research Needed**: 使える送信元) |

- 期日に対してはトークン流用が妥当。adapter は後から足しても同じ reset 画面を使える。

### 4.6 OIDC による出展者アカウントの乗っ取り (`authentik-endpoints.ts:150-163`)

- 経路: sub で引けないとき email で既存ユーザーを引き当て、`authentik_sub` と `role` を上書きする。これにより、同じメールアドレスの Authentik ユーザーがローカル出展者アカウントを乗っ取れ、ロールの昇格・降格もできる。
- 塞ぎ方は次の組み合わせ。
  1. `role-mapping.ts` の `GROUP_TO_ROLE` から `student_exhibitor` を外す。`toCmsIdentity` が null を返し、既存の 403 経路に乗る (5.1・5.2)。
  2. callback で引き当てた既存ユーザーの `role !== 'executive'` なら拒否し、紐づけも更新もしない (5.3)。email による引き当てを実行委員に限る Where (`and: [{email}, {role: executive}]`) にしてもよい。
  3. `users.role` / `authentik_sub` のフィールド access を実行委員限定にし、出展者の自己昇格を REST からも防ぐ (4.6)。
- 既存の `authentik-endpoints.test.ts` / `role-mapping.test.ts` を拡張すれば検証できる。**Research Needed**: 本番に OIDC 経由で作られた既存の出展者ユーザーの有無 (移行で消す・残すの判断)。

## 5. 実装アプローチ

- **Option A (既存拡張中心)**: `policy.ts` の Where 拡張、各定義へのフィールド access・description 追加、`authentik-endpoints.ts` へのガード追加、`payload-access.ts` への `readVersions` 追加。新規ファイルは承認用フックと custom 公開ボタン程度。既存方針 (policy 一元化・登録口結線) に最も沿う。
- **Option B (承認ワークフローを新規モジュール化)**: `cms/src/review/` 等に承認状態遷移・メディア承認反映・reset URL 発行を切り出す。テストはしやすいが、4 日の期日では設計の往復が増える。
- **Option C (ハイブリッド、段階導入)**
  - 第 1 段 (9/28 まで): 要件 1・2・3・5・9・10 の read/owner、出展者の公開禁止 (`status` / `_status` のフィールド access)、アカウント発行 (手動 or トークン流用)。
  - 第 2 段 (初回承認開始まで): drafts 導入・承認状態・メディア approved・7.5・8.x。
  - 第 1 段だけでも、出展者は「下書き保存のみ、公開は実行委員」という安全側の状態になる。

## 6. 工数とリスク

| 範囲 | 工数 | リスク | 根拠 |
|---|---|---|---|
| 要件 1・2・9 | S | Low | Where 差し替え・`admin.hidden` 関数・文言のみ |
| 要件 3 (owner 選択・割当の読み取り専用・create 禁止) | S | Low | フィールド access と `filterOptions` で済む。既存 int test の `selfCreated` ケースは書き換えが要る |
| 要件 4 (トークン流用) + 5 | S〜M | Medium | 認証まわりで、users の本人 read/update と custom endpoint が要る |
| 要件 10 + 7.6 (メディア owner/approved、serve 修正) | M | Medium | マイグレーション 1 本、access・フック追加、S3 公開可否が未確認 |
| 要件 7・8 (drafts 承認制) | M〜L | High | 新パターン (drafts・custom 公開ボタン・データ移行)。フロント互換 (`status` 写し) の検証が要る |
| 要件 6・11 | S | Low | 文書とテスト拡張 |
| **合計** | **L (下限、5〜8 日)** | **High** | 残り 4 日 (9/24→9/28) を上回る |

## 7. 設計フェーズへの申し送り

- 推奨方向: Option C。第 1 段を 9/28、第 2 段 (drafts) を初回承認開始前に置く。承認手段は 7.5 を残す限り drafts (4.1 案 A)。
- 決めること
  - `status` と `_status` の関係 (写しで持つか、フロントの読み先を将来変えるか)
  - 公開ボタンを隠す実装手段
  - メール経路 (トークン流用 + 有効期限)
  - 承認済みメディアを不変にする方針
- Research Needed
  - S3 バケットの匿名 GET 可否
  - drafts の一覧・`?draft=true`・既存行の version 欠如時の挙動
  - hidden コレクションへの relationship 表示の解決
  - 本番の既存出展者ユーザーの有無
  - 送信元 SMTP の有無

## 8. 要件側の修正候補

- **10.4 と 10.6 の矛盾**: 承認済みメディアの「ファイル差し替え」を許すと、承認前に公開版の画像が変わる。「承認済みのメディアは出展者から変更・削除できず、差し替えは新規アップロードで行う」に改める案。
- **3.9**: 方式1 では出展者が企画を作る場面が無い。「出展者は学生企画を新規作成できない」と無条件にすれば、実装 (create access を false にするだけ) も検証も単純になる。
- **4.2 / 4.5**: 「メールで通知できるようにする」は CMS の送信機能を含意する。期日内ならトークン流用 + 実行委員の手動送付になるため、「実行委員が通知用のログイン手段 (リンク) を取得できる」に言い換え、本人によるリセットはメール経路の導入後とする案。
- **11.2**: 第 1 段・第 2 段の段階導入にするなら、期日を段ごとに分けて記載する (第 2 段は初回承認開始日まで)。
- **Boundary**: 「公開サイトは `status=published` を引き続き承認済み版の判定に使える」を Adjacent expectations に明記する (フロント変更がスコープ外であることの帰結)。
