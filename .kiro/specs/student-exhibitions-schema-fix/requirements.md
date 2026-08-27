# Requirements Document

## Project Description (Input)

### 背景

学生団体コンテンツで報告された不具合・要望:

1. 企画名 (`name`) はあるが団体名フィールドが存在しない
2. 使っていない `slug` カラムが残っている (詳細ページは id 直参照でよい)
3. `category` の選択肢文言が実態と合わない (出展→展示、模擬店→出店) かつ単一選択のため複数分類 (最大2つ) を選べない
4. `category` の note「表示分類 (掲載判定とは独立)」という不要な説明ロジック
5. リンク・SNSアカウントを表示するフィールドが無い
6. `category=stage` を選んでも `performance_slots` (ステージ出演枠) との紐付け手段が編集画面に無い (m2oは張られているが逆方向o2mが未定義)
7. RBAC (`directus_permissions.fields`) の student_exhibitor 編集可能フィールド一覧が陳腐化 (`slug,description,content,images` — content/imagesは既存スキーマに無い) しており、新フィールドも含まれず団体担当者が編集できない
8. 画像アップロード権限が無制限 (種別・サイズ制限なし) かつ read が無条件 (全団体の画像が閲覧・流用できてしまう)。「自分の画像のみ」に制限し、種別=画像のみ、サイズ10MB上限、団体あたり最大5枚にしたい
9. 学生団体担当者が自企画の編集に必要としないコレクション (協賛企業・お知らせ・FAQ・トピック・祭メタ・固定ページ等) まで管理画面のナビゲーションに並んでおり、導線が分かりにくく誤操作の余地がある

また collection の日本語表示名を「学生団体」→「学生企画」に変更する。英語のcollection名 (`student_exhibitions`, テーブル名) 自体は変更しない — リネームは破壊的コストが高く実利が薄いため、表示ラベルのみの変更に留める。

フロントエンドはこの collection をまだ全く参照していない (grep 0件) ため、対象は Directus スキーマ (`directus/schema/snapshot.yaml`) とカスタム RBAC migration のみ。`student_exhibitions` の既存データは 0件。CLAUDE.md 記載の additive-only 機械強制 (`additive-schema-check.yml`) は本番未公開期間中につき `if: false` で一時停止中のため、破壊的変更 (カラム削除・型変更) も実施してよい。

**画像の自動最適化は本スペックのスコープ内**。最適化は**アップロード時に1回だけ**行い、配信のたびに変換処理が走らない状態を目標とする。

最適化を行う意図:

1. 配信時に変換すると、そのたびに計算リソースを消費する
2. 最適化しないまま配信すると通信量が増大する
3. 通信量の増大がロード時間を悪化させる
4. 配信時変換そのものもロード時間を悪化させる

したがって、保存される実体そのものを縮小・WebP 化する方式を採る。用途別サイズ (サムネイル / カード / 詳細) の出し分けは Cloudflare のエッジで行い、Directus 側では一切変換しない。

Cloudflare 前提の判断材料:

- `api.aramakisai.com` は Cloudflare proxied。ただし `/assets/<uuid>` には拡張子が無く、既定のキャッシュ対象 (拡張子ベース) に載らないため Cache Rule が必要
- Cloudflare Image Transformations は Free プランで月 5,000 unique transformations まで無料。学生企画 100 件 × 3 サイズ程度なら十分収まる。`/assets/*` の Cache Rule は `aramakisai-infra` の `terraform/cloudflare_directus_assets.tf` で適用済み。Image Transformations 自体は provider の制約により Terraform 管理外で、ダッシュボードから手動で有効化されている
- Directus の配信時変換は初回リクエストで生成・保存されるが、その計算は `replicas: 1` / `512Mi` の単一 pod で走る。エッジ変換に寄せれば origin の計算はゼロになる

Directus という「箱」(コンテナイメージ・K8s マニフェスト・env) は `aramakisai-infra` の所有、Directus の「中身」(スキーマ・カスタム migration・拡張・設定データ) は `aramakisai-web` の所有とする。Storage Asset Presets は `directus_settings` に保存されるデータであるため中身側に属し、custom migration で管理できる。

