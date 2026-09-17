# Gap Analysis: payload-cms-migration

## 前提の注意

- requirements.md は `phase: requirements-generated` / 未承認。本分析の結果は要件の改訂に使ってよい。
- 数値はすべて 2026-08-27 時点の prod 実測値であり、推定ではない。計測方法は各項に記載する。
- Payload 側の仕様 (Workers 互換性・画像変換方式・DB アダプタの命名規約) は本分析では確定させず、
  「Research Needed」として design フェーズへ送る。

## 1. 現状調査サマリ

### 既存資産 (実測)

**コンテンツモデルの規模** — `directus/schema/snapshot.yaml` を parse して集計

- 16 collections / 100 fields / 22 relations
- singleton 2 件: `festival_meta` (14 fields), `page_home` (3 fields)
- hidden な中間テーブル 4 件: `announcements_files` / `topics_files` / `page_home_files` / `student_exhibitions_files`
- 最大のコレクションでも `student_exhibitions` の 16 fields。突出して複雑なモデルは存在しない

**本番データ量** — prod Postgres (`directus-db-1`) への `select count(*)`

| コレクション | 行数 |
|---|---|
| `announcements` | 1 |
| `topics` | 1 |
| `pages` | 3 |
| `sponsors` / `faq_items` / `stages` / `time_slots` / `performance_slots` / `map_areas` / `student_exhibitions` | 0 |
| `directus_files` | 9 件 / 合計 56 MB |
| `directus_users` | 4 |
| `directus_roles` | 3 |

本番のコンテンツ実体は **5 行 + 9 ファイル**しかない。1 ファイルあたり平均 6 MB で、画像最適化が未適用のまま配信されている。

**フロントエンドの CMS 依存面**

- `@directus/sdk` の import は 7 ファイル。すべて `frontend/src/lib/` 配下
  (`directus.ts` / `announcements.ts` / `topics.ts` / `home-page.ts` / `festival-meta.ts` / `sns-links.ts` / `static-page.ts`)
- `toAssetUrl` を参照する非テストファイルは 4 件のみ
  (`app/page.tsx` / `components/about-section.tsx` / `components/attachment-gallery.tsx` / `components/topic-card.tsx`)
- ドメイン型は `src/lib/home-page-types.ts` に分離済み。各 `lib/*.ts` が Directus の生レスポンスをドメイン型へ
  map する構造になっており、`src/components/` と `src/app/` は CMS のレスポンス形状を知らない
- FE が実際に読むのは 6 collections + 3 junction のみ。
  `student_exhibitions` / `stages` / `performance_slots` / `map_areas` / `time_slots` / `faq_items` は
  スキーマ上存在するがフロントエンドから 1 箇所も参照されていない

**Directus 固有資産のうち移行で消えるもの**

- `directus/migrations/` は 14 本。うち 12 本が RBAC (`*-rbac-*.js`) で、Payload へ移れば全廃棄対象
- 残る 2 本は CHECK 制約 (`20260701A`) と複合 UNIQUE (`20260701B`)。Payload では別手段で再現が必要

**稼働基盤のリソース** — `kubectl top nodes` / `top pods`

- prod は `prod-node-1` 単一ノード。allocatable = CPU 3800m / メモリ 6958Mi
- 実測 CPU 36% (1372m) / **メモリ 81% (5686Mi)** → 空きは約 1.2 Gi
- Directus 本体の実測消費は 208Mi。上位を占めるのは argocd-application-controller 446Mi、
  authentik-server 387Mi、authentik-worker 328Mi、mailserver 307Mi
- Directus を撤去して得られるのは 208Mi のみ

### 慣習・制約

- FE は Cloudflare Workers + `@opennextjs/cloudflare`。`nodejs_compat` は有効だが Node 専用 API は非推奨
- `wrangler.toml` は `workers_dev = false`、apex ドメインは infra 側 Terraform 管理。
  `[env.dev]` に `dev.aramakisai.com` の常設レビュー環境が定義済み
- 環境変数は `src/env.ts` の zod スキーマ経由のみ。`process.env` 直参照は禁止
- シークレットは Infisical。`.env` / `.env.local` は guard stub で上書き禁止
- テストは対象と同階層の `*.test.ts(x)`、CI ワークフローは `frontend/*.workflow.test.ts`
- design.md には Boundary Commitments (This Spec Owns / Out of Boundary / Allowed Dependencies /
  Revalidation Triggers) を明記する規約

