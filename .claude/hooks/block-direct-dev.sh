#!/usr/bin/env bash
# PreToolUse (Bash) hook: 開発サーバーの直接起動をブロックし make dev / make cms / make preview へ誘導する。
set -euo pipefail

input=$(cat)

if command -v jq >/dev/null 2>&1; then
  cmd=$(printf '%s' "$input" | jq -r '.tool_input.command // empty')
else
  cmd=$(printf '%s' "$input" | python3 -c 'import json,sys
data = json.load(sys.stdin)
print(data.get("tool_input", {}).get("command", ""))')
fi

[[ -z "$cmd" ]] && exit 0

block() {
  echo "開発サーバーは make dev / make cms / make preview 経由で起動する。ポート指定・直接起動は禁止" >&2
  exit 2
}

# パイプ/;/&&/|| をコマンド断片の区切りとして分割する (クォート内の区切り文字までは解釈しない簡易版)
segments=()
current=""
i=0
len=${#cmd}
while ((i < len)); do
  two="${cmd:i:2}"
  one="${cmd:i:1}"
  if [[ "$two" == "&&" || "$two" == "||" ]]; then
    segments+=("$current")
    current=""
    i=$((i + 2))
    continue
  fi
  if [[ "$one" == "|" || "$one" == ";" ]]; then
    segments+=("$current")
    current=""
    i=$((i + 1))
    continue
  fi
  current+="$one"
  i=$((i + 1))
done
segments+=("$current")

for seg in "${segments[@]}"; do
  # next dev / next start (npx next dev, node_modules/.bin/next dev -p 3200 等)
  if [[ "$seg" =~ (^|[[:space:]/])next[[:space:]]+(dev|start)([[:space:]]|$) ]]; then
    block
  fi

  # pnpm/npm/yarn/bun/npx/pnpx 経由の dev / devsafe スクリプト実行。
  # PORT=3200 / env / timeout / rtk 等の前置きがあっても検出するため、先頭に限らずパッケージマネージャを探す
  read -ra tokens <<<"$seg"
  pm_found=0
  for tok in "${tokens[@]}"; do
    if ((pm_found)); then
      if [[ "$tok" == "dev" || "$tok" == "devsafe" ]]; then
        block
      fi
      continue
    fi
    case "$(basename -- "$tok")" in
      pnpm | npm | yarn | bun | npx | pnpx) pm_found=1 ;;
    esac
  done
done

exit 0
