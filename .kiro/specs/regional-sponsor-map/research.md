# 地域協賛マップ 技術調査

## 調査方針

- 対象は承認済み `requirements.md` を実現するために必要な既存実装、Figma、公式ドキュメントに限定した。
- 現在の `main`（`098b86a`）を基準に確認し、実装や実データの投入は行っていない。
- 地域協賛マップの最終確定Figmaは読み取り上限に達したため、同じ4画面が収録された公式ホームページのデザインシステムと、取得済みの最終確定Figma情報を照合した。未確認値を推測していない。

## 現行アーキテクチャ

| 領域 | 確認結果 | 設計への影響 |
|---|---|---|
| フロントエンド | Next.js 15、React 19、TypeScript strict、Tailwind CSS 4 | 既存App Router、Server ComponentからClient ComponentへDTOを渡す構成を継続する |
| CMS | Payload CMS 3.88、Next.js 16、PostgreSQL、S3互換メディア | `Sponsors` コレクションへ後方互換な項目を追加し、型生成とmigrationを既存手順で行う |
| 地図 | Leaflet 1.9.4、React Leaflet 5、自前配信WebPタイル | 新しい地図SDKや外部タイル配信は導入しない |
| データ取得 | `frontend/src/lib/cms.ts` の型付きRESTクライアントと60秒キャッシュ | 地域協賛用変換関数も同じResult型・キャッシュ方針を使う |
| テスト | Vitest、Testing Library、Playwright | 純粋関数、コンポーネント、CMS連携、E2Eを既存環境で検証する |

## 既存会場マップの再利用可能範囲

### そのまま再利用

- `MapMenuButton`：サイト共通ナビゲーションを開く操作
- `MapZoomControl`：Leafletの拡大・縮小操作
- `useIsAboveMapBreakpoint`：PCとスマートフォンの表示分岐
- LeafletのSSR回避、出典表記、透過エラータイル、フォーカス可能な地図コンテナという実装パターン
- `frontend/scripts/map-tile-*.ts` と `.github/workflows/generate-map-tiles.yml` の自前タイル生成パイプライン

### 小さく共通化して再利用

- `MapBottomSheet` のドラッグ、スナップ、キーボード、フォーカス、`inert`、`ResizeObserver` の機構を汎用シェルへ抽出する。会場マップ側は薄いラッパーから同じ設定を渡し、既存挙動を保持する。
- `MapViewportSync` の初期範囲、最大範囲、最小ズーム、パネル余白を引数化する。会場マップには現在値を明示して非回帰を固定する。

### 共通化しない

会場マップの検索パネル、エリア一覧、ポリゴン表示は地域協賛のカード・詳細・カテゴリ操作と責務が異なる。無理に共通APIへ統合せず、地域協賛配下で構成する。

## CMSの現状と拡張方針

`cms/src/collections/sponsors.ts` は次を保持している。

- `type`：`ad`、`local`、`vendor`、`other` の複数値
- `name`、`logo`、`url`、`description`、`business_category`、`address`、`tier`
- `orderable: true` による `_order`
- 既存アクセス方針による公開読み取り。地域協賛専用ステータスやdraft承認はない。

既存項目の意味を変更すると広告協賛・出店協賛へ影響するため、`name`、`address`、`description`、`url`、`_order` は再利用し、地図固有項目だけを `local_*` として追加する。既存の `logo` と `business_category` は変更せず、地域協賛マップでは使用しない。

`cms/src/access/policy.ts` では `sponsors` が `PUBLISHED_FILTER` に含まれず、未認証readは全件許可される。CMSには専用stagingもないため、本番へ取り込んだ地域協賛は即時に公開APIの対象となり、フロントエンドの既存60秒キャッシュ後には画面へ反映される。したがって公開制御の追加ではなく、既存のローカル使い捨てDB・本番同等CMSで確認済みの同一bundleだけを、本番dry-run一致後に適用する運用とした。

## 追加確認

### カテゴリコード

外部データで使われる可能性がある `lifestyle` と `vehicle` は、取り込み境界でそれぞれ `life` と `car` へ変換する。CMSとフロントエンドのcanonical codeは従来設計の6値のままとし、既存CMSの他カテゴリ定義へ影響させない。

### メディアID

現行生成型のupload relationは `number | null | Media`、`toMediaId` の戻り値は `string | null`、`toAssetUrl` の引数は `string | null` である。公開DTOの `imageId: string | null` は一致しており、`toMediaId(s.local_image)` による既存変換を再利用すれば型変更は不要である。

## Figma確認結果

基準フレームは次の4つ。

| 状態 | フレーム | 主要寸法・構成 |
|---|---|---|
| PC一覧 | 1440×900 | 左24px、上24px、幅348px、高さ852pxのフローティングパネル。検索、2段カテゴリ、件数、カード一覧 |
| PC詳細 | 1440×900 | 同じ左パネル内で戻る、16:9画像、名称、カテゴリ、メッセージ、基本情報を縦スクロール |
| スマートフォン一覧 | 390×844 | 上部に検索と横スクロールカテゴリ。下部に半展開の一覧ボトムシート |
| スマートフォン詳細 | 390×844 | 上部操作を維持し、詳細用の展開ボトムシート内に戻る、画像、詳細情報 |

