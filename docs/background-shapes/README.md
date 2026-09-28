# 背景図形 golden の再生成手順

`rules.md` が生成ルールの正、`place.py` が参照実装。TS 実装 (`frontend/src/lib/background-shapes/`) の配置ロジックはこの2つに追随させる。

## 自己検査

```
python3 place.py --selftest
```

Figma へのアクセスなしで配置ロジック自体を検査する。`selftest ok` が標準エラーに出れば成功。

## golden の再生成

fixture は `frontend/src/lib/background-shapes/__fixtures__/` に置いた place.py の入力 JSON。

```
cd docs/background-shapes
FIX=../../frontend/src/lib/background-shapes/__fixtures__

for name in top-pc top-sp topics-list-sp news-list-sp news-list-empty-sp news-detail-sp news-detail-pc; do
  python3 place.py "$FIX/$name.json" > "$FIX/$name.golden.json"
done

python3 place.py --reuse "$FIX/news-list-sp.golden.json" "$FIX/news-list-empty-sp.json" > "$FIX/news-list-reuse.golden.json"
```

非0終了 (`meta.deficit` のいずれかが > 0) でも golden はそのまま出力される。golden はそのページで実際に得られる配置を記録するためのもので、`deficit` の値自体も golden の一部として比較する (`news-list-empty-sp` は装飾可能高が短く S が1個不足する想定どおりの結果)。

再生成後 `git diff` で差分が出なければ、TS 実装が参照実装とまだ一致している。差分が出た場合は `rules.md` または `place.py` の変更を TS 実装側 (`geometry.ts` / `placement.ts` / `reuse.ts`) に反映してから golden をコミットし直す。

## fixture の対応

| fixture | 元データ | pathname | platform |
|---|---|---|---|
| `top-pc` | Figma `107:3` | `/` | pc |
| `top-sp` | Figma `141:23` | `/` | sp |
| `topics-list-sp` | Figma `382:834` | `/topics` | sp |
| `news-list-sp` | Figma `400-954` | `/news` | sp |
| `news-list-empty-sp` | Figma `401-1056` | `/news` | sp (0件・短いページ) |
| `news-detail-sp` | Figma `439-5379` | `/news/sample` | sp |
| `news-detail-pc` | `place.py` の `selftest()` の合成入力 | `/news/sample` | pc |

`news-list-reuse.golden.json` は `news-list-sp` の配置を `news-list-empty-sp` の障害物で間引いた結果 (同じ pathname・platform の実測の組を使う流用モードの golden)。
