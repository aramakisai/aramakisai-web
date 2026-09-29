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

  # pnpm/npm/yarn/bun/npx/pnpx 経由の dev / devsafe スクリプト実行
  read -ra tokens <<<"$seg"
  [[ ${#tokens[@]} -eq 0 ]] && continue
  first_base=$(basename "${tokens[0]}")
  case "$first_base" in
    pnpm | npm | yarn | bun | npx | pnpx)
      for ((j = 1; j < ${#tokens[@]}; j++)); do
        if [[ "${tokens[j]}" == "dev" || "${tokens[j]}" == "devsafe" ]]; then
          block
        fi
      done
      ;;
  esac
done

exit 0
