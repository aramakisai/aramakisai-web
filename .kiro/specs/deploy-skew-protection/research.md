# Research & Design Decisions

## Summary
- **Feature**: `deploy-skew-protection`
- **Discovery Scope**: Complex Integration (Next.js クライアントの挙動・Workers static assets・Cloudflare Access・CI デプロイ手順にまたがる)
- **Key Findings**:
  - Next.js 16.4.2 は、旧クライアントからの RSC 遷移で buildId の不一致を検知し、フルリロードする。そのため旧タブで壊れるのは、遷移を伴わない遅延チャンクと CSS の取得だけになる。
  - `_next/static` のファイル名は内容のハッシュで決まる。世代の和集合を取っても、同じ名前で中身が違うファイルの衝突は起きない。旧ビルドの `_next/static` を新しいデプロイに同梱すれば、旧タブの 404 を塞げる。Worker の実行経路は変わらない。
  - OpenNext の skew protection(旧版の Worker への中継)は、互換性フラグ・Service Token・PR プレビューの Worker の分離を足せば動くことを実測した。しかし旧ビルドを最大 7 日動かし続けることになり、次の問題がある。いずれもユーザーの条件(本番でエラーが出ない・開発体験が変わらない・通信量とレスポンスタイムが増えない)に照らして採らない。
    - 修正が旧タブに届かない
    - ISR のデータが旧版で更新されない
    - D1 のスキーマに後方互換の制約がかかる
    - 中継で遅延が増える
    - PR プレビューの URL の形式が変わる

## Research Log

### Next.js 16.4.2 の旧クライアント・新サーバーでの挙動
- **Context**: 旧タブのページ遷移で何が起きるかを知りたい。旧版の Worker まで要るのか、アセットだけで足りるのかがこれで決まる。
- **Sources Consulted**: `frontend/node_modules/next/dist/client/components/router-reducer/fetch-server-response.js:139-165`、`client/app-index.js:249-252`、`server/app-render/app-render.js:188-193`、`build/index.js:443-449`、`client/components/segment-cache/cache.js:1257-1261`、`build/define-env.js:81`
- **Findings**:
  - RSC 応答の buildId(Flight ペイロードの `b`)がクライアントの保持値と違えば、`doMpaNavigation` でフルリロードする。`deploymentId` を設定していなくても効く。buildId はビルドごとのランダム値。
  - プリフェッチでも、buildId が一致しないエントリは捨てる。
  - `ChunkLoadError` を処理するコードは、既定では存在しない。`experimental.appNavFailHandling` は既定で無効で、しかも遷移中のエラーしか扱わない。
  - `deploymentId` だけを設定すると buildId が固定値になり、`_next/static/<buildId>/` が世代間で衝突する。
- **Implications**: `deploymentId` は設定しない。遷移はフルリロードで最新ビルドへ移る(Requirement 1.2)。旧タブを救うのに要るのは、`_next/static` の旧ファイルの配信と、取得に失敗したときの自動再読み込みの 2 つ。

### `_next/static` のファイル名の不変性と量
- **Context**: 旧世代のファイルを同じディレクトリへ合成してよいかを確かめる。
- **Sources Consulted**: `next/dist/build/webpack-config.js:1029,1039,1049-1050,1879`、`build/webpack/config/blocks/css/index.js:532-533`、`frontend/.open-next/assets`(2026-10-13 時点の旧ビルド)
- **Findings**:
  - chunks と css のファイル名には内容のハッシュが付く。media のファイル名は `[name].[hash:8]`。
  - `_next/static` は約 1,060 ファイル・約 20MB。そのうち media(フォントのサブセット)が 995 ファイル・18MB を占める。世代ごとに変わるのは、主に chunks と css の約 60 ファイル・約 2MB。
- **Implications**: 世代の和集合を取っても衝突は起きない。同じ名前のファイルは現世代を優先し、旧世代からは足りない分だけを補う。

### Workers static assets の制約と応答
- **Sources Consulted**: https://developers.cloudflare.com/workers/platform/limits/(Static Assets)、https://developers.cloudflare.com/workers/static-assets/direct-upload/、aramakisai.com での実測
- **Findings**:
  - 1 版あたりのファイル数は Free で 20,000、Paid で 100,000。1 ファイルあたりのサイズは 25MiB まで。
  - アップロード時にハッシュで重複を除くので、既にあるファイルは再送しない。アセットの保存と配信は無料。
  - 静的アセットは、クエリ付きのパスでも 200 で返る(実測)。
- **Implications**: 20 世代を同梱すると約 2,500 + 60×20 ≒ 3,700 ファイル(試算上)になり、上限に収まる。閲覧時の経路は導入前と同じで、静的アセットとして配信される。