アップロード時変換は hook 拡張で実現する。`directus-extension-image-upload-resizer` (hook 拡張、env `EXTENSIONS_REDUCE_ON_UPLOAD_QUALITY` / `EXTENSIONS_REDUCE_ON_UPLOAD_MAXSIZE`、JPEG/PNG/WebP を WebP 化) を参照実装とするが、対応バージョンが `^9.0.0 <=11.12.0` で本番の 12.1.1 を含まないため、そのまま導入せず `aramakisai-web` 管理下の拡張として取り込み 12.1.1 で動作させる。

**design フェーズで解くべき既知の制約** (いずれも実イメージ・マニフェストで確認済み):

- 標準イメージの `sharp` は pnpm の hoist ディレクトリ (`/directus/node_modules/.pnpm/node_modules/sharp`) にあり、`/directus/extensions` からは通常の import で解決できない。既存の `schema-apply-job.yaml` が `knex` を絶対パスで require しているのと同じ問題
- 拡張の配信経路が未整備。`directus-schema-sync.yml` は `snapshot.yaml` と `migrations/**` のみを ConfigMap 化しており、Deployment に `/directus/extensions` のマウントがない (migrations は schema-apply Job 側でのみマウント)
- prod は `replicas: 1` / `limits.memory: 512Mi`。マニフェスト自身が「sharp 画像変換でスパイクする」と注記しており、変換処理のメモリ予算に配慮が必要
- ローカル `docker-compose.yaml` は `MIGRATIONS_PATH=/directus/extensions/migrations` を使っており、`./extensions` を同じパスにマウントすると衝突する
- `filename_disk` の拡張子を書き換える場合、S3 上の変換前オブジェクトを明示的に削除しないと孤児化する

ファイルサイズ上限は `directus_permissions.validation` では強制できない (Directus は権限評価 → ディスク書込 → `filesize` 更新の順で処理するため、評価時点で `filesize` が未確定)。実効的な唯一の手段は `FILES_MAX_UPLOAD_SIZE` (env = infra 所有) となる。

### 確定した設計方針

- カテゴリ複数選択: `category` を `type: string` (単一select) → `type: json` (配列, `select-multiple-dropdown`, `special: [cast-json]`) に変更。選択肢 value は不変 (`stage`/`exhibit`/`vendor`/`other`)、表示テキストのみ「出展→展示」「模擬店→出店」に変更。最大2件の制約はDB/スキーマレベルでは強制せずnoteに明記のみ。
- `slug` カラムは完全削除 (schema・DB両方)。
- リンク/SNS: 汎用JSON配列フィールド `links` ({label, url} の繰り返し, `interface: list`, `festival_meta.sns_links` と同一パターン) を新設。
- 団体名: 既存 `name` (企画名) はそのまま残し、新規 `organization_name` (団体名) を追加。
- `area_id`/`booth_number`/`booth_label` の conditions (`category _nin: [exhibit, vendor]`) は撤去し常時表示にする。noteに用途ヒントを残す。
- `student_exhibitions` → `performance_slots` の逆参照フィールド (`type: alias`, `special: [o2m]`, `interface: list-o2m`) を新設し、既存 relation の `one_field` を紐付ける。常時表示。
- `image` (単一uuid) を `images` (m2m junction `student_exhibitions_files`, `interface: files`, `special: [files]`) に差し替え、複数画像対応にする。件数上限 (5枚) はDirectus標準UIで強制不可のためnote記載のみ。
- RBAC: student_exhibitor の編集可能フィールド一覧を新スキーマに合わせて更新。
- RBAC: student_exhibitor の `directus_files` 権限は、read = 「自分がアップロードしたファイル」OR「自企画に紐づくファイル」(executive 代理アップロード分を編集画面で表示するため)、update/delete = 自分のファイルのみ。create 時の validation は画像種別 (`image/jpeg`/`image/png`/`image/webp`) のみ。
- RBAC: 新設 junction collection `student_exhibitions_files` に executive全CRUD、student_exhibitor は自分の exhibition レコードに紐づく分のみCRUDの権限を新設。
- RBAC: student_exhibitor から不要コレクションの read 権限を削除し、管理画面ナビゲーションを自企画の編集導線に絞る。Directus はコレクション単位の read 権限がナビゲーション表示を決めるため、非表示化は read 権限の剥奪で実現する。
- 画像最適化 (アップロード時): hook 拡張で長辺上限を超える画像を縮小し、WebP に統一変換して保存する。`directus-extension-image-upload-resizer` を参照実装とし、Directus 12.1.1 対応版を `aramakisai-web` 管理下に置く。
- 用途別サイズの出し分けは Cloudflare Image Transformations とエッジキャッシュ (Cache Rule) で行い、Directus の配信時変換 (Storage Asset Presets) は使用しない。Cloudflare 側の設定は frontend / infra terraform の作業。
- ファイルサイズ上限: `FILES_MAX_UPLOAD_SIZE=50mb` を infra 側 Deployment に設定 (permission validation では不可)。全ロール共通のため executive の PDF 添付が通る値にする。学生個別の上限は設けない。
- MIME 許可形式から `image/gif` を除外する。

