# Research & Design Decisions: exhibitor-admin-ui

## Summary
- **Feature**: `exhibitor-admin-ui`
- **Discovery Scope**: Extension (既存の Payload 3.88 CMS への権限・認証・管理画面表示の拡張。認証まわりは security-sensitive のため、Payload のソースで挙動を確認した)
- **Key Findings**:
  - フィールド単位の `access.update` が false のとき、Payload は入力値を黙って捨てて既存値を残す (`fields/hooks/beforeValidate/promise.js`)。割当項目と公開状態は、これだけで「変更を反映しない」を満たせる。
  - `beforeOperation` フックは `updateByID` / `deleteByID` / `resetPassword` で access 評価より先に走る。このため、既定の英語メッセージ (`Forbidden` / `Token is either invalid or has expired.`) の代わりに、案内付きの日本語エラーを返せる。
  - `forgotPassword({ disableEmail: true, expiration })` はトークンを DB に上書き保存して返す。再送すると前のトークンは無効になる。`expiration` の優先順位は collection 設定 → 呼び出し引数 → 既定 1 時間。

## Research Log

### フィールド access と既定の挙動
- **Sources**: `node_modules/payload/dist/fields/hooks/beforeValidate/promise.js` L217-236
- **Findings**: `field.access[operation]` が偽のとき、`delete siblingData[field.name]` のあと `getFallbackValue` (update 時は既存値) で埋め直す。`overrideAccess: true` の Local API ではフィールド access を評価しない。
- **Implications**: 出展者から割当・公開状態・owner の変更は届かず、保存自体は成功する。実行委員と Local API (overrideAccess) は同じ値を保存できる (3.3)。

### access Where とクエリパス検証
- **Sources**: `collections/operations/find.js` L75-135
- **Findings**: `validateQueryPaths` の対象は利用者が渡した `where` だけで、access 関数が返した Where は検証されない。
- **Implications**: 出展者が read 権限を持たない `owner` でも、access 側の Where では絞り込みに使える。未認証向けの media Where で `owner.role` を参照しても、パス検証で弾かれない。

### updateByID の処理順と Where 不一致
- **Sources**: `collections/operations/updateByID.js` L25-93, `deleteByID.js` L26
- **Findings**: beforeOperation → executeAccess → Where を合成して対象を取得、の順に進む。Where があって対象が見つからないときは `Forbidden` (ja: 「このアクションは許可されていません。」)。beforeOperation の operation 名は `update` / `delete`。
- **Implications**: 公開済み企画の保存は、access (Where で除外) でも拒否できる。案内文を出すには beforeOperation で先に判定する。

### 管理画面の hidden
- **Sources**: `collections/config/types.d.ts` L414 (`hidden?: ((args:{user}) => boolean) | boolean`), `@payloadcms/next/dist/views/{List,Document}/handleServerFunction.js`, `views/Account/index.js`, `@payloadcms/ui/dist/utilities/buildTableState.js`
- **Findings**:
  - hidden はナビ・ダッシュボード・コレクションのルートから外すだけ。
  - アカウント画面は `admin.user` コレクションを直接読むため、users を hidden にしても使える (ただし本人の read/update access は要る)。
  - join テーブルの描画 (`buildTableState`) は hidden を見ず、read access だけを見る。
- **Implications**:
  - users を hidden にしても出展者はアカウント画面でパスワードを変えられる。
  - 出演枠の join テーブルは、performance_slots を hidden にしても出展者に表示される見込みである。これは結合テストと手動確認の対象とする (2.3)。

### 認証フィールドの上書き
- **Sources**: `collections/config/sanitize.js` L238 (`mergeBaseFields`), `auth/baseFields/email.js`
- **Findings**: コレクションの fields に `email` を定義すると、基本の auth フィールドにマージされる。
- **Implications**: `email` にフィールド access を付けて、出展者による変更を止められる (4.18)。

### 招待・再設定
- **Sources**:
  - `auth/operations/forgotPassword.js`
  - `auth/operations/local/forgotPassword.js` (Local API は `req` を引き継ぐ)
  - `auth/operations/resetPassword.js` (L27 beforeOperation、L53 のエラーは英語固定)
  - `collections/operations/create.js` L189 (`registerLocalStrategy` に渡る password は beforeOperation 後の `args.data.password`)
  - `@payloadcms/next/dist/views/ResetPassword` (表示時にトークンを検証しない)
