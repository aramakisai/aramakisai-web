# Research & Design Decisions

## Summary

- **Feature**: `student-exhibitions-schema-fix`
- **Discovery Scope**: Extension (既存 Directus スキーマ・RBAC の拡張) + Complex Integration (新規 hook 拡張とその配信経路)
- **Key Findings**:
  - `FilesService.uploadOne(stream, data, primaryKey, { emitEvents: false })` の置換モードが、一時ファイル書込 → `<primaryKey>` 前方一致の全オブジェクト削除 → rename → `filesize`/`width`/`height` の再抽出まで一括で行う。孤児ファイル対策と再帰防止を自前で書く必要がない。
  - `AssetsService.getAsset()` は Directus 内部の sharp を使って変換ストリームを返す。拡張から `sharp` を import する必要がなく、pnpm hoist による解決不能問題を回避できる。
  - `files.upload` は action イベントのみ (filter は存在せず、`directus_files` は upload 時に `create`/`update` イベントを発火しない)。よってバイト列の書き換えは「保存後に置換する」しか選択肢がない。
  - `directus_permissions` の filter は `$FOLLOW(<junction>,<field>)` 構文で逆参照をたどれる。`directus_files` にエイリアスフィールドを追加せずに「自企画に紐づくファイル」を表現できる。

## Research Log

### Directus 12 の hook イベントとファイル書き換えの可否