カスタムmigration (DDL) は不要 (`directus schema apply` のみで完結)。RBAC (`directus_permissions` 等の直接データ) のみカスタムmigrationが必要。

### 実装内容の要点

**`directus/schema/snapshot.yaml` 編集** (student_exhibitions フィールド):

| sort | field | 変更内容 |
|---|---|---|
| 1–6 | id〜status | 変更なし |
| 7 | `name` | note修正: `企画名 (団体名は organization_name を参照)` |
| 8 | `organization_name` | 新規。`type: string`, `required: true`, translation「団体名」。旧`slug`ブロック位置を置き換え |
| ~~8~~ | ~~slug~~ | 削除 |
| 9 | `category` | `type: string`→`json`, `interface: select-multiple-dropdown`, `special: [cast-json]`, `default_value: '["other"]'`, 選択肢text変更 (展示/出店), note簡潔化 |
| 10 | `performance_slots` | 新規 alias/o2m |
| 11-13 | `area_id`/`booth_number`/`booth_label` | `conditions: null` に変更、note末尾に用途ヒント追記 |
| 14 | description | 変更なし |
| 15 | `links` | 新規 json配列 ({label, url} repeater) |
| 16 | ~~image~~ → `images` | 削除→新規alias/m2mに差し替え (`interface: files`, `special: [files]`) |

collection meta.translations の日本語表示名を「学生団体」→「学生企画」に更新。

relations セクション: `performance_slots.exhibition_id` の `one_field: null` → `one_field: performance_slots`。

新規junction collection `student_exhibitions_files` (`topics_files`/`announcements_files` と同型、`id`/`student_exhibitions_id`/`directus_files_id`/`sort` の4フィールド + relations 2本、`on_delete: CASCADE`)。

**新規RBAC migration 3本**:

1. `directus/migrations/20260815A-rbac-student-exhibitions-fields.js` — `STUDENT_EXHIBITOR_POLICY_ID` の student_exhibitions create/update `fields` を `"name,slug,description,content,images,status"` → `"name,organization_name,category,description,links,images,status"` に更新。
2. `directus/migrations/20260815B-rbac-files-restrict-and-validate.js` — student_exhibitor の `directus_files` 権限を全面更新。create時に画像種別 (`image/jpeg`,`image/png`,`image/webp`) のvalidation、read は `uploaded_by: { _eq: "$CURRENT_USER" }` OR 自企画に紐づくファイル、update/delete は `uploaded_by` 一致のみ。サイズ上限は `FILES_MAX_UPLOAD_SIZE=50mb` (infra、全ロール共通) で強制し、student_exhibitor 個別の上限は設けない。
3. `directus/migrations/20260815C-rbac-student-exhibitions-files-junction.js` — 新設 `student_exhibitions_files` collectionに executive全CRUD、student_exhibitorは `student_exhibitions_id.user_created: { _eq: "$CURRENT_USER" }` のリレーション越しフィルタでCRUD。

### 検証手順

1. `directus/migrations/` はコンテナに直接マウント済みのため、3ファイル配置後 `docker exec directus-directus-1 npx directus database migrate:latest` で即適用。
2. `docker cp` + `docker exec -it directus-directus-1 npx directus schema apply /tmp/snapshot.yaml` (`--yes`無しでdiffプレビュー目視確認)。
3. 適用後、`\d student_exhibitions` `\d student_exhibitions_files` で実カラム・FK・CASCADE確認。
4. `directus_permissions` を直接SELECTし、student_exhibitor policyの全行が意図通りか確認。
5. テスト用 `student_exhibitor` ユーザーでのアップロード制限・ファイル閲覧範囲・レコード紐付け範囲の動作確認、executiveユーザーでの全操作可能性確認。
6. ラウンドトリップ確認 (`schema snapshot` 再出力 → リポジトリの snapshot.yaml と diff)。
7. hook 拡張をローカル Directus に配置し、上限超過画像・上限以内画像・非画像ファイルのアップロードで、縮小結果・WebP 変換・`type`/拡張子/`filesize`/`width`/`height`・変換前オブジェクトの削除を確認。
8. `image/gif` および許可外 MIME のアップロードが拒否されることを student_exhibitor ユーザーで確認。

