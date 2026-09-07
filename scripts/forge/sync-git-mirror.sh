#!/usr/bin/env bash
set -euo pipefail
BARE_REPOSITORY=${1:?usage: sync-git-mirror.sh <bare-repository> <remote-name> [--push]}
REMOTE_NAME=${2:?remote name required}
MODE=${3:-}
[[ -d "$BARE_REPOSITORY" ]] || { echo "bare repository not found" >&2; exit 66; }
if [[ "$MODE" == "--push" ]]; then
  git --git-dir "$BARE_REPOSITORY" push --mirror "$REMOTE_NAME"
elif [[ -z "$MODE" ]]; then
  git --git-dir "$BARE_REPOSITORY" fetch "$REMOTE_NAME" --prune
else
  echo "unknown mode: $MODE" >&2
  exit 64
fi
