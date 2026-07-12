# Gap Analysis: page-home-friendly-editing

## 1. 現状調査サマリ

### 既存資産

- **`page_home` (現行)**: `directus/schema/snapshot.yaml` 上で `blocks` フィールド1つ(型 json, interface: `input-code`)のみを持つ。`singleton: true`。frontend側は `frontend/src/app/page.tsx` が `<main>荒牧祭</main>` のみの静的実装で、`page_home` を一切参照していない(grep 0件)。移行に伴う後方互換の懸念は無い。
- **`page_access`/`page_contact` (既存の同種固定ページ)**: `content`(interface: `input-rich-text-html`)+ `map_embed_url`/`form_embed_url`(interface: `input`, placeholder付き文字列)という構成が確立済み。命名規則・meta設定(`singleton: true`, `accountability: all`)の踏襲元として使える。
- **`announcements` collection (既存・重要)**: `title`(string) / `body`(text, interface: `input-rich-text-html`) / `published_at`(timestamp, 公開日時管理)を既に持つ非singleton collection。**Req1 AC3が要求する「お知らせの可変ブロック」は、page_home内に新規Repeaterを作らずとも、このcollectionをHome Pageから参照するだけで実質的に満たせる可能性が高い**。
- **`topics` collection (既存・重要)**: `title` / `body`(interface: `input-multiline`) / `image`(file-image) / `link_url` / `sort`(表示順、Directusのドラッグ&ドロップ並び替えに対応)を既に持つ。「トピックスの可変ブロック」も同様に既存collection参照で満たせる可能性が高い。
- **`festival_meta` collection (既存)**: `name`(祭名) / `event_days`(json, interface: `input-code` — これ自体も本specと同種の「生JSON手打ち」問題を抱えているが、Out of scope)。singletonで祭全体のメタ情報を持つ想定通りの置き場所。ユーザーとの合意通り、Req3の切替フラグをここに追加する方針は既存collectionの役割(祭全体メタ情報)と整合する。
- **frontend Directusクライアント**: `frontend/src/lib/directus.ts` の `Schema` 型は `Record<string, never>`(空)。Directusスキーマ型がfrontendに一切反映されていない。`frontend/src/components/` はディレクトリのみで実装ゼロ。HTMLサニタイズ用ライブラリ(`sanitize-html`/`dompurify`等)は `package.json` の依存に存在しない。
- **`directus/migrations/20260701C-rbac-roles.js`**: `executive`/`student_exhibitor` ロールへの権限付与が `ALL_COLLECTIONS`/`PUBLIC_COLLECTIONS` という**ハードコードされた配列**で列挙されており、現在 `page_home`/`page_access`/`page_contact` は含まれる(が `page_privacy`/`page_sponsor_guide` は既存の抜け漏れとして未列挙 — 本spec対象外)。**新規collectionを追加する場合、この配列に追記する追加migrationが無いと、executiveロールでもDirectus管理画面からその collection を操作できない**。
- **`additive-schema-check.yml` / `frontend/scripts/check-additive-schema.ts`**: collection削除・field削除・type変更・`is_nullable: true→false` を機械検出。`page_home.blocks` フィールド削除は確実にこれに引っかかる(Req4が想定する挙動と一致)。
- **`frontend-ci.yml`**: トリガーは `pull_request→main` と `push→main` のみ。**永続的な `dev` ブランチへのデプロイの仕組みは存在しない**(PRごとの一時プレビューURLと本番デプロイの2系統のみ)。
- **`frontend/wrangler.toml`**: `workers_dev = true` のみでカスタムドメインの `routes` 設定は無し。apex(`aramakisai.com`)はフロントエンド移行完了まで意図的に未接続だが、`dev.aramakisai.com` はapexと別サブドメインのため、既存の「apex未接続」制約とは独立に追加可能。
- **`aramakisai-infra/terraform/access.tf`**: `local.access_applications` という map に対して `allow_authentik` ポリシーを `for_each` で自動適用する設計が既に確立している(現状は `aramakisai_web_workers_dev` の1エントリのみ)。**`dev.aramakisai.com` 用の新しい `cloudflare_zero_trust_access_application` をこのmapに追加登録するだけで、既存のAuthentikログインポリシーが自動的に適用される**設計になっており、Req6が求める内容と非常に相性が良い。
- **`aramakisai-infra/terraform/dns.tf`**: `stg-api` 等、`{name}.aramakisai.com → tunnel_cname` のCNAMEレコードパターンが複数確立済み。ただしこれらは全て「Cloudflare Tunnel経由でK8s内サービスへ」向けるパターンであり、`dev.aramakisai.com` は「Cloudflare Workers カスタムドメイン」向けなので、`cloudflare_record` の `value`/`type` は既存パターンと異なる可能性がある(Workers custom domainはCloudflareのWorkers Routes機構経由で、通常は別リソース `cloudflare_workers_custom_domain` 等になりうる。要Research)。
- **クロスリポジトリspec分割の先例**: `aramakisai-web` の既存 `staging-e2e-verification` spec と `aramakisai-infra` の `web-e2e-cloudflare-access-bypass` spec は、CF Access Service Token発行というひとつながりの機能を2つのspecに分割し、Infisical secret名の「契約」で連携する形を取っている。ユーザーが今回「クロスリポジトリでタスクを追いづらい」と指摘した通りの構造であり、本spec(Req6)でこれを避けaramakisai-infra側の変更も一元管理する方針は、この先例で見えた運用コストを踏まえた妥当な判断と言える。