- **Findings**:
  - 招待リンクと再設定リンクは同じ `resetPasswordToken` を使う。
  - reset 画面は送信したときにだけ API エラーを出す。
  - forgotPassword は内部で `payload.update(users)` を呼ぶため、users の afterChange (operation=update) が再び発火する。
- **Implications**:
  - 期限切れの案内は、resetPassword の beforeOperation で日本語の APIError を投げて出す。
  - 招待送信のフラグを `req.context` に置く場合、送信前に消費 (削除) しないと再帰送信する。

### メール送信経路
- **Sources**:
  - context7 `/payloadcms/payload` (email/overview.mdx: `nodemailerAdapter({ defaultFromAddress, defaultFromName, transportOptions })`)
  - aramakisai-infra `gitops/manifests/prod/mailserver/service.yaml`
  - aramakisai-infra `roundcube/deployment.yaml`
  - aramakisai-infra `vaultwarden/deployment.yaml`
  - aramakisai-infra `cms-secrets/external-secret.yaml`
- **Findings**:
  - Service `mailserver.prod.svc.cluster.local` は 587 (submission) を公開している。証明書は `mail.aramakisai.com` 向け。
  - vaultwarden は 587 + STARTTLS、ユーザー名 `noreply@aramakisai.com` (フルアドレス必須) で送っている。
  - Infisical キー `NOREPLY_SMTP_PASSWORD` は authentik / vaultwarden の ExternalSecret で参照済みだが、`cms-secrets` には無い。
  - prod 名前空間に NetworkPolicy は無い。
- **Implications**:
  - クラスタ内 Service へ 587/STARTTLS で接続し、TLS の servername に `mail.aramakisai.com` を指定する。
  - `@payloadcms/email-nodemailer@3.88.0` を依存に追加する。

### 公開サイトでの表示位置 (文言の根拠)
- **Sources**:
  - `frontend/src/lib/exhibitions.ts` (toCard / resolveLocationForCategory / getExhibitionDetail)
  - `components/exhibition-card.tsx`
  - `app/(site)/exhibitions/[id]/[category]/page.tsx`
  - `components/exhibition-gallery.tsx`
  - `components/exhibition-links.tsx`
  - `components/exhibition-location-map/exhibition-location-section.tsx`
  - `components/featured-exhibitions.tsx`
  - `app/(site)/page.tsx`
  - `lib/campus-map.ts`
  - `components/exhibition-filters.tsx`
- **Findings**:
  - カード: 画像枠は 300:225 (4:3) で `object-cover`、960 幅。場所の行と企画名を表示し、団体名は出さない。
  - 企画一覧・マップ・トップページ「企画」欄 (ランダム 4 件) は同じカードを使う。カテゴリごとに 1 枚。
  - 詳細ページ:
    - ギャラリー: 4:3 の `object-cover`。大画像は 1920 幅、サムネイルは 960 幅。
    - カテゴリのバッジ。
    - 見出しに企画名。その下に団体名、場所、リンクのアイコン、共有ボタン。
    - 「紹介」欄 (改行保持)。紹介文は共有時の説明文にも使う。
    - 「場所」欄 (地図)。
  - 場所の表示:
    - ステージは出演ステージ名。
    - それ以外は「エリア名 + マップ表示ラベル」。
    - `booth_number` は表示しない。
  - 代替テキストが空のときは企画名で代用する。一覧 (depth 0) は常に企画名になる。
  - 検索欄は「企画名・団体名で検索」。リンクの website は「公式サイト」と表示する。
- **Implications**: 文言表の根拠列にそのまま使う。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|---|---|---|---|---|
| 既存 policy 拡張 (採用) | `policy.ts` の Where を差し替え、登録口 (`collections/index.ts`) で hidden を結線する。フィールド access と hooks をコレクション定義に足す | 「関数 1 つで管理画面と REST を兼ねる」既存方針と一致。新規モジュールは最小 | policy.ts の分岐が増える | 承認制は 2 状態のため drafts 不要 |
| versions/drafts | gap-analysis の案 A | — | 要件 7 (2 状態、公開済みは出展者が保存不可) には過剰 | 前提廃止のため不採用 |