### Critical Files

- `directus/schema/snapshot.yaml`
- `directus/extensions/hooks/image-optimize/` (新規 hook 拡張)
- `directus/migrations/20260815A-rbac-student-exhibitions-fields.js` (新規)
- `directus/migrations/20260815B-rbac-files-restrict-and-validate.js` (新規)
- `directus/migrations/20260815C-rbac-student-exhibitions-files-junction.js` (新規)
- 参考: `20260701C-rbac-roles.js`, `20260712C-rbac-file-library.js`, `20260713A-rbac-attachments-junctions.js`
- 参考: `festival_meta.sns_links`, `announcements.attachments`/`topics_files`
- `.github/workflows/directus-schema-sync.yml` (拡張の配信経路を追加)
- `directus/docker-compose.yaml` (拡張のマウント追加)
- 参考 (infra): `gitops/manifests/{prod,staging}/directus/deployment.yaml` (`FILES_MAX_UPLOAD_SIZE` / extensions マウント追加先)
- 参考 (infra): `gitops/manifests/prod/directus/schema-apply-job.yaml` (pnpm hoist 配下を絶対パス require する既存パターン)

## Introduction

`student_exhibitions` (学生企画) コレクションのスキーマと RBAC を、実運用で判明した不備に合わせて是正する。団体名と企画名の分離、カテゴリの複数選択化、リンク・複数画像の登録、ステージ出演枠の逆参照といったフィールド構成の刷新と、学生団体担当者 (`student_exhibitor` ロール) の編集可能フィールド・ファイルアップロード制限・管理画面に表示するコレクション範囲の是正を一括で行う。

フロントエンドはこのコレクションをまだ参照しておらず、実データも0件のため、破壊的変更を含めて `directus/schema/snapshot.yaml` と `directus/migrations/` の変更だけで完結する。

## Boundary Context

- **In scope**: `student_exhibitions` および新設 junction `student_exhibitions_files` のスキーマ定義、`student_exhibitor` / `executive` policy の権限 (対象コレクション・フィールド・ファイル制限)、アップロード時に縮小・WebP 変換を行う Directus hook 拡張、ローカル Directus での適用検証。
- **Out of scope**: フロントエンド実装、Cloudflare 側の設定 (Image Transformations の有効化・Cache Rule・`next/image` のローダー) は frontend / infra terraform の作業、コレクション名・テーブル名のリネーム、public ロール / 静的トークンの権限変更、Directus コンテナイメージ・K8s マニフェスト・env そのものの設計 (`aramakisai-infra` 所有)。
- **Adjacent expectations**: Directus の「箱」(イメージ・Deployment・env) は `aramakisai-infra` 所有、「中身」(スキーマ・migration・拡張) は `aramakisai-web` 所有。用途別サイズの配信は Cloudflare Image Transformations + Cache Rule で行う。両者は infra 側で適用済み。エッジキャッシュが有効なため、アップロード直後から最適化完了までの窓で原本がキャッシュされうる。`/assets/*` の edge TTL は `override_origin` で 30 日に設定されており、実体の差し替えでは URL が変わらないため、汚染されたキャッシュは 30 日残る。フロントエンドは画像取得時に `?v=<modified_on>` を付与してキャッシュキーを分離する。本スペックで infra 側に必要な変更は `FILES_MAX_UPLOAD_SIZE=50mb` の追加と、hook 拡張を動作させるための `/directus/extensions` マウント追加で、いずれも web 側 PR に付随する infra PR として扱う。`directus/**` の変更は `directus-schema-sync.yml` 経由で `aramakisai-infra` に PR として伝播し、ArgoCD の K8s Job が `schema apply` と `database migrate` を実行する。カスタム migration で `directus_permissions` を直接更新した場合は Directus の再起動が必要になる。

## スコープ変更 (2026-08-27)