- **Context**: Requirement 11 のアップロード時変換をどのイベントで実装できるかが未確定だった。
- **Sources Consulted**:
  - [Directus Docs: Hooks](https://directus.com/docs/guides/extensions/api-extensions/hooks)
  - 実イメージ `directus/directus:12.1.1` の `@directus/api/dist/services/files.js`
- **Findings**:
  - 登録関数は `filter` / `action` / `init` / `schedule` / `embed`。context は `services` / `database` / `getSchema` / `env` / `logger` / `emitter`。
  - `files.upload` は action のみ。ドキュメントに「`files` collection は upload 時に `create`/`update` イベントを発火しない」と明記されている。
  - `FilesService.uploadOne` は最後に `opts?.emitEvents !== false` の条件で `files.upload` を再発火する。置換時に `{ emitEvents: false }` を渡せば無限ループを防げる。
- **Implications**: 変換は「アップロード完了後に実体を差し替える」後処理として設計する。filter で事前に差し替える案は成立しない。

### `FilesService.uploadOne` の置換モードの挙動

- **Context**: Requirement 11.3 (拡張子更新と変換前オブジェクトの削除) を自前実装すると S3 上に孤児が残るリスクがあった。
- **Sources Consulted**: `@directus/api/dist/services/files.js` (`uploadOne`, 30〜118 行)
- **Findings** (`primaryKey` を渡した置換モード):
  1. `temp_<id><ext>` に書き込む。
  2. `updateOne(primaryKey, payload, { emitEvents: false })` でレコードを更新。
  3. `for await (const filepath of disk.list(String(primaryKey))) await disk.delete(filepath)` — **primary key 前方一致の全オブジェクトを削除**。元ファイル `<uuid>.jpg` も、`AssetsService` が生成した variant `<uuid>__<suffix>.webp` もここで消える。
  4. `disk.move(tempFilenameDisk, payload.filename_disk)` で本来の名前に移動。
  5. `stat()` で `filesize` を取り直し、`extractMetadata()` で `width`/`height`/`type` を再取得して `ItemsService.updateOne(..., { emitEvents: false })`。
  - `filename_disk` は `path.extname(payload.filename_download)` と食い違う場合に `<id><新拡張子>` へ自動的に付け替えられる (55 行)。
- **Implications**: Requirement 11.3・11.4 は `uploadOne` の置換モードに委譲でき、拡張側の実装は「変換ストリームを作って渡す」だけになる。孤児ファイル対策の独自コードは不要。

### `sharp` の解決問題と `AssetsService` による回避

- **Context**: 標準イメージの `sharp` が `/directus/node_modules/.pnpm/node_modules/sharp` にあり、`/directus/extensions` からは通常の import で解決できない (既存 `schema-apply-job.yaml` が `knex` を絶対パス require しているのと同じ問題)。
- **Sources Consulted**: `@directus/api/dist/services/assets.js`, `@directus/api/dist/utils/transformations.js`
- **Findings**:
  - `AssetsService.getAsset(id, { transformationParams }, range?, deferStream?)` が内部で `sharp` を使い、変換済みストリームを返す。
  - `resolvePreset({ transformationParams, acceptFormat }, file)` が受け付けるキー: `format` / `quality` / `width` / `height` / `fit` / `withoutEnlargement` / `focal_point_x` / `focal_point_y` / `transforms`。
  - 変換結果は `<basename><suffix>[.<format>]` という別オブジェクトとしてストレージに書き込まれてから返される (副作用あり)。
  - 変換の前提として `file.width` / `file.height` が必要。どちらかが未設定、または `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION` (既定 `6000`) を超える場合は `IllegalAssetTransformationError` を投げる。
  - `ASSETS_TRANSFORM_MAX_CONCURRENT` (既定 `25`) を超える同時変換は `ServiceUnavailableError`。
- **Implications**:
  - 拡張は `sharp` を一切 import しない。Requirement 11.13 (新規ネイティブ依存を追加しない) を、絶対パス require のような脆い手段を使わずに満たせる。
  - `getAsset` が作る variant は `uploadOne` の前方一致削除で回収されるため、後始末が不要。
  - 長辺 6000px 超の画像は変換されずに例外となる。Requirement 11.6 の「失敗時は元ファイルを保持」で吸収する。

### 拡張の配信経路とローカル開発環境

- **Context**: prod / staging の Deployment に `/directus/extensions` のマウントが存在せず、拡張を配置する経路がなかった。
- **Sources Consulted**: `aramakisai-infra` の `gitops/manifests/{prod,staging}/directus/{deployment,schema-apply-job,migrations-configmap}.yaml`、`directus/docker-compose.yaml`、`@directus/extensions/dist/index.js`
- **Findings**:
  - migrations は `directus-schema-sync.yml` が ConfigMap を生成し、schema-apply Job 側でのみ `/directus/extensions/migrations` にマウントされる。Deployment 本体にはマウントがない。
  - 拡張の識別キーは `directus:extension` (`EXTENSION_PKG_KEY`)。ローカル拡張は `package.json` のこのキーで `type` / `path` / `source` / `host` を宣言する。
  - ConfigMap の `items[].path` はスラッシュを含められるため、`package.json` と `index.js` を 1 つの ConfigMap から `/directus/extensions/image-optimize/` 配下に配置できる。
  - ローカル `docker-compose.yaml` は `MIGRATIONS_PATH=/directus/extensions/migrations` を使う。拡張は `/directus/extensions/image-optimize` にマウントすればパスが衝突しない。
- **Implications**: バンドル不要の素の ESM として拡張を書けば、ビルド成果物のコミットもバンドラも不要で、migrations と同じ「ファイル → ConfigMap → マウント」の形に載せられる。

### `directus_files` に対する関係越しの read 権限

- **Context**: Requirement 10.6 の「自企画に紐づくファイルも read できる」を、`directus_files` にエイリアスフィールドを足さずに表現する必要があった。
- **Sources Consulted**: `@directus/api/dist/permissions/modules/process-ast/lib/extract-fields-from-query.js`
- **Findings**: フィールドパスに `$FOLLOW(<collection>,<field>)` 形式が実装されており、逆参照フィールドが未定義でも junction をたどれる。
- **Implications**: read の `permissions` を `_or` で「`uploaded_by` 一致」と「`$FOLLOW(student_exhibitions_files,directus_files_id)` の先の `student_exhibitions_id.user_created` 一致」の 2 条件にできる。

### 参照拡張の調査

- **Context**: 既存拡張をそのまま導入できるかの判断。
- **Sources Consulted**:
  - [Image Upload Resizer](https://www.dirextensions.com/details/directus-extension-image-upload-resizer/)
  - [Transform Directus Images on Upload](https://www.dirextensions.com/details/directus-extension-transform-image-on-upload/)
- **Findings**:
  - Image Upload Resizer: 対応レンジ `^9.0.0 <=11.12.0`。12.1.1 は対象外。
  - Transform Image on Upload: 対応 `^11.17.4`。`files.upload` action で AssetsService により variant を生成し、サイズが小さい場合のみディスク上のファイルを上書きして `directus_files` のメタデータを更新、イベント発行を無効化して再帰を防ぐ、という構成。
- **Implications**: 後者のアーキテクチャは本設計と一致する。ただし対応バージョン宣言が 11 系のため、そのまま依存せず自前の拡張として保持する (Requirement 11.12)。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A. AssetsService 経由の後処理置換 (採用) | `files.upload` action → `AssetsService.getAsset` で変換ストリーム → `FilesService.uploadOne` の置換モード | sharp を import しない / 孤児削除とメタデータ更新が標準実装に乗る / 追加依存ゼロ | 一度は原本が S3 に書かれる / 変換は 6000px 以下に限られる | 参照拡張と同じ構成 |
| B. `sharp` を絶対パス require する自前変換 | pnpm hoist 配下を `createRequire` で解決 | 変換パラメータを完全に制御できる | イメージ更新でパスが変わると壊れる / 孤児削除を自前実装 | 既存の knex ハックと同型だが脆い |
| C. カスタムイメージに sharp を正規依存として同梱 | infra でイメージをビルド | 解決が堅牢 | 「箱は infra、中身は web」の境界を越える / image build・scan・renovate の新設面 | 却下 |
| D. 配信時変換 (Storage Asset Presets) | Directus の配信時変換に寄せる | 拡張が不要 | 変換計算が単一 pod で発生し Requirement 11 の意図に反する | Requirement 11.10 で明示的に不採用 |

## Design Decisions

### Decision: 変換を `AssetsService` に委譲する

- **Context**: 拡張から `sharp` を解決できない。
- **Alternatives Considered**:
  1. 絶対パス require (Option B)
  2. カスタムイメージ (Option C)
  3. Directus 内部サービスの再利用 (Option A)
- **Selected Approach**: `AssetsService.getAsset(key, { transformationParams: { format: 'webp', quality: 82, width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true } })` で変換ストリームを得る。
- **Rationale**: 追加依存なし、pnpm レイアウト非依存、Directus 本体のバージョン追随に自動で乗る。
- **Trade-offs**: 変換パラメータは `resolvePreset` が解釈できる範囲に限られる。今回必要な縮小・フォーマット変換・品質はすべて表現可能。
- **Follow-up**: `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION` (既定 6000) を超える画像が例外になることを実機で確認する。

### Decision: 置換を `FilesService.uploadOne` の置換モードに委譲する

- **Context**: 拡張子変更に伴う孤児ファイルとメタデータ整合の担保。
- **Alternatives Considered**:
  1. ストレージドライバを直接叩いて上書き + `directus_files` を knex で更新
  2. `uploadOne(stream, data, primaryKey, { emitEvents: false })`
- **Selected Approach**: 2 を採用。
- **Rationale**: primary key 前方一致の全オブジェクト削除・rename・`filesize`/`width`/`height` 再抽出・イベント抑止がすべて標準実装に含まれる。
- **Trade-offs**: 一時ファイル書込のぶん S3 の書込回数が増える。
- **Follow-up**: 置換後に `<uuid>.webp` 以外のオブジェクトが残らないことを実機で確認する。

### Decision: 拡張をバンドルせず素の ESM として配置する

- **Context**: 拡張の配信経路が未整備で、ビルド成果物のコミットは避けたい。
- **Alternatives Considered**:
  1. `@directus/extensions-sdk build` でバンドルし `dist/index.js` をコミット
  2. 依存を持たない素の ESM を `index.js` として配置
- **Selected Approach**: 2 を採用。`package.json` の `directus:extension` で `path` と `source` に同じ `index.js` を指定する。
- **Rationale**: 拡張は Directus から注入される context しか使わないため import が不要。ビルド無しで migrations と同じ「テキストファイル → ConfigMap → マウント」に載る。
- **Trade-offs**: TypeScript の型チェックが効かない。JSDoc で補う。
- **Follow-up**: ConfigMap 化を `directus-schema-sync.yml` に追加する際、`node_modules` を含む未追跡ディレクトリを巻き込まないこと。

### Decision: RBAC の read 範囲を `$FOLLOW` で表現する

- **Context**: executive が代理アップロードした画像を、学生が自企画の編集画面で見られる必要がある。
- **Selected Approach**: `directus_files` の read を `_or: [uploaded_by 一致, $FOLLOW(student_exhibitions_files,directus_files_id) の先の student_exhibitions_id.user_created 一致]` とする。
- **Rationale**: `directus_files` に独自のエイリアスフィールドを足さずに済む。update / delete は `uploaded_by` 一致のみに保つ。
- **Trade-offs**: フィルタが 1 段深くなるぶん、権限評価のクエリコストが上がる。
- **Follow-up**: 学生ユーザーで「他団体の画像が見えないこと」「自企画に紐づく executive の画像が見えること」を実機で確認する。

### 設計後に判明した前提のずれ (2026-08-26)

- **Context**: infra 側 issue #177 が design 生成と並行して着地したため、前提の再確認を行った。
- **Sources Consulted**: `aramakisai-infra` commit `0fca31d`、`@directus/extensions/dist/node.js` (`resolveFsExtensions`)、`@directus/api/dist/emitter.js`、`gitops/manifests/prod/directus/schema-apply-job.yaml`、`20260701C-rbac-roles.js`
- **Findings**:
  - infra は `FILES_MAX_UPLOAD_SIZE=10mb` を適用済み。ConfigMap `directus-extensions` を `/directus/extensions/hooks` に `optional: true` でマウント済み。Cloudflare Image Transformations と `/assets/*` Cache Rule も `terraform/cloudflare_directus_assets.tf` で適用済み。
  - `resolveFsExtensions(root)` は `listFolders(root)` の各フォルダ直下の `package.json` を読むだけ。`/directus/extensions/hooks` にマウントすると拡張名が `hooks` になり、`hooks/<name>/` のネストは検出されない。マウント先を `/directus/extensions` にし `items[].path` でサブディレクトリを作る形へ変更する。
  - `emitAction` は handler を await しない fire-and-forget (`.catch()` でログのみ)。action hook からアップロードを拒否することはできない。Requirement 11.6 は構造的に保証される一方、Content-Type 別のサイズ上限は実装手段が存在しない。
  - 本番の custom migration ランナーは `up()` のみを実行し `directus_custom_migrations` に記録する。`down()` は呼ばれず、適用済みファイルの事後編集も反映されない。
  - `20260701C-rbac-roles.js` の student_exhibitor read は `{ status: { _eq: "published" } }` のみ。下書きを作成した本人が自レコードを読めない既存の不具合があり、Requirement 9 の前提が成立していなかった。
- **Implications**: Requirement 5 は閲覧のみに縮小、Requirement 9 に自分の下書きの read を追加、Requirement 10 は Content-Type 別上限を明示的に非採用、Requirement 11.14 は配置契約を確定、Requirement 13 に本番のロールバック手段を追記した。

### Cloudflare Cache Rule の評価順序とキャッシュ汚染 (実測)

- **Context**: infra の `cloudflare_directus_assets.tf` に `expression = "true"` / `cache = false` の "Bypass AppFlowy APIs" ルールが Directus 用ルールより前に存在し、`/assets/*` が常にバイパスされる懸念があった。
- **Sources Consulted**: [Cache Rules: Order and priority](https://developers.cloudflare.com/cache/how-to/cache-rules/order/)、`https://api.aramakisai.com/assets/<uuid>` への実リクエスト
- **Findings**:
  - Cloudflare は同じ設定を複数のルールが指定した場合に **last matching rule wins** で解決する。先勝ちではない。
  - 実測でも `cf-cache-status` が `MISS` → `HIT` → `HIT` と遷移し、Directus 用ルールがバイパスを上書きしていることを確認した。ルール順序の問題は存在しない。
  - 一方で `/assets/*` の `edge_ttl` は `override_origin` の 2592000 秒 (30 日)。origin の `cache-control` も `public, max-age=2592000`。
  - infra 側のコメントは「差替え時は UUID 自体が変わる想定」と書かれているが、`FilesService.uploadOne` の置換モードは同じ primary key の実体を差し替えるため URL は変わらない。アップロードから置換完了までの窓に GET が入ると、最適化前の原本が最大 30 日エッジに残る。
- **Implications**: フロントエンドは `/assets/<id>?v=<modified_on>` の形で取得し、キャッシュキーを分離する。Cloudflare の既定キャッシュキーはクエリ文字列を含むため、置換後は別エントリになる。API トークンを Directus に渡す purge 実装は採らない。

## Risks & Mitigations

- 長辺 6000px 超の画像は `AssetsService` が変換を拒否する — 拡張側で例外を捕捉して原本を保持し、`logger.warn` に記録する (Requirement 11.6)。将来必要なら `ASSETS_TRANSFORM_IMAGE_MAX_DIMENSION` の引き上げを infra に依頼する。
- prod は `replicas: 1` / `limits.memory: 512Mi`。sharp の変換はストリーム処理だが、大きな画像ではピクセルバッファがメモリを占有する — 実機で 50 MB 相当の画像を変換してメモリ使用量を測定し、必要なら `limits.memory` の引き上げを infra 側 issue に追記する。
- 拡張のマウントが未整備のまま web 側だけマージすると、最適化が無言で行われない状態になる — infra 側 issue (aramakisai/aramakisai-infra#177) の完了を web 側 PR のマージ条件とする。
- `category` の型変更 (`string` → `json`) が `schema apply` でどう処理されるかは未検証 — prod / staging 双方で行数 0 を実測してから適用する (Requirement 13.7)。
- MIME ホワイトリストはクライアント申告の Content-Type のみを見る。任意のバイト列を `image/png` と申告して投入でき、変換失敗により原本が残る — 悪意ある投入に対する防御とは位置づけず、ロール付与の運用で担保する。
- `/assets/*` のエッジキャッシュ (30 日) が有効で、置換では URL が変わらないため最適化前の原本が残りうる — フロントエンドが `?v=<modified_on>` を付与してキャッシュキーを分離する。
- `directus_permissions` を直接書き換える migration はキャッシュに反映されないことがある — infra 側の `restart-rbac.yaml` による rollout restart で解消する既存フローに乗せる。

## References

- [Directus Docs: Hooks](https://directus.com/docs/guides/extensions/api-extensions/hooks) — hook の登録関数とイベント種別、context の内容
- [Directus Docs: Services](https://directus.com/docs/guides/extensions/api-extensions/services) — 拡張から内部サービスを使う方法
- [Directus Docs: Transform Files](https://directus.com/docs/guides/files/transform) — 変換パラメータの一覧
- [Transform Directus Images on Upload](https://www.dirextensions.com/details/directus-extension-transform-image-on-upload/) — 同種拡張の構成 (対応 `^11.17.4`)
- [Image Upload Resizer](https://www.dirextensions.com/details/directus-extension-image-upload-resizer/) — 参照実装 (対応 `^9.0.0 <=11.12.0`、12 系は対象外)
- 実イメージ `directus/directus:12.1.1` の `@directus/api/dist/services/{files,assets}.js`, `@directus/api/dist/utils/transformations.js`, `@directus/env/dist/index.js`

## スパイク結果: Directus 12 の custom permission rule はライセンス機能

`$FOLLOW` フィルタが権限評価で機能するかを検証したところ、より上位の制約が判明した。
**Directus 12.1.1 の無償ライセンス (CORE_LICENSE) では、行レベルフィルタ・フィールド制限・
validation を持つ権限行が権限評価から黙って除外される。**

### 実装上の根拠

`@directus/api` の `PermissionsService.readByQuery` は、
`custom_permission_rules_enabled` の entitlement が無い場合に権限行を絞り込む。

```js
const filteredPermissions = (await super.readByQuery(query, opts))
  .filter((p) => !hasCustomRule(p) || isRecommendedAppPermission(p));
```

`hasCustomRule` は次のいずれかで真になる。

- `fields` が `*` を含まない (フィールド制限)
- `permissions` が空オブジェクトでない (行レベルフィルタ)
- `validation` が空オブジェクトでない (投入値の検証)
- `presets` が空オブジェクトでない

`@directus/license` の `CORE_LICENSE` は `custom_permission_rules_enabled: { default: false }`。
`EntitlementManager.isEntitled` は `override ?? default` を返すだけで、
`LICENSE_KEY` (env または `directus_settings.license_key`) が無ければ常に偽になる。

例外は `@directus/system-data` の `appRecommendedPermissions` と
コレクション・アクション・`fields`・`permissions` が完全一致する行のみ。
このリストは `directus_files` / `directus_users` / `directus_shares` など
システムコレクションだけを対象としており、ユーザー定義コレクションは 1 件も含まない。

### 実測

ローカル (`directus/directus:12.1.1`、`LICENSE_KEY` 未設定) に本スペックの
migration を適用したうえで、`student_exhibitor` ロールのユーザーで確認した。

DB 上には 16 行の権限が存在するが、Directus が権限評価に用いるのは 6 行のみ。
除外されたのは以下。

| collection | action | 除外理由 |
|---|---|---|
| `student_exhibitions` | create / update | `fields` がフィールド制限 |
| `student_exhibitions` | read | `permissions` に `_or` フィルタ |
| `directus_files` | create | `validation` に MIME 制限 |
| `directus_files` | read | `permissions` に `$FOLLOW` フィルタ |
| `directus_files` | update | `fields`/`permissions` が推奨形と不一致 |
| `student_exhibitions_files` | create / read / update / delete | `permissions` に自レコード条件 |

残った 6 行は `map_areas` / `time_slots` / `stages` / `performance_slots` /
`directus_folders` の無条件 read と、`directus_files` の delete
(`appRecommendedPermissions` と完全一致するため通過) のみ。

結果として `student_exhibitor` ユーザーは `GET /items/student_exhibitions` で 403 を受ける。
`$FOLLOW` が機能するかどうか以前に、権限行そのものが評価対象に載らない。

### 本スペックへの影響

- Requirement 9 / 10 / 12 のうち、**行レベルフィルタとフィールド制限に依存する部分は
  現行のライセンス構成では実現できない**。
- 縮退案として design.md が挙げていた「自分がアップロードしたファイルのみ read」も、
  `directus_files` read を `uploaded_by` で絞る形は `appRecommendedPermissions` と
  一致しないため同様に除外される。縮退先が存在しない。
- 既存の `20260701C` / `20260712A` / `20260713B` / `20260814A` が入れた
  フィルタ付き権限も同じ理由で本番・ステージングで無効になっている。
  `student_exhibitor` ロールは Directus 12 移行後、一度も意図どおりに機能していない。
- 削除のみで完結する Requirement 12 (`20260826D`) は、権限行を消すだけなので影響を受けない。

### 選択肢

1. Directus の有償ライセンス (`LICENSE_KEY`) を導入し、設計をそのまま適用する。
2. Directus 11 系に据え置く。11 系にはこのライセンスゲートが無い。
3. 学生の自己編集を Directus の RBAC で実現することを断念し、
   専用の API 拡張または別 CMS に移す。

## 実測: 本番・ステージングの `student_exhibitions` 行数

| 環境 | 行数 | 内容 |
|---|---|---|
| prod | 0 | — |
| staging | 0 | — |

初回計測時、prod に動作確認用のテストレコードが 1 行残っていた
(`id=1` / `status=draft` / `name=test` / `slug=test` / `category=other` / `image=NULL`)。
これを残したままでは破壊的変更が適用できないため削除済み。

- `organization_name` は `NOT NULL` かつ既定値なしで新設するため、既存行があると `ALTER TABLE` が失敗する。
- `category` の `character varying` → `json` の型変更は、既存値 `other` が JSON として不正なためキャストに失敗する。

両環境とも 0 件であり、破壊的変更 (カラム削除・型変更) を実施してよい前提が成立している。

## 判断: RBAC は本スペックのスコープから外す

上記のライセンス制約を受け、Directus の RBAC で学生の自己編集を実現する方針を取り下げ、
Payload への移行検討を前倒しする判断とした。

本スペックが Directus に入れるのは以下の 3 つに限る。

- `student_exhibitions` のスキーマ刷新と `student_exhibitions_files` の新設
- アップロード画像の最適化 hook (`directus/extensions/image-optimize`)
- 拡張の配信経路 (`directus-schema-sync.yml` → infra の ConfigMap)

Requirement 9 / 10 / 12 (編集可能フィールド・ファイル可視範囲・コレクション可視範囲) は未着手のまま残す。
一度書き上げた 4 本の migration (`20260826A`〜`20260826D`) はリポジトリに含めない。
有償ライセンス下では設計どおりに動く実装だが、無償ライセンス下では
`20260826A` / `B` / `C` が無効化される一方で `20260826D` の read 権限削除だけが効いてしまい、
学生ロールが何も得ないまま参照範囲だけ狭まるため。