## Design Decisions

### Decision: 公開済み企画の保存拒否
- **Alternatives**:
  1. access Where のみ (既定の英語寄りのメッセージ)
  2. フィールド access で全項目を読み取り専用にする
  3. access Where + beforeOperation での案内
- **Selected**: 3。
  - コレクションの update access を「owner=自分 かつ status=draft」にする。管理画面ではドキュメント単位の権限で編集不可になる。
  - updateByID の beforeOperation で、自分の公開済み企画への保存に案内メッセージを返す。
- **Trade-offs**: 一括更新 (where 指定) では案内が出ず、該当レコードが対象外になるだけ。出展者の画面には一括編集の入口が実質無いため許容する。

### Decision: 承認済みメディアの判定
- **Alternatives**:
  1. read access 内で公開企画を毎回検索して ID の in リストを作る
  2. 派生フラグ `used_in_published` を企画側フックで維持する
- **Selected**: 2。
  - 配信エンドポイントは画像 1 枚ごとに呼ばれるため、access 内で都度検索しない。
  - 企画の afterChange / afterDelete で、前後の画像 ID の和集合について再計算する。
- **Follow-up**: フラグとの整合を結合テストで検証する (公開→下書き、公開中の画像差し替え、公開企画の削除)。

### Decision: 未認証向けの media read Where
- **Selected**: `or: [owner が空, owner.role = executive, used_in_published = true]`。
  - 実行委員のアップロード分と既存分 (owner なし) は従来どおり公開する。
  - 出展者のアップロード分は、公開企画から参照されたものだけを公開する。

### Decision: 招待リンクの有効期限
- **Selected**:
  - 発行 (再送を含む) から 72 時間の固定値とし、コード上の定数で `forgotPassword` の `expiration` に渡す。設定値は持たない。
- **Rationale**:
  - 期限切れでも、出展者はログイン画面の再設定で自力で復旧できる。
  - 追随させるには、全出展者の `resetPasswordExpiration` を一括で書き換える処理が要る。

### Decision: 再設定リンクの有効期限
- **Selected**: Payload 既定の 1 時間。`auth.forgotPassword.expiration` は設定しない (設定すると招待の呼び出しごとの expiration が無視されるため)。

### Decision: 招待の再送手段
- **Selected**: users に仮想チェックボックス `resend_invite` (DB 列なし、実行委員のみ書込可) を置く。
  - 保存時に再送する。
  - 管理画面・REST・Local API で同じ手段を使え、React コンポーネントの追加が要らない。

### Decision: 招待メールを commit 後に送る
- **Context**: afterChange / afterOperation はどちらも commit の前に走る (`collections/operations/create.js:291, 308, 324`)。操作に commit 後のフックは無い (`utilities/commitTransaction.js`)。
- **Selected**: afterChange でジョブキュー (`payload.jobs.queue`) に同じトランザクションで積み、`jobs.autoRun` (`index.js:239-244`) が commit 後に実行する。トークン発行・送信・記録はジョブ内で行う。
- **Trade-offs**: `payload-jobs` テーブルが増え、送信まで最大 10 秒遅れる。作成が巻き戻ればジョブも残らない。

## Risks & Mitigations
- S3 バケットが匿名 GET を許す場合、ファイル名を推測されると access を迂回できる。対策: aramakisai-infra 側でバケットポリシーを確認する (別リポジトリ作業に記載)。
- 本番に OIDC 経由で作られた出展者ユーザーが残っていると、切り替え後はログインできなくなる。対策: 運用手順で招待メールの再送を行う (ローカル認証へ移す)。
- 招待メールの送信は users 作成のトランザクション内で行う。SMTP の遅延が作成時間に乗る。一括発行 (数十〜百件) なら許容範囲とする。

## References
- Payload 3.88 ソース (`cms/node_modules/payload/dist`, `@payloadcms/next/dist`, `@payloadcms/ui/dist`)
- context7 `/payloadcms/payload` email/overview.mdx