RBAC に関する部分 (Requirement 9 / 10 / 12) は本スペックの対象外とし、`payload-cms-migration` スペックの Requirement 2 / 3 へ委譲した。

理由は Directus 12.1.1 の無償ライセンス (`CORE_LICENSE`) にある。`custom_permission_rules_enabled: false` のため、行レベルフィルタ・フィールド制限・`validation` を持つ `directus_permissions` 行が権限評価から無言で除外される。`student_exhibitor` ロールに求める「自企画のみ編集可」は Directus 上では実現できない。調査結果は research.md の「スパイク結果: Directus 12 の custom permission rule はライセンス機能」および「判断: RBAC は本スペックのスコープから外す」を参照。

Requirement 11 (画像の自動最適化) とその配信経路は実装と単体テストを完了しているが、リポジトリへのマージは保留している。拡張を動作させるには `aramakisai-infra` 側の Deployment 変更が必要で、Payload へ移行すれば不要になる配管のため、移行方針が確定するまで投入しない。実装は `payload-cms-migration` の Requirement 6 で同等機能を実現する際の参照とする。

マージしたのは Requirement 1〜8 および 13 に対応するスキーマ定義 (`directus/schema/snapshot.yaml`) のみで、2026-08-27 に prod / staging へ適用済み。

## Requirements

### Requirement 1: 団体名と企画名の分離
**Objective:** 学生団体担当者として、団体名と企画名を別々に登録したい。そうすることで、来場者に「どの団体がどの企画を出しているか」を正しく伝えられる。

#### Acceptance Criteria
1. The Directus schema shall `student_exhibitions` に必須の団体名フィールド `organization_name` (`type: string`, 日本語表示名「団体名」) を持たせる。
2. The Directus schema shall 既存の `name` フィールドを企画名として維持し、note に「企画名 (団体名は organization_name を参照)」を設定する。
3. When 学生団体担当者が新規レコードを作成し `organization_name` を空のまま保存しようとした場合, the Directus API shall バリデーションエラーを返し保存を拒否する。

### Requirement 2: 未使用 `slug` カラムの削除
**Objective:** スキーマ管理者として、使われていない `slug` カラムを削除したい。そうすることで、編集画面のノイズと将来の誤用を無くせる。

#### Acceptance Criteria
1. The Directus schema shall `student_exhibitions.slug` フィールドを定義から削除する。
2. When `directus schema apply` が実行された場合, the Directus service shall `student_exhibitions` テーブルから `slug` カラムを物理削除する。
3. The RBAC migration shall 削除後の `slug` を student_exhibitor の編集可能フィールド一覧から除外する。

### Requirement 3: カテゴリの複数選択化と文言是正
**Objective:** 学生団体担当者として、企画の分類を実態に合った文言で最大2つまで選びたい。そうすることで、展示と出店を兼ねる企画も正しく分類できる。

#### Acceptance Criteria
1. The Directus schema shall `category` を `type: json` (`special: [cast-json]`, `interface: select-multiple-dropdown`) の配列フィールドとして定義する。
2. The Directus schema shall `category` の選択肢 value を `stage` / `exhibit` / `vendor` / `other` のまま変更せず、表示テキストのみ「出展」→「展示」、「模擬店」→「出店」に変更する。
3. The Directus schema shall `category` の `default_value` を `["other"]` とする。
4. The Directus schema shall 「最大2つまで」の上限を note に明記する。
5. The Directus schema shall `category` の note から「表示分類 (掲載判定とは独立)」の説明を削除する。

### Requirement 4: リンク・SNS アカウントの登録
**Objective:** 学生団体担当者として、団体の SNS や外部サイトの URL を登録したい。そうすることで、来場者を自団体の情報発信先へ誘導できる。

#### Acceptance Criteria
1. The Directus schema shall `student_exhibitions` に `links` フィールド (`type: json`, `interface: list`, `{label, url}` の繰り返し) を追加する。
2. The Directus schema shall `links` を `festival_meta.sns_links` と同一のフィールド構成パターンで定義する。
3. The RBAC migration shall `links` を student_exhibitor の編集可能フィールドに含める。

### Requirement 5: ステージ出演枠の逆参照
**Objective:** 学生団体担当者として、自企画の編集画面からステージ出演枠を確認したい。そうすることで、`category` に `stage` を選んだ企画の出演情報を一箇所で確認できる。