## 2. 要件フィージビリティ分析

| 要件 | 技術ニーズ | ギャップ種別 |
|---|---|---|
| R1: 移行方式の選定と検証 | ホスティング・DB・メディア・認証・移行方式の 5 論点の実証 | **Unknown**: Payload の管理画面が Workers 上で動くかは未検証。R1.2 は「動かない」という結論で終わる可能性が高い (Node ランタイム・`sharp`・Postgres への TCP 接続が前提。prod の CNPG は外部公開されていない) |
| R1.6-1.7: 並行稼働のリソース判定 | ノード空き容量の実測 | **Constraint (実測済み・深刻)**: 空きメモリ 1.2Gi に対し Payload (Next.js + sharp) は 512Mi〜1Gi 規模。Directus 撤去で戻るのは 208Mi のみ。**並行稼働は実質的に成立しない**。R9.6 の段階移行は前提から崩れている |
| R1.8: 期限内完了の判定 | 作業項目と所要期間の見積もり | **Unknown**: 本分析の Effort 見積もり (§4) を入力として design で判定する |
| R2: 出展者の自企画のみ編集 | 行レベル access control | **Missing だが低リスク**: Payload の access control は関数で `where` 句を返す標準機能。ライセンスゲートは無い。移行動機そのものが解消される |
| R3: 実行委員ロールと認証 | 外部 IdP 連携、ロールのコード管理 | **Research Needed**: Payload の認証は標準がローカル (users collection)。Authentik 連携の実装方式 (OAuth プラグイン / 自前 strategy) が未確定。現行 Directus の SSO は 2026-08-27 時点で稼働中だが失効時期が読めない |
| R4: コンテンツモデルの移植 | 16 collections / 100 fields / 22 relations の再定義 | **Missing だが機械的**: 規模が小さく、singleton は Payload の `globals`、`*_files` junction は `upload` の hasMany で置換できる。CHECK 制約と複合 UNIQUE (migration 2 本) は Payload に対応概念が無く、hooks または DB 側で再現が必要 (**Research Needed**) |
| R5: 既存データの移行 | 件数一致・関連解決・冪等性の検証 | **Constraint (実測により要件が過大)**: 移行対象は 5 行 + 9 ファイル。自動移送ツールを作るより手入力で再投入するほうが速く、検証も目視で足りる。R5 の受入基準は現実の規模に合わせて縮小できる |
| R6: メディア移行と配信 | URL 互換 / WebP 変換 / 任意幅リサイズ | **Missing (要追加部品)**: R6.5 の「表示幅を指定して画像を要求」は Directus の `?width=N` 動的変換に依存している。Payload は `imageSizes` の事前生成方式で任意幅を返さない。リダイレクト層か Cloudflare Images 等の追加が必要 (**Research Needed**)。R6.2 の URL 互換も Directus の uuid ベース URL から Payload のファイル名ベース URL への変換が要る |
| R7: FE データ取得層の差し替え | `src/lib/*` の 7 ファイル改修、`@directus/sdk` 削除 | **Missing だが最小リスク**: 依存が `src/lib/` に閉じており、ドメイン型 (`home-page-types.ts`) が既に境界になっている。`src/components/` と `src/app/` は無改修で済む見込み。既存テストがそのまま回帰検証になる |
| R8.1-8.2: prod/staging 稼働と反映 | 2 環境の GitOps | **Constraint**: staging Directus は現状アクティブ PR が無い期間サスペンドされる運用。Payload で同じ運用が成立するか要確認 |
| R8.3-8.4: 破壊的変更の CI 検出 | 型変更・フィールド削除の機械検出 | **Missing (既存の仕組みが停止中)**: `additive-schema-check.yml` は `check` job が `if: false` のまま。再開条件 (custom domain 接続) は `wrangler.toml` の `workers_dev = false` により既に満たされているのに停止が続いている。「Directus 由来の仕組みを Payload へ引き継ぐ」のではなく「止まっている仕組みを作り直す」問題である |
| R8.8: 非開発者の変更手順 | 手順の文書化 | **Constraint (トレードオフ)**: Payload はコンテンツモデル変更に TypeScript 編集とデプロイを伴う。Directus の「管理画面で追加して snapshot を取る」導線は失われる。学生団体の年次交代を踏まえると恒久的な運用コスト増 |
| R9: カットオーバーとロールバック | 停止時間の抑制、Directus 構成への復帰 | **Constraint**: R9.6 の並行稼働はリソース制約 (R1.6) と衝突。データ量が極小 (R5) なので一括カットオーバーの停止時間は短く済む見込み。R9.5 (ロールバック期間中は Directus の DB/メディアを削除しない) はディスクのみの負担で成立する |
| R10: 移行後の検証と Directus 廃止 | Deployment / Job / ConfigMap / migration の削除 | **Missing だが明確**: 廃棄対象は列挙済み (RBAC migration 12 本、`directus-schema-sync.yml`、`additive-schema-check.yml`、`directus/` 配下)。steering 3 ファイルの記述更新も必要 |

