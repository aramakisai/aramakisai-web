# Implementation Plan

- [x] 1. 差分検知ロジックの実行基盤（新規CLIランタイム依存の追加）と、base/head比較に使う共通データ構造の型定義を用意する
  - pnpm install 後、追加したCLIランタイムのバージョン確認コマンドが実行できることを確認する
  - collection一覧、field単位の type/data_type/is_nullable を表す構造、および検出結果（collection削除・field削除・型変更・NOT NULL化）を表す型を定義する。`any`型は使用しない
  - _Requirements: 1.1_

- [x] 2. コア機能: スナップショット読み込み
- [x] 2.1 (P) snapshot.yaml のテキストから、比較に必要な collection一覧と、field単位の type/data_type/is_nullable のみを抽出した構造に変換する処理を実装する。物理カラムを持たないフィールド（schema情報がnullのフィールド）も例外を投げずに扱えるようにする
  - 実際のリポジトリの snapshot.yaml を読み込んでも例外を投げず、collection数・field数が実データと一致する構造を返す
  - _Requirements: 1.1_
  - _Boundary: SnapshotParser_

- [x] 2.2 読み込み処理の単体テストを作成する。schema情報が埋まっているフィールドと、schema情報がnullのフィールドの双方を含むケースを検証する
  - 両ケースを含むテストスイートが通る
  - _Requirements: 1.1_
  - _Boundary: SnapshotParser_

- [ ] 3. コア機能: 破壊的変更の判定
- [ ] 3.1 (P) base側とhead側の構造を (collection, field) 単位で突き合わせ、collectionの削除およびfieldの削除を検出する処理を実装する
  - baseにのみ存在するcollectionまたはfieldを含む入力を渡すと、それぞれ「削除」として検出結果に含まれる
  - _Requirements: 2.1, 2.2, 3.1, 3.2_
  - _Boundary: SchemaDiffer_

- [ ] 3.2 同一 (collection, field) 間での type/data_type の変更、および is_nullable の true→false への変更を検出する処理を実装する。schema情報がnullのフィールドはこの比較から除外し、meta情報のみの変更やcollection/fieldの新規追加は非破壊的変更として扱う
  - type変更・NOT NULL化を含む入力ではそれぞれ検出結果に含まれ、is_nullableがfalse→trueになるケースやmeta情報のみの変更・新規追加のみの入力では検出結果が空になる
  - _Requirements: 4.1, 4.2, 4.3, 5.1, 5.2_
  - _Boundary: SchemaDiffer_
  - _Depends: 3.1_

- [ ] 3.3 判定処理の単体テストを作成する。collection削除・field削除・型変更・NOT NULL化それぞれの検出、is_nullableの逆方向変更が非検出であること、加算のみの変更およびmeta情報のみの変更が非破壊的変更として扱われることを網羅する
  - 上記すべてのシナリオを含むテストスイートが通る
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 4.1, 4.2, 4.3, 5.1, 5.2_
  - _Boundary: SchemaDiffer_
  - _Depends: 3.2_

- [ ] 4. コア機能: 検出結果のレポート出力
- [ ] 4.1 (P) 検出結果を人間が読める形式（breaking changesがあれば一覧表、なければ加算的変更のみである旨の要約）に整形し、成功/失敗を表す終了コードを決定する処理を実装する
  - breaking changesを含む結果を渡すと一覧表形式の文字列と失敗を表す値が得られ、空の結果を渡すと要約文字列と成功を表す値が得られる
  - _Requirements: 6.1, 6.2_
  - _Boundary: ReportFormatter_

- [ ] 4.2 レポート整形処理の単体テストを作成する。一覧表のフォーマットと、加算的変更のみの場合の要約、それぞれに対応する終了コードの妥当性を検証する
  - 両ケースを検証するテストスイートが通る
  - _Requirements: 6.1, 6.2_
  - _Boundary: ReportFormatter_
  - _Depends: 4.1_

- [ ] 5. 統合: CLIエントリポイントの結線
- [ ] 5.1 base/headそれぞれのsnapshotファイルを受け取り、読み込み→判定→レポート整形の順に実行し、実行結果サマリをステップサマリ用の出力先に書き出し、breaking changesの有無に応じたプロセス終了コードを返す処理を実装する。あわせて、snapshotが不正なYAMLの場合は解析エラーとして失敗扱いにし、PRで新規追加されたためbase側ファイルが存在しない場合は空のスナップショットとして扱う
  - 加算的変更のみのfixtureペアを渡すと終了コード0、破壊的変更を含むfixtureペアを渡すと終了コード1で実行され、いずれの場合もサマリ内容が出力先に書き出される
  - _Requirements: 1.1, 6.1, 6.2_
  - _Depends: 2.1, 3.2, 4.1_

- [ ] 5.2 CLI処理のエラーハンドリングに関するテストを作成する。不正なYAMLを渡した場合に失敗として扱われること、base側ファイルが存在しない場合に加算のみの入力として扱われることを検証する
  - 両ケースを検証するテストが通る
  - _Requirements: 1.1, 6.2_
  - _Depends: 5.1_

- [ ] 6. 統合: PRトリガーのワークフロー
- [ ] 6.1 snapshot.yamlの変更を含むpull requestで実行されるワークフローのトリガー設定（作成・更新・再オープン時のみ、対象パスをsnapshot.yamlに限定）と、必要最小限の権限設定を行う
  - pull_requestイベントかつsnapshot.yaml変更時にのみワークフローが起動する設定になっている
  - _Requirements: 1.1, 1.3_

- [ ] 6.2 ワークフロー内でbase/head双方のコミット履歴を取得したうえで、base側とhead側それぞれの時点のsnapshot.yaml内容を取り出し、実際にsnapshot.yamlへの差分があるかどうかを判定して後続ステップの実行要否を切り替える処理を実装する
  - snapshot.yamlに変更がないPRでは後続ステップがスキップされ、変更があるPRではbase側・head側それぞれの内容が後続ステップに渡される
  - _Requirements: 1.1, 1.2_
  - _Depends: 6.1_

- [ ] 6.3 取得したbase/headの内容を検査処理に渡して実行し、その終了コードに応じてPRのステータスチェックが成功/失敗になるようワークフローを結線する
  - 破壊的変更を含むPRでステータスチェックが失敗し、加算的変更のみのPRで成功する
  - _Requirements: 1.1, 6.2_
  - _Depends: 5.1, 6.2_

- [ ] 7. 検証: ワークフロー構成テストとE2E確認
- [ ] 7.1 ワークフロー定義のトリガー条件・履歴取得設定・後続ステップのスキップ条件・検査処理への呼び出し引数を検証する構造テストを作成する。あわせて、シークレット参照が存在しないこと（フォークPRでも安全に実行できること）、および承認済みの破壊的変更を自動的に成功へ戻すような迂回条件が存在しないことを検証する
  - 上記すべての観点を検証するテストスイートが通る
  - _Requirements: 1.1, 1.2, 1.3, 6.2, 6.3_
  - _Depends: 6.3_

- [ ] 7.2 加算的変更のみのケースと破壊的変更を含むケースそれぞれのfixtureペアを使って、検査処理をエンドツーエンドで実行し、検出結果一覧・レポート内容・終了コードが要件どおりになることを確認する
  - 加算的変更のみのケースで成功・要約表示、破壊的変更を含むケースで失敗・検出内容の一覧表示という2つの結果が実際に確認できる
  - _Requirements: 5.1, 6.1, 6.2, 6.3_
  - _Depends: 7.1_