#### Acceptance Criteria
1. The Directus schema shall `student_exhibitions` に `performance_slots` フィールド (`type: alias`, `special: [o2m]`, `interface: list-o2m`) を追加する。
2. The Directus schema shall `performance_slots.exhibition_id` relation の `one_field` を `performance_slots` に設定する。
3. The Directus schema shall `performance_slots` フィールドを `category` の値に依存しない常時表示とする。
4. While student_exhibitor が自企画を編集する場合, the Directus API shall `performance_slots` を read のみ許可する (出演枠の割当は executive が行う)。

### Requirement 6: 会場情報フィールドの常時表示
**Objective:** 実行委員として、区画・ブース情報を分類に関係なく編集したい。そうすることで、カテゴリ選択によって入力欄が消える混乱を無くせる。

#### Acceptance Criteria
1. The Directus schema shall `area_id` / `booth_number` / `booth_label` の `conditions` を `null` にし、常時表示にする。
2. The Directus schema shall 上記3フィールドの note に用途ヒントを記載する。

### Requirement 7: 複数画像の登録
**Objective:** 学生団体担当者として、企画の写真を複数枚登録したい。そうすることで、企画の様子を十分に伝えられる。

#### Acceptance Criteria
1. The Directus schema shall 単一 uuid フィールド `image` を削除し、`images` (`type: alias`, `special: [files]`, `interface: files`) に置き換える。
2. The Directus schema shall junction collection `student_exhibitions_files` (`id` / `student_exhibitions_id` / `directus_files_id` / `sort`) を `topics_files` と同型で新設する。
3. The Directus schema shall `student_exhibitions_files` の2本の relation に `on_delete: CASCADE` を設定する。
4. When 学生企画レコードが削除された場合, the Directus service shall 対応する `student_exhibitions_files` の行を連鎖削除する。
5. The Directus schema shall 「1団体あたり最大5枚」の上限を `images` の note に明記する (UI 強制はしない)。

### Requirement 8: コレクション表示名の変更
**Objective:** 実行委員として、管理画面上の表示名を「学生企画」にしたい。そうすることで、団体単位ではなく企画単位のレコードであることが伝わる。

#### Acceptance Criteria
1. The Directus schema shall `student_exhibitions` の `meta.translations` の日本語表示名を「学生団体」から「学生企画」に変更する。
2. The Directus schema shall collection 名・テーブル名 `student_exhibitions` を変更しない。

### Requirement 9: 学生団体担当者の編集可能フィールドの是正
**Objective:** 学生団体担当者として、自企画の必要な項目をすべて編集したい。そうすることで、実行委員に依頼せず自分で情報を更新できる。

#### Acceptance Criteria
1. The RBAC migration shall student_exhibitor policy の `student_exhibitions` create/update の `fields` を `name,organization_name,category,description,links,images,status` に更新する。
2. The RBAC migration shall 現行スキーマに存在しないフィールド (`slug` / `content`) を `fields` から除去する。
3. While student_exhibitor が `student_exhibitions` を update する場合, the Directus API shall `user_created` が自分と一致するレコードのみ更新を許可する。
4. While student_exhibitor が `student_exhibitions` を read する場合, the Directus API shall `status` が `published` のレコードに加えて、`user_created` が自分と一致するレコードを対象とする。
5. When student_exhibitor が `status: draft` の自レコードを開いた場合, the Directus App shall そのレコードを表示し編集を継続できる状態にする。

### Requirement 10: 画像アップロードの制限
**Objective:** 実行委員として、学生団体担当者のアップロードを画像のみ・サイズ上限付き・自分に関係するファイルのみに制限したい。そうすることで、ストレージ濫用と他団体の画像の閲覧・流用を防げる。

