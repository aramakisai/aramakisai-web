# Requirements Document

## Introduction

公式サイトのデザインを洗練版へ更新する。`full-site-design` で実装済みの画面に対し、書体・文字色・地色、ヒーローの主題語、企画カードと「会場で使う」ボタンの質感、背景図形の生成ルールを差し替える。洗練版の正は Figma (fileKey `0kWDqHsLr6xE8b4FFgR1Zx`) のページ「コンポーネント」の main component・「Foundations」と、ページ「洗練案」の見本 `483:3` (トップ PC)・`483:103` (トップ SP)・`483:204` (お知らせ詳細 PC)。ただし Figma は叩き台であり、背景図形は画面ごとの Figma 上の配置ではなく、本書の生成ルールを実装が満たすことを正とする。

## Boundary Context

- **In scope**: `frontend/` の書体・文字色・地色・見出しの階層、ヒーロー、企画カード、「会場で使う」ボタン、背景図形 (生成ルール・質感・動き)、質感や図形に重なる文字の白い光彩。
- **Out of scope**: CMS のコンテンツモデル、ページの情報構造・導線、カラーパレットのトークン定義の変更、構内マップ (`(fullscreen)/map`) への背景図形の配置、Figma の画面ごとの配置の再現。
- **Adjacent expectations**: FAQ ページ (`faq-page`) は本 spec の書体・色・背景図形の仕組みを共通部品経由で受け取る。モーションのオン・オフは既存の `MotionToggle` とモーションの抑制設定に従う。

## Requirements

### Requirement 1: 書体

**Objective:** As a 来場者, I want サイト全体が 1 つの書体で統一されている, so that 情報が読みやすく印象がまとまる

#### Acceptance Criteria
1. The 公式サイト shall 本文・見出し・ナビゲーション・フッターを含むすべての文字を LINE Seed JP で表示する (アイコンは Material Symbols Sharp のまま)。
2. The 公式サイト shall 見出し (h1〜h4) を LINE Seed JP ExtraBold・字間 2% で表示する。
3. The 公式サイト shall ページの h1 のサイズと行の高さを洗練前と同じに保つ。
4. The 公式サイト shall 本文を行の高さ 180%・字間 2% で表示する。
5. The 公式サイト shall 詳細ページ (お知らせ・トピック・企画) のタイトルを PC 32px / SP 28px で表示し、本文中の h2 (25px) より大きくする。
6. The 公式サイト shall 見出し・タイトルの改行を文節単位で行い、最終行に 1〜2 文字だけが残る折り返しを避ける。
7. While Web フォントの読み込みが完了していない間, the 公式サイト shall 代替書体で本文を表示し、読み込み完了後に LINE Seed JP へ切り替える。

### Requirement 2: 文字色と地色

**Objective:** As a 来場者, I want 見出しやリンクが十分なコントラストで読める, so that 白地でも文字が判読しやすい

#### Acceptance Criteria
1. The 公式サイト shall 見出し・リンク・本文の文字色を `color/text` とし、文字色として `color/primary` を用いない。
2. The 公式サイト shall 補助的な淡い文字 (日付・注記・ラベル等) の文字色を `color/gray-600` とする。
3. The 公式サイト shall ページの地色を白とする。
4. The 公式サイト shall 選択状態・現在地 (ページネーションの現在ページ、絞り込みチップの選択、下部タブナビ・ヘッダーの現在地表示など) の塗り・線に `color/primary` を用いる。

### Requirement 3: ヒーロー

**Objective:** As a 来場者, I want トップページのテーマ語が印象的に見える, so that 祭のテーマが一目で伝わる

#### Acceptance Criteria
1. The ヒーロー shall テーマ語「万彩」を LINE Seed JP Thin で、PC 120px / SP 72px で表示する。
2. The ヒーロー shall テーマ語以外の見出し・開催情報を LINE Seed JP で表示する。

### Requirement 4: 企画カードと「会場で使う」ボタンの質感

**Objective:** As a 来場者, I want カードやボタンが祭の多彩さを感じさせる見た目になっている, so that 一覧を眺めるだけで楽しい