### Research Needed

1. Payload の管理画面と API が Cloudflare Workers (`nodejs_compat`) 上で動作するか。動作しない場合の切り分け根拠 (Node API / `sharp` / DB への TCP 接続のどれが阻害要因か)
2. Payload の画像配信で任意幅リサイズを実現する手段。`imageSizes` の事前生成で FE の要求幅を賄えるか、Cloudflare Images 等の外部変換を挟むか
3. Directus の `/assets/<uuid>` 形式 URL を Payload 側 URL へ恒久リダイレクトする層の設置先 (Workers 側 / リバースプロキシ / Payload の hook)
4. Payload における CHECK 制約・複合 UNIQUE の実現手段 (hooks によるバリデーション / DB マイグレーションでの直接定義)
5. Payload と Authentik (OIDC) の連携方式、およびロール定義を Git 管理下のコードとして保つ方法
6. `@payloadcms/db-postgres` が既存 Directus テーブルを引き継げるか (drizzle の命名規約・`_rels` テーブル・`payload_migrations` の前提)。ただし §3 の推奨どおり新規スキーマで作り直すなら本項は不要になる
7. Payload プロセスの実メモリ消費 (admin 有効時 / 無効時)。R1.6 の判定に必要

## 3. 実装アプローチ選択肢

主軸は **Payload をどこで動かすか**。データ量が極小と判明したため、DB 戦略とデータ移行方式は独立した論点ではなくなっている (§3.4 参照)。

### Option A: K8s 上に Payload を独立アプリとして新設し、FE は Workers 据え置き

Payload (Next.js アプリ) を `prod` namespace に Deployment として追加し、FE は現行どおり Workers から REST で参照する。

- ✅ 現行のデプロイ経路 (ArgoCD / Infisical / CNPG) と FE の CI/CD 資産をどちらも維持できる
- ✅ FE 側の改修が `src/lib/` の 7 ファイルに閉じる
- ✅ CDN 配信と Edge Runtime の利点を失わない
- ❌ ノードのメモリ空きが 1.2Gi しかなく、Directus と並行稼働させる余地がほぼ無い
- ❌ Payload の Local API を使えず、FE からは HTTP 越しの参照になる (現行 Directus と同じ構造なので新規の劣化ではない)

### Option B: FE ごと Payload の Next.js アプリへ統合し K8s で運用する

`frontend/` を Payload アプリに取り込み、Workers を廃止して K8s 上の単一 Next.js として運用する。

- ✅ Payload の Local API が使え、CMS 参照が HTTP を経由しない
- ✅ 稼働物が 1 つになり構成が単純化する
- ❌ requirements.md の Out of scope 「Cloudflare Workers 上のフロントエンド配信構成そのものの変更」と正面から衝突する
- ❌ `frontend-ci.yml` の Workers デプロイ資産と CDN 配信を捨てることになる
- ❌ 公開サイトの配信を単一ノードに載せるため、可用性が現行より下がる

### Option C: Workers 上で Payload を動かす

FE と Payload を同一 Worker に同居させる。