#### Acceptance Criteria
1. If student_exhibitor が許可外の MIME タイプ (`image/jpeg` / `image/png` / `image/webp` 以外) をアップロードしようとした場合, the Directus API shall validation エラーを返し拒否する。
2. The MIME whitelist shall `image/gif` を含めない (アニメーション GIF は変換コストとメモリ消費が大きく、掲載画像として不要なため)。
3. When ファイルサイズの上限を強制する場合, the Directus Deployment shall `FILES_MAX_UPLOAD_SIZE` を `50mb` に設定することで実現する (`directus_permissions.validation` の `filesize` 条件は書き込み後にしか値が確定せず機能せず、hook からもアップロードを拒否できないため)。infra 側で適用済み (`55b3ea0`)。
4. The change set shall 画像に対する個別のサイズ上限を設けない。MIME を画像 3 種に限定した上で、Requirement 11 の 2000px 縮小・WebP 変換が保存サイズを実質的に抑える。
5. The change set shall Content-Type 別のサイズ上限を実装しない (`FILES_MAX_UPLOAD_SIZE` は種別を区別せず、action hook はアップロードを拒否できないため)。
6. While `FILES_MAX_UPLOAD_SIZE` が全ロール共通の制限である場合, the change set shall executive の PDF 添付 (`announcements.attachments` 等) が通る値として `50mb` を選ぶ。
7. While student_exhibitor が `directus_files` を read する場合, the Directus API shall `uploaded_by` が自分と一致するファイル、または `student_exhibitions_files` 経由で自分の学生企画レコードに紐づくファイルのみを対象とする。
8. While student_exhibitor が `directus_files` を update / delete する場合, the Directus API shall `uploaded_by` が自分と一致するファイルのみを対象とする。
9. The RBAC migration shall `student_exhibitions_files` に executive の全 CRUD 権限を付与する。
10. While student_exhibitor が `student_exhibitions_files` を操作する場合, the Directus API shall `student_exhibitions_id.user_created` が自分と一致する行のみ CRUD を許可する。

### Requirement 11: 画像の自動最適化
**Objective:** 実行委員として、掲載画像をアップロード時に1回だけ縮小・軽量化したい。そうすることで、担当者にリサイズ作業を強いることなく、配信のたびの変換コストも通信量も抑えてロード時間を短縮できる。

#### Acceptance Criteria
1. When 画像ファイルがアップロードされた場合, the Directus extension shall 長辺が上限 (既定 2000px) を超える画像を、アスペクト比を保ったまま上限内に縮小する。
2. When 画像ファイルがアップロードされた場合, the Directus extension shall 元の形式 (JPEG / PNG / WebP) に依らず WebP (既定 quality 82) に変換して保存する。
3. When WebP へ変換された場合, the Directus service shall `type` を `image/webp` に、`filename_disk` / `filename_download` の拡張子を `.webp` に更新し、変換前のオブジェクトをストレージから削除する (孤児ファイルを残さない)。
4. When 最適化が適用された場合, the Directus service shall `filesize` / `width` / `height` のメタデータを保存後の実データと一致させる。
5. If アップロードされたファイルが画像でない場合, the Directus extension shall 変換を行わずそのまま保存する。
6. If 変換処理が失敗した場合, the Directus extension shall 元ファイルの保存を継続し、エラーをログに記録する (アップロード自体は失敗させない)。
7. The Directus extension shall ロールに依らず全アップロードに適用される (executive / student_exhibitor 共通)。
8. The change set shall 最適化をアップロード時に1回だけ実行し、同一画像の配信ごとに Directus 側で変換処理が発生しない状態にする。
9. When 画像が要求された場合, the Directus service shall 変換処理を挟まず、縮小・WebP 化済みの実体をそのまま返す。
10. The change set shall Directus の Storage Asset Presets による配信時変換を使用しない (変換が単一 pod の計算リソースを消費するため、用途別サイズの出し分けは Cloudflare 側で行う)。
11. While 実体の差し替えで `/assets/<id>` の URL が変わらない場合, the frontend shall 画像取得時に `?v=<modified_on>` を付与し、最適化前の実体がキャッシュされたエントリと分離する (Cloudflare の既定キャッシュキーはクエリ文字列を含む)。
12. The Directus extension shall `replicas: 1` / `limits.memory: 512Mi` の本番 pod で、Requirement 10 の上限までの画像を OOM を起こさずに処理できる。
13. The change set shall `ASSETS_TRANSFORM_MAX_CONCURRENT` を既定値 25 から 2〜4 に絞る設定を infra 側の受け入れ条件に含める (単一 pod で並列変換が走ると 512Mi を超えるため)。
14. The change set shall `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION` の値を明示し、その値を超える画像が変換されず原本のまま保存されることを既知の制約として記録する。
15. The change set shall 変換ロジックを `aramakisai-web` 管理下の hook 拡張として保持し、Directus 12.1.1 で動作させる (`directus-extension-image-upload-resizer` は `<=11.12.0` 対応のため、そのままの導入は不可)。
16. The change set shall 標準イメージに同梱の `sharp` を利用し、新規ネイティブ依存を追加しない (解決方法は design で定める)。
17. The change set shall 拡張を `EXTENSIONS_PATH` 直下のフォルダとして配置する (`resolveFsExtensions` は直下のフォルダを列挙し `<folder>/package.json` を読むため、ネストしたディレクトリは検出されない)。
18. The change set shall ConfigMap を `/directus/extensions` にマウントし、`items[].path` で `image-optimize/package.json` と `image-optimize/index.js` を配置する構成を infra 側の受け入れ条件に含める (現在の `/directus/extensions/hooks` マウントでは拡張名が `hooks` となり、複数拡張を配置できないため)。
19. The change set shall `directus-schema-sync.yml` の `paths` / 差分判定 / ConfigMap 生成 / `git add` 対象の 4 箇所すべてに拡張分を追加する。
20. When ローカル `docker-compose.yaml` に拡張をマウントする場合, the change set shall 既存の `MIGRATIONS_PATH=/directus/extensions/migrations` と衝突しない構成にする。