#### Acceptance Criteria
1. The 企画カード shall 企画名を種とした決定的乱数で決めた 1 色に、4 質感 (グラデーション / 水彩 / ザラザラしたグラデーション / 網目) のいずれかを重ねた背景を持つ。
2. The 企画カード shall 同じ企画名に対して常に同じ色・質感を表示する。
3. The 「会場で使う」ボタン shall 用途ごとに 1 色 + 質感の背景を持ち、枠線を持たず、角丸 12px とする。
4. The 「会場で使う」ボタン shall PC では 160×160px を 40px 間隔で中央揃えに並べ、SP では 171×171px を 2 列 2 行に並べる。
5. The 「会場で使う」ボタン shall アイコンを PC 56px / SP 48px で表示する。
6. The トピックカード shall 洗練前の見た目を保ち、タイトルのみ LINE Seed JP Bold 20px とする。

### Requirement 5: 白い光彩

**Objective:** As a 来場者, I want 質感や図形の上に乗った黒文字も読める, so that 装飾が可読性を損なわない

#### Acceptance Criteria
1. The 公式サイト shall 質感を持つカード・ボタンの中の黒文字・黒アイコンに、白 (不透明度 40%)・ぼかし 4px・オフセット 0 の光彩を付ける。
2. The 公式サイト shall 本文領域の黒文字・黒アイコンに要件 5.1 と同じ光彩を付け、背景図形と重なったときに文字が図形から浮いて見えるようにする (白地の上では光彩は見えない)。
3. The 公式サイト shall ヘッダー・ヒーロー・フッター・下部タブナビの文字に光彩を付けない。

### Requirement 6: 背景図形の構成

**Objective:** As a 来場者, I want 各ページに祭のテーマ「万彩」を象徴する図形が添えられている, so that サイト全体に統一した世界観を感じる

#### Acceptance Criteria
1. The 背景図形 shall ∞ (リング対)・大 (L)・小 (S) の 3 階層で構成する。
2. The 背景図形 shall L・S の種類を circle / triangle / square / roundedSquare / quarterCircle / semicircle とし、一辺を L は PC 225〜400px / SP 150〜250px、S は PC 70〜120px / SP 50〜80px とする。
3. The 背景図形 shall ∞ を、直径 D (PC 120〜175px / SP 80〜115px) の同径の輪 2 つを中心間距離 0.74D・線幅 0.1D・塗りなしで水平に並べ、-12〜12 度回転させた形とし、2 つの輪に異なる色トークンを用いる。
4. The 背景図形 shall ∞ の個数を 1 + floor((ページ高 − 2500) / 2500) (下限 1) とする。
5. The 背景図形 shall S の個数を max(floor(装飾可能高 / 400), 4 − L の個数) とする。装飾可能高はページ高からヘッダー (ヒーローがあればその下端まで)・フッター・SP の下部タブナビを除いた高さとする。
6. The 背景図形 shall L・S をパンフレット表紙の 4 質感 (グラデーション / 水彩 / ザラザラしたグラデーション / 網目) の画像で塗り、S には水彩を用いない。
7. The 背景図形 shall 1 ページの中で 4 質感をそれぞれ 1 回以上用いる。
8. The 背景図形 shall 色を 7 つの色トークン (ochre / olive / sage / salmon / rose / wisteria / aqua) から選ぶ。
9. The 背景図形 shall L の個数を 1 以上とする。

### Requirement 7: 背景図形の配置

**Objective:** As a 来場者, I want 図形が本文の邪魔をせず、同じページでは毎回同じ配置で表示される, so that 読みやすく落ち着いて閲覧できる

#### Acceptance Criteria
1. The 背景図形 shall ページの pathname を種とした決定的乱数 (FNV-1a 32bit → mulberry32) で、∞ → L → S の順に配置し、同じ pathname・同じレイアウトでは常に同じ配置を描画する。
2. The 背景図形 shall L を、ヘッダー (ヒーロー) 下端から上下間隔 (PC 520〜900px / SP 420〜720px) を乱数で引きながら縦に順に置き、ページ左右端からのはみ出しを一辺の 0.4 倍までとする。
3. The 背景図形 shall L と黒文字の外接矩形の重なりを、L の面積の 25% までとする。
4. The 背景図形 shall ∞・S を黒文字の外接矩形 (+10px) と重ねない。
5. The 背景図形 shall 文字リンク・白文字・ロゴ (+10px) と、どの階層の図形も重ねない。
6. The 背景図形 shall 不透明な面 (カード・写真・地図・協賛枠・入力欄・塗りを持つボタン) に対し、L は可視率 0.6 以上で裏に回ることを許し、∞・S は重ねない。
7. The 背景図形 shall 不透明な面と面の隙間 (ガター) に見える配置をしない。
8. The 背景図形 shall ヘッダー・ヒーロー・フッター・SP の下部タブナビに図形を置かない。
9. The 背景図形 shall 図形同士を回転後の外接円どうしで 24px 以上離す (階層をまたいでも同じ)。
10. The 背景図形 shall ∞ をページ端からはみ出させない。
11. The 背景図形 shall 各図形をその中心まわりに回転させる。