確認できた実装上の重要点は次のとおり。

- 検索プレースホルダーは「店舗名・カテゴリ・住所で検索」。
- 一覧画像は80px正方形、詳細画像領域は16:9で、いずれも画像全体を収める。
- PCカード幅は300px、スマートフォンカード幅は358px。
- PC用ピンは48px、スマートフォン用ピンは32px。
- メニューとズームは会場マップ共通部品を使用する意図が明示されている。
- カテゴリ操作は複数選択で、「すべて」は個別選択なしを表す。

既存Tailwind設定から確認した正式色は次のとおり。

| カテゴリ | トークン | HEX |
|---|---|---|
| 病院 | `bansai-rose` | `#e0666d` |
| 生活 | `bansai-olive` | `#c9bf86` |
| 車 | `bansai-aqua` | `#a2c2c6` |
| 教育 | `bansai-wisteria` | `#d2c6da` |
| 飲食 | `bansai-ochre` | `#e4ab53` |
| ショップ | `bansai-sage` | `#aeb49c` |

## 技術選定

### クラスタリング

新しい依存関係は追加せず、Leafletの `map.project` で各座標を現在ズームの画面座標へ投影し、一定半径のグリッドでまとめる純粋関数を採用する。

- 初期34件程度と将来の増減に対して計算量と実装量が小さい。
- 絞り込み済み配列だけを入力にでき、一覧・件数・クラスタの同期が明確になる。
- 最大ズームでも分離できない同一座標は、一時的な放射状展開で各ピンを選択可能にする。
- 選択中レコードはクラスタ入力から除き、元座標にカテゴリ色の選択ピンとして重ねる。残りのクラスタ件数と合わせて全件を表現する。

### 検索

ブラウザ内の純粋関数で、正式名称、カテゴリ日本語名、住所を `NFKC` 正規化後に小文字化して部分一致させる。カテゴリ内はOR、検索語とはANDで結合する。地図の表示範囲は検索条件にしない。

### 一括取り込み

UTF-8 JSON配列と画像ディレクトリを採用する。CSVパーサーを増やさず、改行を含む提供文、電話番号、URL、`null` を欠損なく表現できるためである。

全件の構造・識別子・値・画像参照を先に検証し、`--apply` 指定時だけPayload Local APIとDB transactionで書き込む。`local_import_id` をupsertキー、画像SHA-256を再利用判定にして再実行を冪等にする。名称や住所では既存行を推測照合しない。

### 地図タイル

会場マップと地域協賛マップを `campus`、`regional` のプロファイルとして分離し、生成コードだけを共有する。公開先を `/map-tiles/` と `/regional-map-tiles/` に分けるため、既存タイルを上書きしない。

地域協賛の正確な境界、native zoom、生成枚数は正式座標を受領後に次の順で確定する。

1. 全座標を検証し、外接矩形と余白を算出する。
2. zoomごとの対象タイル数と推定容量をdry-runで出力する。
3. 読みやすさと容量を実機確認し、プロファイル上限を明示する。
4. 上限超過または未設定時は生成を失敗させる。
5. 生成後、全所在地、境界、出典表記、欠損タイルを検証する。

## 公式ドキュメントで確認した事項

- [Payload Transactions](https://payloadcms.com/docs/database/transactions)：`beginTransaction`、`commitTransaction`、`rollbackTransaction` と `transactionID` の伝播
- [Payload Field Validation](https://payloadcms.com/docs/fields/overview)：`validate` からの値、兄弟フィールド、レコードデータの参照
- [Payload Uploads](https://payloadcms.com/docs/upload/overview)：Local APIでの `filePath` アップロード
- [Payload Local API](https://payloadcms.com/docs/local-api/overview)：スクリプトからのコレクション操作
- [Payload Migrations](https://payloadcms.com/docs/database/migrations)：生成済みmigrationによる本番スキーマ更新
- [Leaflet 1.9.4 Reference](https://leafletjs.com/reference.html)：`fitBounds`、`project`、地図イベント、エラータイルのAPI

## リスクと保留事項

| 項目 | 状態 | Designでの扱い |
|---|---|---|
| 正式な34件の座標と画像 | 未提供 | データモデル、検証、冪等取り込みまで設計し、値は作らない |
| 地域タイルの境界、native zoom、枚数、容量 | 座標依存 | 算出・承認・失敗条件を定義し、具体値は取り込み後に確定する |
| 最終確定Figmaの追加読み取り | 利用上限 | 取得済み情報と公式デザインシステム内の同一4画面を基準にした。推測値は設計に入れていない |
| 同一座標の操作 | Figmaに詳細挙動なし | 要件を満たす最小機構として最大ズーム時の放射状展開を採用する |
| 本番取り込み直後の公開 | `sponsors` に公開statusがなく即時read可能 | ローカル検証済みbundleと本番dry-runの一致を適用前ゲートにする |

上記以外にDesignを止める技術的未確定事項はない。