- ✅ 現構成との一貫性が最も高く、追加の常駐プロセスが不要でノードのメモリ問題を回避できる
- ❌ Payload は Node ランタイム・`sharp`・Postgres への TCP 接続を前提とする。成立見込みは低い
- ❌ 成立させるには prod の CNPG を外部公開するか、Hyperdrive 等の中継を挟む必要がある
- ❌ R1.2 はこの選択肢の実機検証を要求しているが、**検証が失敗しても Option A へ落とせばよい**という位置づけで扱うべき

### §3.4 データ戦略 (上記と独立)

実測 5 行 + 9 ファイルという規模から、選択肢は事実上 2 つに縮む。

- **推奨: 新規スキーマ + 手入力で再投入** — Payload を空の DB で立ち上げ、コンテンツは管理画面から入力し直す。
  移行スクリプトも件数照合ツールも不要になり、Research Needed 6 が消える。R5 の受入基準はこの前提に合わせて書き直せる
- **既存 Postgres の引き継ぎ** — Payload の drizzle 命名規約に合わせる改造コストが、移行対象 5 行の価値を明確に上回る

ファイル 9 件 56MB は S3 (Hetzner) に既に移行済みのため、バケット自体は再利用できる。

## 4. Effort / Risk

| 作業単位 | Effort | Risk | 根拠 |
|---|---|---|---|
| Payload プロジェクト初期構築 + ホスティング選定 (R1) | M | **High** | Workers 検証と K8s リソース制約の両方が絡む。Option C が失敗する前提で計画すべき |
| コンテンツモデルの移植 (R4) | M | Low | 16 collections / 100 fields / 22 relations は小規模。singleton と junction に既存の対応概念がある |
| 出展者の行レベル access control (R2) | S | Low | Payload の標準機能。移行動機そのものが解消される |
| 認証と実行委員ロール (R3) | M | Medium | Authentik 連携の実装方式が未確定 |
| データ移行 (R5) | S | Low | 5 行 + 9 ファイル。手入力なら実質ゼロ工数 |
| メディア配信の互換維持 (R6) | M | **High** | 任意幅リサイズと URL 互換の両方に Payload 標準では埋まらない差がある。追加部品の設計が要る |
| FE データ取得層の差し替え (R7) | S | Low | 依存が `src/lib/` の 7 ファイルに閉じ、ドメイン型が境界になっている。既存テストが回帰検証を兼ねる |
| GitOps / CI の再構築 (R8) | M | Medium | 破壊的変更検出は Directus 向けの仕組みが停止中で、実質新規開発 |
| カットオーバーとロールバック (R9) | S | Medium | データ量が極小で停止時間は短い。並行稼働を諦める判断が前提 |
| Directus 廃止と steering 更新 (R10) | S | Low | 廃棄対象が列挙済み |

全体では **L (1〜2 週間規模)**、リスクは Payload の Workers 互換性とメディア配信の 2 点に集中する。

## 5. 実装フェーズへの推奨事項

- **ホスティングは Option A を第一候補とし、Option C は「試して駄目なら A」という位置づけで短時間だけ検証する。**
  R1.2 の実機検証に時間を投じすぎない。
- **R9.6 の段階移行 (Directus と Payload の並行稼働) は、リソース実測の結果として design で明示的に却下することを推奨する。**
  空きメモリ 1.2Gi では成立せず、データ量 5 行なら一括カットオーバーの停止時間は数分規模に収まる。
- **R5 の受入基準を実測規模に合わせて縮小することを推奨する。** 自動移送ツールの設計に工数を割く価値がない。
- **最も設計が要るのは R6 (メディア) である。** モデル移植やデータ移行ではなく、
  `?width=N` の動的変換と `/assets/<uuid>` URL の互換をどう埋めるかが本移行の技術的な山場になる。
- **`additive-schema-check.yml` の停止解除は本 spec と独立に判断すべき。** 再開条件は既に満たされており、
  Payload 移行の完了を待つ理由がない。移行期間中に Directus のスキーマを触るなら、なおさら先に戻すべきである。
- **R8.8 (非開発者の運用手段) を design で軽視しないこと。** Payload 移行は権限モデルの問題を解く一方で、
  コンテンツモデル変更の敷居を上げる。学生団体の年次交代を踏まえた運用設計が要る。

## 次のステップ

`/kiro:spec-design payload-cms-migration` で design.md を生成する。
本分析の §3 (ホスティング選択肢)・§5 (推奨事項)・Research Needed を design の入力とする。