### 慣習・制約

- Directus migrationは冪等性(`onConflict().ignore()`等)を意識する慣習。新規RBAC権限追加もこのパターンに従う必要がある。
- `directus schema snapshot`/`apply` はRBAC(policies/roles/permissions)を表現できないため、2つ目のHome Page collectionを追加する際は「snapshot.yamlへのcollection/field追加」と「RBAC migration追加」の**2つのファイル変更が必ずセットになる**。
- `.kiro/specs/*/design.md` の Boundary Commitments 規約(This Spec Owns / Out of Boundary / Allowed Dependencies / Revalidation Triggers)は `aramakisai-infra` 側の既存specでも使われており、本specがaramakisai-infra側ファイルを扱う場合も同様の明記が期待される。

## 2. 要件フィージビリティ分析

| 要件 | 技術ニーズ | ギャップ種別 |
|---|---|---|
| R1: フォームベース再設計(WYSIWYG/Repeater/ヒーロー画像/SNS/`blocks`廃止) | Directus field定義変更(snapshot.yaml)。お知らせ/トピックスは既存`announcements`/`topics`参照で代替できる可能性 | **Missing**(新規field定義) + **要再検討**(Repeater新設 vs 既存collection再利用) |
| R2: 埋め込みの安全な取り扱い(専用URL field, iframeサンドボックス, WYSIWYG本文へのiframe禁止) | frontend側で`<iframe sandbox>`描画コンポーネント新規実装。WYSIWYG本文のレンダリング方式(dangerouslySetInnerHTML等)とサニタイズ要否 | **Missing**(コンポーネント皆無)。サニタイズライブラリ未導入(**Research Needed**) |
| R3: 2 singleton構成 + festival_meta切替フラグ | 新規Directus collection追加(schema + **RBAC migration追加が必須**)、frontend側でfestival_meta参照→表示分岐 | **Missing** + **Constraint**(RBAC migrationのハードコード配列更新を忘れると新collectionが編集不能になる) |
| R4: additive-only/staging検証フローとの整合 | 既存`additive-schema-check.yml`/staging ephemeral検証フローがそのまま適用可能 | **Constraint確認のみ**(新規実装不要、運用手順の遵守) |
| R5: 既存固定ページとの一貫性 | 命名規則・meta設定パターンの踏襲 | **Constraint**(設計レビューで機械的に確認可能) |
| R6: devレビュー環境(aramakisai-infra側含む) | `wrangler.toml`へのカスタムドメイン設定、`frontend-ci.yml`への新規トリガー/job、`aramakisai-infra`の`dns.tf`/`access.tf`への追加 | **Missing**(永続ブランチデプロイの仕組み自体が存在しない)。Workers custom domainのTerraformリソース種別は要確認(**Research Needed**) |

### Research Needed(設計フェーズへ持ち越し)

1. `announcements`/`topics` を Home Page がどう取得・絞り込むか(件数、フェーズごとの出し分け条件)。Req1のRepeater要求と既存collection再利用のどちらを採るか。
2. WYSIWYG本文(`input-rich-text-html`)のレンダリング方法とサニタイズ方針(ライブラリ追加の要否、追加する場合の選定)。
3. `dev.aramakisai.com` をCloudflare Workersのカスタムドメインとして接続する場合のTerraformリソース(`cloudflare_record` do CNAMEで足りるか、Workers Routes/カスタムドメイン専用リソースが必要か)。
4. devレビュー環境が参照するDirectusバックエンド(staging `stg-api.aramakisai.com` を共用するか専用データが必要か)。Req3 AC6の「本番データと分離」は既存staging環境の共用で満たせるか、専用環境が要るか。
5. 2つ目のHome Page collectionの名称(暫定 `page_home_live` 等)、および `festival_meta` に追加する切替フラグのフィールド名・選択肢値。
6. `dev.aramakisai.com` へのアクセス許可対象(既存 `allow_authentik` ポリシーをそのまま使い全実行委員に許可するか、絞るか)。

## 3. 実装アプローチ選択肢

### R1「お知らせ/トピックス可変ブロック」について

#### Option A: page_home(系)に新規Repeater(interface: list)フィールドを追加
- ✅ Home Page内で完結し、他collectionへの依存がない
- ❌ 既存`announcements`/`topics`と内容が重複しうる(同じお知らせを2箇所で管理する不整合リスク)
- ❌ せっかく既に確立している既存collectionのCRUD体験(サムネイル・添付・並び替え)を再実装することになる

#### Option B: 既存`announcements`/`topics`をHome Page側から参照するのみ(新規Repeaterフィールド無し)
- ✅ 二重管理を避けられる。実行委員は既存の使い慣れたcollectionで運用継続
- ✅ 新規フィールド定義・RBAC追加が不要(既存collectionは既にRBAC対象)
- ❌ Home Page専用の表示順・強調フラグ等が欲しい場合、既存collectionへのフィールド追加(または関連付け)が別途必要になりうる