### Requirement 8: 背景図形の個数の保証

**Objective:** As a サイト運営者, I want どのページでも所定の個数の図形が置かれる, so that ページによって装飾が欠けない

#### Acceptance Criteria
1. If L を所定の縦位置に置けないとき, then the 背景図形 shall 縦位置のずらし・縮小 (0.85 倍ずつ、下限は範囲の最小値) の順に再試行し、なお置けなければ可視率の下限を 0.25 まで緩めて不透明な面の裏に回す。
2. If ∞ を置けないとき, then the 背景図形 shall 直径を 0.8 倍ずつ縮めて (下限は範囲の最小値) 再試行し、なお置けなければ、不透明な面の裏に回す配置 (可視率 0.25 以上) を、それでも置けなければ黒文字との重なり (面積比 25% 以下) を、この順に単独で許す。
3. If S を所定の個数置けないとき, then the 背景図形 shall 縮小、図形間隔 12px への緩和、ページ左右端から一辺の 0.5 倍までのはみ出しと不透明な面の裏への回り込み (可視率 0.7 以上) の順に再試行する。
4. The 背景図形 shall いずれの緩和段でもガター禁止と除外領域を守る。
5. The 背景図形 shall 同じ入力 (pathname・ページ高・幅・障害物) に対して、上記の緩和を含め常に同じ結果を返す。
6. If 通常の縦位置の手順で L が 1 個も置けないとき, then the 背景図形 shall 装飾可能帯の全域で縦位置を探し直し、要件 8.1 と同じ緩和段を同じ順序で適用して L を 1 個置く。

### Requirement 9: 状態が変わる画面での配置の維持

**Objective:** As a 来場者, I want 検索や絞り込みで一覧が変わっても図形が飛び回らない, so that 画面がちらつかない

#### Acceptance Criteria
1. When 同じ pathname の中で検索語・絞り込み・件数によって一覧の内容が変わったとき, the 背景図形 shall 配置を計算し直さず、元の配置のうち要件 7 の制約に反する図形だけを表示しない。
2. While 要件 9.1 により図形を間引いている間, the 背景図形 shall ∞ の下限個数と 4 質感の網羅を求めない。
3. When ページ幅が変わりレイアウトが変わったとき, the 背景図形 shall 新しいレイアウトで配置を計算し直す。

### Requirement 10: 背景図形の動き

**Objective:** As a 来場者, I want 図形が控えめに動いて祭の賑わいを感じさせる, so that 閲覧が楽しくなる

#### Acceptance Criteria
1. When 図形が初めて画面に入ったとき, the 背景図形 shall S は定位置から 120〜280px (所要 1.0s)、L は 80〜160px (所要 1.4s) 離れた位置から `cubic-bezier(0.16, 0.84, 0.44, 1)` で定位置へ移動する。
2. When ∞ が初めて画面に入ったとき, the 背景図形 shall 2 つの輪を左右の水平方向から寄せ、2 つ目を 0.15s 遅らせて合わせる。
3. While ポインター操作またはスクロールが続く間, the 背景図形 shall 図形を揺らし、変位の上限を S 24〜40px、L 8〜16px とし、反発半径を 160〜240px とする。
4. While モーションが無効 (`MotionToggle` でオフ、またはモーションの抑制設定) の間, the 背景図形 shall 図形を定位置に静止させて表示する。
5. The 背景図形 shall 本文のレイアウトに影響せず、支援技術から読み上げられない。

### Requirement 11: 生成ルールの一貫性

**Objective:** As a 開発者, I want 背景図形の生成ルールと実装が一致していることを機械的に確かめられる, so that ルール変更時に実装がずれない

#### Acceptance Criteria
1. The 背景図形の配置ロジック shall 生成ルールの検証ケース (参照実装 `place.py` の selftest。短いページ、状態違いの流用、カード列での L・∞ の緩和、文字が画面を埋める一覧での ∞ の緩和、図形間隔) と同じ入力に対し、同じ判定結果を返すテストを持つ。
2. The リポジトリ shall 背景図形の生成ルール文書と質感画像を、実装から参照できる場所に置く。