### 旧ビルドの保管先
- **Sources Consulted**: `frontend/wrangler.toml`(R2 `aramakisai-web-cache`)、`.github/workflows/frontend-ci.yml:26-28,374-540`、`wrangler r2 object get --remote` の実測(prod と staging の両方のトークン)
- **Findings**:
  - R2 バケット `aramakisai-web-cache` は、prod・dev・PR プレビューで共有している。OpenNext のキャッシュ投入は、REST API ではなく一時 Worker の R2 binding を経由して書く(`@opennextjs/cloudflare/dist/cli/commands/populate-cache.js:125-135`)。そのため、CI のトークンで REST API から書き込めるかどうかの根拠にはならない。
  - REST API(`wrangler r2 object put/get/delete --remote`)で、キー `static-archive/_probe-<env>` に対して put → get → delete を実測した。prod と staging の両方のトークンで、すべて成功した。削除後の get は「does not exist」になった。
  - バケットの lifecycle ルールは「未完了マルチパートを 7 日で中止」の 1 件だけ。`static-archive/` が自動で消されることはない。
  - prod と staging のどちらのトークンでも、存在しないキーへの get は「The specified key does not exist.」を返した。認証エラーにはならないので、読み取りの権限はある。
  - CI の concurrency は `frontend-ci-${{ github.ref }}` で、push では実行中のものを中断しない。そのため、同じブランチのデプロイは直列に走る。
  - GitHub Actions の cache は 7 日アクセスが無いと退避される。artifact を使うには、前回の run を特定する必要がある。
- **Implications**: R2 の専用プレフィックス `static-archive/<target>/` に、世代ごとの tar と索引を置く。索引の更新はブランチ単位で直列なので、競合の制御は要らない。

### 却下した方式: OpenNext skew protection(旧版の Worker への中継)の検証結果
- **Context**: 旧タブがページ全体を読み込み直さずに遷移できる方式として検討し、実測した。
- **Sources Consulted**: `@opennextjs/cloudflare` 1.20.13 の `dist/cli/templates/skew-protection.js`、`dist/cli/commands/skew-protection.js`、`dist/api/overrides/queue/memory-queue.js:20-33`、`dist/api/overrides/internal.js:12-14`、使い捨ての Worker による実測(すべて削除済み)、`aramakisai-infra/terraform/access.tf`、Cloudflare API で読んだゾーンの設定
- **Findings**:
  - 版プレビュー URL は Access で保護されている。OpenNext の転送部は認証ヘッダを付けられない。
  - Worker から版 URL への fetch は、そのままだと `error code: 1042` になる。`global_fetch_strictly_public` を付けると、Service Token ありで 200、なしで 302 になる。
  - このフラグを付けても、CMS と idp の取得は front door 経由で 5 回とも 200 だった。
  - PR プレビューと本番は同じ Worker に版を積んでいて、どちらの版も `triggered_by=version_upload` なので区別できない。分離が要る。
  - 存在しない Worker への `versions upload` はエラーになる。
  - ISR の再検証は、自己参照の service binding で現行版に届く(`memory-queue.js:21-30`)。一方、キャッシュのキーはビルドごとに分かれている(`internal.js:14`)。そのため、旧版の ISR のキャッシュは更新されない(コードからの判断。実測はしていない)。
- **Implications**: 中継方式にすると次の問題が出る。
  - 旧ビルドが最大 7 日動き続ける。その間、修正が届かず、ISR のデータが古いまま残り、D1 と秘密値の更新に制約がかかる。
  - 中継のぶん遅延が増える。
  - PR プレビューの URL の形式が変わる。

  いずれもユーザーの条件に反する。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A. 旧アセット同梱 | デプロイ前に直近 N 世代の `_next/static` を R2 から取得し、現ビルドに合成してから deploy する | 実行時の経路・Access・PR プレビューに手を入れない。閲覧時の通信量とレスポンスタイムが変わらない | `public/` 由来のファイルの旧版は保持しない。dev と main のデプロイジョブが延びる | 採用 |
| B. OpenNext skew protection と認証付きの自前の中継 | 旧版宛ての要求を、Service Token 付きで版 URL へ中継する | 旧タブが状態を保ったまま遷移できる | 上記の検証結果のとおり | 却下 |
| C. 自動再読み込みのみ | ChunkLoadError が起きたら再読み込みする | 最小 | デプロイのたびに、旧タブで一度エラーと再読み込みが起きる | A の範囲外の後段として併用 |

## Design Decisions

### Decision: 旧アセット同梱方式を採る
- **Context**: ユーザーの条件は、本番でエラーが出ない、開発体験が変わらない、通信量とレスポンスタイムが増えない、の 3 つ。認証は外さない。
- **Selected Approach**: A。CI で旧世代の `_next/static` を合成してから deploy する。
- **Rationale**: Next は遷移時に buildId の不一致を検知してフルリロードする。そのため、旧版の Worker を呼ぶ必要はない。A なら閲覧時の経路が導入前と同じで、PR の CI とローカル開発にも触れない。
- **Trade-offs**: 旧タブは遷移時にフルリロードされ、クライアントの状態(フォームの入力など)は失われる。
- **Follow-up**: dev に 2 回デプロイし、1 回目のタブで旧チャンクが 200 になることを実ブラウザで確認する。

