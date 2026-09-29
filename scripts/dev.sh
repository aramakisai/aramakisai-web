#!/usr/bin/env bash
# make dev / dev-ps / dev-stop / preview / cms / cms-worktree のロジック本体。
set -euo pipefail

PORT_MIN=3200
PORT_RANGE=800
CMS_PORT=3100
PREVIEW_PORT=3000

worktree_root() { git rev-parse --show-toplevel; }

# worktree 名から 3200-3999 の決定的なポートを算出する (3000/3100 は予約のため避ける)
port_for_name() {
  local name="$1" sum
  sum=$(printf '%s' "$name" | cksum | cut -d' ' -f1)
  echo $((PORT_MIN + sum % PORT_RANGE))
}

listener_pid() {
  local port="$1"
  ss -H -ltnp "sport = :${port}" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1 || true
}

# ポートの listener を worktree/branch まで遡って一行で表現する。listener が無ければ空文字。
owner_desc() {
  local port="$1" pid cwd toplevel branch
  pid=$(listener_pid "$port")
  [[ -z "$pid" ]] && return 0
  cwd=$(readlink -f "/proc/${pid}/cwd" 2>/dev/null || true)
  if [[ -z "$cwd" ]]; then
    echo "不明なプロセス (pid ${pid})"
    return 0
  fi
  toplevel=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null || true)
  if [[ -z "$toplevel" ]]; then
    echo "不明なプロセス (pid ${pid}, cwd ${cwd})"
    return 0
  fi
  branch=$(git -C "$toplevel" branch --show-current 2>/dev/null || true)
  [[ -z "$branch" ]] && branch=$(git -C "$toplevel" rev-parse --short HEAD 2>/dev/null || echo "不明")
  echo "$(basename "$toplevel") (${branch}) [pid ${pid}]"
}

# next dev の実体プロセス (next/dist/bin/next 経由の起動) を祖先方向に辿って探す。
# next-server はワーカーとして listen し、next dev の CLI プロセスと別なことがあるため両方を SIGTERM 対象にする。
find_next_cli_pid() {
  local pid="$1" depth=0 ppid
  while [[ -n "$pid" && "$pid" != "1" && $depth -lt 6 ]]; do
    if tr '\0' ' ' <"/proc/${pid}/cmdline" 2>/dev/null | grep -qE '(next/dist/bin/next|node_modules/\.bin/next)\b'; then
      echo "$pid"
      return 0
    fi
    ppid=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
    pid="$ppid"
    depth=$((depth + 1))
  done
}

# 指定ポートの next プロセスを SIGTERM で止め、解放を最大 10 秒待つ。所有者確認はしない (呼び出し側の責務)。
stop_port() {
  local port="$1" pid cli_pid targets waited
  pid=$(listener_pid "$port")
  if [[ -z "$pid" ]]; then
    echo "ポート ${port} は使用されていません"
    return 0
  fi
  cli_pid=$(find_next_cli_pid "$pid")
  targets="$pid"
  [[ -n "$cli_pid" && "$cli_pid" != "$pid" ]] && targets="$targets $cli_pid"
  # shellcheck disable=SC2086
  kill -TERM $targets 2>/dev/null || true
  waited=0
  while [[ -n "$(listener_pid "$port")" && $waited -lt 10 ]]; do
    sleep 1
    waited=$((waited + 1))
  done
  if [[ -n "$(listener_pid "$port")" ]]; then
    echo "ポート ${port} の停止に失敗しました (pid ${pid})" >&2
    return 1
  fi
  echo "ポート ${port} を停止しました"
}

cmd_dev() {
  local cms_mode="${1:-}" root name port branch owner cms_url
  root=$(worktree_root)
  name=$(basename "$root")
  port=$(port_for_name "$name")

  owner=$(owner_desc "$port")
  if [[ -n "$owner" ]]; then
    echo "${port} は ${owner} が使用中です" >&2
    exit 1
  fi

  if [[ ! -d "${root}/frontend/node_modules" ]]; then
    (cd "${root}/frontend" && pnpm install --frozen-lockfile)
  fi

  cms_url="http://localhost:${CMS_PORT}"
  [[ "$cms_mode" == "worktree" ]] && cms_url="http://localhost:$((port + 1000))"
  [[ "$cms_mode" == "prod" ]] && cms_url="https://cms.aramakisai.com"

  branch=$(git -C "$root" branch --show-current 2>/dev/null || true)
  [[ -z "$branch" ]] && branch=$(git -C "$root" rev-parse --short HEAD)
  echo "起動: http://localhost:${port} (worktree: ${name}, branch: ${branch}, CMS: ${cms_url})"

  cd "${root}/frontend"
  export NEXT_PUBLIC_CMS_URL="$cms_url"
  export NEXT_PUBLIC_SITE_URL="http://localhost:${port}"
  exec node_modules/.bin/next dev -p "${port}"
}