#### Option C(ハイブリッド, 推奨): ヒーロー画像・SNS・埋め込みURLはpage_home系collection固有フィールドとして新設し、お知らせ/トピックスは既存`announcements`/`topics`参照に倒す
- ✅ 重複管理を避けつつ、Home Page固有の情報(ヒーロー画像等)は素直にpage_home側に持てる
- ❌ 「フェーズごとにどのお知らせ/トピックスを何件表示するか」の絞り込みロジックをfrontend側で設計する必要がある(Research Needed #1)

### R3「2 singleton構成」の具体化について

#### Option A(推奨): 既存`page_home`を「開催前用」としてそのまま存続させ、新規collection(仮`page_home_live`)を1つ追加
- ✅ collection削除を伴わないため、additive-schema-checkの検出対象は既存の`blocks`field削除のみに限定できる(破壊的変更の範囲を最小化)
- ✅ 既存の命名(`page_home`)がそのまま活きる
- ❌ 「開催前用」なのに`page_home`という汎用的な名前のままなのは将来的にやや分かりにくい

#### Option B: 両方を新規collection名(`page_home_pre`/`page_home_live`)にリネームし、既存`page_home`は削除
- ✅ 命名の意味が明確になる
- ❌ **collection削除**という、additive-schema-check上より重い破壊的変更になり、Req4のPRチェックリスト・チーム周知の負担が増す
- ❌ frontend側もfrontend未実装のため実害は無いとはいえ、不要な破壊的変更を増やすメリットが薄い

### R6「devレビュー環境」CI実装について

#### Option A(推奨): 既存`frontend-ci.yml`に`push: branches: [dev]`トリガーと新規`deploy-dev` jobを追加
- ✅ 既存の`deploy-preview`/`deploy-prod` jobとパターンを揃えられ、Infisical連携等のステップをコピー・調整するだけで済む
- ❌ 1ファイルの責務が増え、ワークフローYAMLがさらに肥大化する

#### Option B: 新規`frontend-ci-dev.yml`として分離
- ✅ 既存frontend-ci.ymlに手を入れずに済み、影響範囲が小さい
- ❌ `frontend-ci-dummy.yml`との名前一致による回避策など、既存の複雑な仕組み(必須ステータスチェック名の一致)を新ファイルにも意識する必要が生じ、むしろ管理対象が増える

## 4. Effort / Risk

- **Effort: L(1〜2週間)**
  理由: (1) Directusスキーマ再設計+RBAC migration追加、(2) frontend側の初回Directus連携実装(Schema型・iframeサンドボックス・WYSIWYGレンダリング一式を新規実装)、(3) `aramakisai-infra`側のDNS/Access Terraform追加、(4) CI新規job、の4領域にまたがり、単純CRUDより広い。個々の技術要素は既存パターンの応用で済むものが多いが、範囲が広いためLと判定。
- **Risk: Medium**
  理由: 個々の技術(Directus interface, Terraform Access Application, GitHub Actions job追加)はいずれも社内に確立済みパターンがあり低リスク。一方で (a) RBAC migrationの更新漏れによる「新collectionが編集不能」という気づきにくい落とし穴、(b) Workers custom domainのTerraformリソース種別が未確認、(c) お知らせ/トピックスの二重管理を避ける設計判断、の3点が詰め切れておらず、詳細設計次第でスコープが変動しうるためHighまでは至らずMedium。

## 5. 設計フェーズへの推奨事項

- **推奨アプローチ**:
  - R1は Option C(ハイブリッド): ヒーロー画像・SNS・埋め込みURLはpage_home系固有フィールド、お知らせ/トピックスは既存`announcements`/`topics`参照
  - R3は Option A: 既存`page_home`を開催前用として存続、新規collection1個を追加(collection削除を避け破壊的変更を最小化)
  - R6は Option A: 既存`frontend-ci.yml`拡張でdevブランチデプロイjobを追加
- **設計フェーズで確定すべき事項**(Research Neededの繰り返し):
  1. `announcements`/`topics`のHome Page向け絞り込み条件(フェーズ別件数・フィルタ)
  2. WYSIWYG本文のサニタイズ方針(ライブラリ要否・選定)
  3. `dev.aramakisai.com`接続に必要なTerraformリソース種別の確認(Workers custom domain)
  4. devレビュー環境が使うDirectusバックエンド(staging共用 or 専用)
  5. 新規collection名・`festival_meta`切替フラグのフィールド名/値
  6. `dev.aramakisai.com`のCF Accessアクセス許可範囲(既存`allow_authentik`共用でよいか)
  7. RBAC migration(`20260701C-rbac-roles.js`と同パターンの新規migrationファイル)に新collectionを追記する作業を設計・タスクに明示的に含めること(見落とし防止)

## 次のステップ

`/kiro:spec-design page-home-friendly-editing` で技術設計に進める。上記 Research Needed 項目は設計ドキュメントで明示的に解決すること。