### Requirement 12: 学生団体担当者に不要なコレクションの非表示
**Objective:** 学生団体担当者として、自分の作業に関係ないコレクションを管理画面に出したくない。そうすることで、ナビゲーションが自企画の編集導線だけになり誤操作と混乱を防げる。

#### Acceptance Criteria
1. The RBAC migration shall student_exhibitor policy から、自企画の編集に不要なコレクション (`sponsors` / `announcements` / `faq_items` / `topics` / `festival_meta` / `pages` および `page_*` 系シングルトンとその junction) の read 権限を削除する。
2. The RBAC migration shall 自企画の編集に必要なコレクション (`student_exhibitions` / `performance_slots` / `stages` / `time_slots` / `map_areas` / `directus_files` / `directus_folders` / `student_exhibitions_files`) の read 権限を維持する。
3. While student_exhibitor が Directus 管理画面にログインしている場合, the Directus App shall read 権限を削除したコレクションをナビゲーションに表示しない。
4. When student_exhibitor が自企画の編集画面を開いた場合, the Directus App shall `performance_slots` / `area_id` / `images` の関連フィールドを引き続き解決して表示する。
5. The RBAC migration shall フロントエンドが利用する public ロール / 静的トークンの read 権限を変更しない。

### Requirement 13: スキーマ・権限変更の適用と検証
**Objective:** 開発者として、スキーマと RBAC の変更をローカル Directus で検証してから PR に出したい。そうすることで、本番 DB への破壊的変更を安全に反映できる。

#### Acceptance Criteria
1. The change set shall DDL を `directus/schema/snapshot.yaml` のみで表現し、スキーマ用のカスタム migration を追加しない。
2. The change set shall RBAC 変更を `directus/migrations/` 配下の knex migration として追加する。
3. When 新規 migration がローカル Directus に適用された場合, the migration shall 再実行しても同じ最終状態になる (冪等) こと。
4. While 本番の custom migration ランナーが `up()` のみを実行し `directus_custom_migrations` に記録する場合, the change set shall 本番のロールバック手段を「打ち消す新規 migration の追加」と定め、適用済み migration の事後編集に依存しない。
5. When `directus schema apply` 実行後に `directus schema snapshot` を再出力した場合, the output shall リポジトリの `snapshot.yaml` と差分なしで一致する。
6. When 検証環境で student_exhibitor テストユーザーがログインした場合, the verification shall Requirement 9〜12 の制限が実際の挙動として満たされることを確認する。
7. The change set shall 破壊的変更 (`slug` / `image` の削除、`category` の型変更) を、本番未公開かつ `additive-schema-check.yml` 停止中・実データ0件という前提のもとでのみ実施する。
8. Before 破壊的変更を適用する前に, the verification shall prod / staging 双方の `student_exhibitions` の行数が 0 であることを実測で確認する (staging Directus はサスペンドされうるため起動後に確認する)。
9. When `aramakisai-infra` 側の PR を作成する場合, the change set shall PR テンプレートの「破壊的変更は含まれていない」チェックが false になることを明記し、人手での承認理由を記載する。
10. The change set shall `FILES_MAX_UPLOAD_SIZE=50mb` の設定を `aramakisai-infra` 側 Deployment の変更として受け入れ条件に含める。