cmd_dev_ps() {
  local line local_addr port pid cwd toplevel branch role wtname
  printf '%-6s %-13s %-24s %-20s %s\n' "PORT" "ROLE" "WORKTREE" "BRANCH" "PID"
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    local_addr=$(awk '{print $4}' <<<"$line")
    port=${local_addr##*:}
    pid=$(grep -oP 'pid=\K[0-9]+' <<<"$line" | head -1)
    wtname="不明"; branch="-"; role="-"
    if [[ -n "$pid" ]]; then
      cwd=$(readlink -f "/proc/${pid}/cwd" 2>/dev/null || true)
      if [[ -n "$cwd" ]]; then
        toplevel=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null || true)
        if [[ -n "$toplevel" ]]; then
          wtname=$(basename "$toplevel")
          branch=$(git -C "$toplevel" branch --show-current 2>/dev/null || true)
          [[ -z "$branch" ]] && branch=$(git -C "$toplevel" rev-parse --short HEAD 2>/dev/null || echo "-")
          if [[ "$port" == "$PREVIEW_PORT" ]]; then
            role="preview"
          elif [[ "$port" == "$CMS_PORT" ]]; then
            role="cms"
          elif [[ "$(basename "$cwd")" == "cms" ]]; then
            role="cms-worktree"
          else
            role="dev"
          fi
        fi
      fi
    fi
    printf '%-6s %-13s %-24s %-20s %s\n' "$port" "$role" "$wtname" "$branch" "${pid:--}"
  done < <(ss -H -ltnp "( sport >= :${PREVIEW_PORT} and sport <= :4999 )" 2>/dev/null)
}

cmd_dev_stop() {
  local cms_mode="${1:-}" root name port pid cwd toplevel
  root=$(worktree_root)
  name=$(basename "$root")
  port=$(port_for_name "$name")
  [[ "$cms_mode" == "worktree" ]] && port=$((port + 1000))

  pid=$(listener_pid "$port")
  if [[ -z "$pid" ]]; then
    echo "ポート ${port} は使用されていません"
    return 0
  fi
  cwd=$(readlink -f "/proc/${pid}/cwd" 2>/dev/null || true)
  toplevel=$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null || true)
  if [[ "$toplevel" != "$root" ]]; then
    echo "ポート ${port} は自分の worktree ではありません: $(owner_desc "$port")" >&2
    exit 1
  fi
  stop_port "$port"
}