### Decision: 保管先は R2 の専用プレフィックス、単位は 1 世代 = 1 tar
- **Alternatives Considered**:
  1. GitHub Actions の cache — 7 日で退避され、保持が不確実
  2. artifact — 前回 run の特定と `actions: read` の権限が要る
  3. R2 — 既存のバケットと既存の認証情報で読み書きできる
- **Selected Approach**: `aramakisai-web-cache` の `static-archive/<target>/` に、`<gitSha>.tar.gz` と `index.json` を置く。restore は世代の tar を並列(同時 5 本)で取得する。
- **Trade-offs**: 1 世代の tar は約 20MB で、R2 の保存量は target ごとに約 400MB(試算上)。デプロイジョブは数十秒延びる見込み(試算上)。延びるのは dev と main への push のときだけで、PR では走らない。

### Decision: tar の保管は deploy の前、索引の登録はジョブの最後
- **Context**: Requirement 6.4。deploy-prod では、サイトの deploy の後に地震速報リレーのデプロイが続く。リレーの差分は `github.event.before..GITHUB_SHA` で判定している(`frontend-ci.yml:526-554`)。
- **Selected Approach**: tar の put は deploy の前に行う(upload)。索引の更新(publish)はジョブの最後に置き、条件を `!cancelled() && steps.deploy_site.outcome == 'success'` とする。
- **Rationale**: 2 つの抜けを防ぐため。
  - deploy の後に put すると、put が失敗したときに、配信されたのに保管されていないビルドが生じる。ジョブを再実行しても再ビルドになるので、そのビルドは戻らない。
  - publish を deploy の直後に置くと、publish の失敗でリレーのデプロイが飛ばされる。次の push ではその差分を検出できない。
- **Trade-offs**: deploy が失敗した回の tar は、索引に載らずに残る。まれな事象で、同じ sha の再実行で上書きされるので、掃除の仕組みは作らない。

### Decision: 保持世代数は prod と dev で共通の 20
- **Context**: dev は多い日に 1 日 9〜14 回デプロイされる(2026-09-29 と 2026-10-29 の実績)。20 世代で覆えるのは 1.5〜2 日分(試算上)。prod は約 1 か月分(試算上)。
- **Selected Approach**: 共通の `STATIC_ARCHIVE_KEEP: 20`。
- **Rationale**: dev を見るのは実行委員だけで、2 日以上前のタブは自動再読み込みで復帰できる。

### Decision: 合成は現ビルド優先・旧世代は不足分のみ補う
- **Selected Approach**: 展開時に既存のファイルを上書きしない。新しい世代から順に展開する。
- **Rationale**: 現ビルドの成果物を変えないことを、手順として保証できる。`_next/static/<buildId>/` は buildId がランダムなので、世代ごとに別のディレクトリになる。

### Decision: 取得失敗時の自動再読み込みをルートレイアウトのインラインスクリプトで行う
- **Context**: Requirement 2.2、2.3。保持範囲を超えたタブへの後段。
- **Selected Approach**: 既存の `MOTION_INIT_SCRIPT` と同じく、`src/app/layout.tsx` にインラインスクリプトを置く。対象は `/_next/static/` の script・link の読み込み失敗と、`ChunkLoadError` の未処理 rejection。sessionStorage に時刻を残し、30 秒以内の再読み込みは繰り返さない。
- **Rationale**: ルートレイアウトに置けば、`(site)`・`(fullscreen)`・`(staff)` のすべてを覆える。追加の要求も発生しない。layout に書いた要素は、Next が出力するスタイルシートと async の script より後ろに並ぶ(本番の HTML で実測)。そのため、初期読み込みの失敗は対象外とし、hydrate 後の遅延チャンクと CSS の失敗だけを扱う。旧タブで起きる失敗はこちら。
- **再読み込みの回数**: Requirement 2.3(繰り返さない)を満たすため、時間ではなくビルドで区切る。webpack ランタイムの script の URL を sessionStorage に記録し、同じビルドでは 1 回だけにする。時間で区切ると、恒常的に失敗する状態でサイネージ端末が再読み込みを繰り返す。

## Risks & Mitigations
- 保持範囲を超えた旧タブ — 自動再読み込みで最新ビルドへ移す(Requirement 2.2)。
- R2 の一時障害でデプロイが止まる — Requirement 6.3 に従って止め、失敗した操作を出す。再実行で回復する。
- 索引にあるのに tar が欠けている — その世代を飛ばして `::warning::` を出し、次の publish で索引から外す。
- 同梱でファイル数が増える — 20 世代で約 3,700 ファイル(試算上)。Free の上限 20,000 の 2 割以下。

## References
- https://developers.cloudflare.com/workers/platform/limits/ — Static Assets の上限
- https://developers.cloudflare.com/workers/static-assets/direct-upload/ — アップロード時の重複排除
- https://opennext.js.org/cloudflare/howtos/skew — OpenNext skew protection(却下)
- https://developers.cloudflare.com/workers/configuration/compatibility-flags/ — `global_fetch_strictly_public`(却下した方式の検証)
