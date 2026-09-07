#!/usr/bin/env bash
set -euo pipefail
SOURCE_REPOSITORY=${1:?usage: bootstrap-local-repository.sh <source-working-copy> <forge-home> <repository-id>}
FORGE_HOME=${2:?forge home required}
REPOSITORY_ID=${3:?repository id required}
[[ "$REPOSITORY_ID" =~ ^[a-z0-9][a-z0-9-]{0,63}$ ]] || { echo "invalid repository id" >&2; exit 64; }
mkdir -p "$FORGE_HOME"/{repos,state/runs,state/jobs,logs,audit,artifacts,workspaces,home,npm-cache}
chmod 700 "$FORGE_HOME"
TARGET="$FORGE_HOME/repos/$REPOSITORY_ID.git"
if [[ ! -d "$TARGET" ]]; then
  git clone --mirror "$SOURCE_REPOSITORY" "$TARGET"
fi
git --git-dir "$TARGET" config receive.denyNonFastForwards true
git --git-dir "$TARGET" fsck --full
printf '%s\n' "$TARGET"