cmd_preview() {
  local branch="${1:-}" common_dir main_root pw_root log_file
  common_dir=$(git rev-parse --path-format=absolute --git-common-dir)
  main_root=$(dirname "$common_dir")
  pw_root="${main_root}/.claude/worktrees/preview"
  log_file="${common_dir}/dev-preview.log"

  if [[ -z "$branch" ]]; then
    local owner cur_branch cur_commit
    owner=$(owner_desc "$PREVIEW_PORT")
    if [[ -n "$owner" ]]; then
      echo "${PREVIEW_PORT} 番で稼働中: ${owner}"
    else
      echo "${PREVIEW_PORT} 番は停止中"
    fi
    if [[ ! -d "$pw_root" ]]; then
      echo "preview worktree (${pw_root}) は未作成です"
      return 0
    fi
    cur_branch=$(git -C "$pw_root" branch --show-current 2>/dev/null || true)
    [[ -z "$cur_branch" ]] && cur_branch="(detached $(git -C "$pw_root" rev-parse --short HEAD))"
    cur_commit=$(git -C "$pw_root" rev-parse --short HEAD)
    echo "preview worktree: branch=${cur_branch} commit=${cur_commit}"
    return 0
  fi

  # preview はコミット済みの状態のみを表示する (未コミットの変更は載らない)
  if [[ ! -d "$pw_root" ]]; then
    git worktree add --detach "$pw_root"
  fi

  if [[ -n "$(git -C "$pw_root" status --porcelain)" ]]; then
    echo "preview worktree が dirty なため中断します: ${pw_root}" >&2
    exit 1
  fi

  if git -C "$main_root" show-ref --verify --quiet "refs/heads/${branch}"; then
    git -C "$pw_root" checkout --detach "$branch"
  else
    git -C "$main_root" fetch origin "$branch"
    git -C "$pw_root" checkout --detach "origin/${branch}"
  fi

  (cd "${pw_root}/frontend" && pnpm install --frozen-lockfile)

  local pid
  pid=$(listener_pid "$PREVIEW_PORT")
  if [[ -n "$pid" ]]; then
    if [[ -n "$(find_next_cli_pid "$pid")" ]]; then
      echo "${PREVIEW_PORT} 番の既存プロセスを停止します: $(owner_desc "$PREVIEW_PORT")"
      stop_port "$PREVIEW_PORT"
    else
      echo "${PREVIEW_PORT} 番は next 以外のプロセスが使用中のため中断します: $(owner_desc "$PREVIEW_PORT")" >&2
      exit 1
    fi
  fi

  cd "${pw_root}/frontend"
  export NEXT_PUBLIC_CMS_URL="http://localhost:${CMS_PORT}"
  export NEXT_PUBLIC_SITE_URL="http://localhost:${PREVIEW_PORT}"
  setsid nohup node_modules/.bin/next dev -p "${PREVIEW_PORT}" >>"$log_file" 2>&1 &
  disown

  local waited=0
  until curl -sf "http://localhost:${PREVIEW_PORT}/" >/dev/null 2>&1; do
    sleep 1
    waited=$((waited + 1))
    if [[ $waited -ge 90 ]]; then
      echo "90 秒待っても応答がありません。ログ: ${log_file}" >&2
      exit 1
    fi
  done

  local commit
  commit=$(git -C "$pw_root" rev-parse --short HEAD)
  echo "起動: http://localhost:${PREVIEW_PORT} (branch: ${branch}, commit: ${commit})"
  echo "注意: preview はコミット済みの状態のみを反映します (未コミットの変更は含まれません)"
}

cmd_cms() {
  local common_dir main_root owner
  common_dir=$(git rev-parse --path-format=absolute --git-common-dir)
  main_root=$(dirname "$common_dir")

  owner=$(owner_desc "$CMS_PORT")
  if [[ -n "$owner" ]]; then
    echo "${CMS_PORT} は ${owner} が使用中です (共有 CMS は 1 つだけ)" >&2
    exit 1
  fi

  echo "起動: http://localhost:${CMS_PORT} (共有 CMS, ${main_root}/cms)"
  cd "${main_root}/cms"
  pnpm db:up
  exec infisical run --env=prod -- env NODE_OPTIONS=--no-deprecation node_modules/.bin/next dev -p "${CMS_PORT}"
}

cmd_cms_worktree() {
  local root name port owner
  root=$(worktree_root)
  name=$(basename "$root")
  port=$(($(port_for_name "$name") + 1000))

  owner=$(owner_desc "$port")
  if [[ -n "$owner" ]]; then
    echo "${port} は ${owner} が使用中です" >&2
    exit 1
  fi

  echo "起動: http://localhost:${port} (worktree: ${name} の cms/, マイグレーション検証用)"
  cd "${root}/cms"
  pnpm db:up
  exec infisical run --env=prod -- env NODE_OPTIONS=--no-deprecation node_modules/.bin/next dev -p "${port}"
}

sub="${1:-}"
shift || true
case "$sub" in
  dev) cmd_dev "$@" ;;
  dev-ps) cmd_dev_ps "$@" ;;
  dev-stop) cmd_dev_stop "$@" ;;
  preview) cmd_preview "$@" ;;
  cms) cmd_cms "$@" ;;
  cms-worktree) cmd_cms_worktree "$@" ;;
  *)
    echo "使い方: scripts/dev.sh {dev|dev-ps|dev-stop|preview|cms|cms-worktree}" >&2
    exit 1
    ;;
esac
