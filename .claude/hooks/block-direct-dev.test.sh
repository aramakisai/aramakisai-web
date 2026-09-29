#!/usr/bin/env bash
# block-direct-dev.sh の最小テスト。exit 2 ならブロック、exit 0 なら許可。
set -euo pipefail

HOOK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/block-direct-dev.sh"
pass=0
fail=0

run_case() {
  local desc="$1" command="$2" expect="$3" payload code
  payload="{\"tool_input\":{\"command\":\"${command}\"}}"
  set +e
  printf '%s' "$payload" | "$HOOK" >/dev/null 2>&1
  code=$?
  set -e
  if { [[ "$expect" == "block" && "$code" -eq 2 ]] || [[ "$expect" == "allow" && "$code" -eq 0 ]]; }; then
    echo "PASS: $desc"
    pass=$((pass + 1))
  else
    echo "FAIL: $desc (command=[$command] expect=$expect exit=$code)"
    fail=$((fail + 1))
  fi
}

# ブロックすべき例
run_case "pnpm dev" "pnpm dev" block
run_case "pnpm run dev" "pnpm run dev" block
run_case "pnpm -C frontend dev" "pnpm -C frontend dev" block
run_case "pnpm --filter x dev" "pnpm --filter x dev" block
run_case "npm run dev" "npm run dev" block
run_case "pnpm run devsafe" "pnpm run devsafe" block
run_case "npx next dev" "npx next dev" block
run_case "next dev (bare)" "next dev" block
run_case "next start (bare)" "next start" block
run_case "node_modules/.bin/next with port" "node_modules/.bin/next dev -p 3200" block
run_case "chained via &&" "true && pnpm dev" block
run_case "chained via ;" "echo hi; pnpm dev" block
run_case "env assignment prefix" "PORT=3200 pnpm dev" block
run_case "timeout prefix" "timeout 60 pnpm run dev" block
run_case "rtk prefix" "rtk pnpm dev" block

# ブロックすべきでない例
run_case "make dev" "make dev" allow
run_case "make cms" "make cms" allow
run_case "make dev-ps" "make dev-ps" allow
run_case "make preview" "make preview" allow
run_case "pnpm install" "pnpm install" allow
run_case "pnpm devDependencies literal" "pnpm devDependencies" allow
run_case "pnpm build" "pnpm build" allow
run_case "pnpm type-check" "pnpm type-check" allow
run_case "flag --dev" "some-cmd --dev" allow
run_case "flag -D" "some-cmd -D" allow
run_case "word developer" "echo developer" allow
run_case "unrelated ss command" "ss -ltnp" allow

echo "---"
echo "pass=${pass} fail=${fail}"
[[ $fail -eq 0 ]]
