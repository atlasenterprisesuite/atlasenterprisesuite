#!/usr/bin/env bash
# Disposable database capability check only; not an Advisory authorization proof.
set -euo pipefail
if [[ "${1:-}" != --inside ]]; then
  runner_user=$(id -un)
  pg_bin=$(pg_config --bindir) || { echo 'BLOCKED: PostgreSQL unavailable' >&2; exit 78; }
  [[ $(id -u) != 0 ]] || { echo 'BLOCKED: non-root runner required' >&2; exit 78; }
  sudo -n unshare --net -- true || { echo 'BLOCKED: network namespace unavailable' >&2; exit 78; }
  exec sudo -n unshare --net -- runuser -u "$runner_user" -- \
    env -i PATH="$pg_bin:/usr/bin:/bin" HOME=/tmp \
    bash "$(realpath "$0")" --inside
fi
[[ $(id -u) != 0 ]] || exit 78
# /proc/net is scoped to the calling process network namespace; /sys may
# retain the host sysfs mount after unshare and cause false positives.
awk 'NR > 2 { split($0, fields, ":"); gsub(/[[:space:]]/, "", fields[1]); if (fields[1] != "lo") exit 78 }' /proc/net/dev \
  || { echo 'BLOCKED: external interface present' >&2; exit 78; }
work=$(mktemp -d /tmp/atlas-pg.XXXXXX)
cleanup() {
  pg_ctl -D "$work/data" -m immediate -w stop >/dev/null 2>&1 || true
  rm -rf "$work"
}
trap cleanup EXIT
mkdir "$work/socket"
initdb -D "$work/data" --auth-local=trust --auth-host=reject --no-locale >/dev/null
pg_ctl -D "$work/data" -l "$work/server.log" \
  -o "-k $work/socket -c listen_addresses='' -c unix_socket_permissions=0700" -w start >/dev/null
psql -X -v ON_ERROR_STOP=1 -h "$work/socket" -d postgres <<'SQL'
DO $$ BEGIN
  IF current_setting('listen_addresses') <> '' THEN
    RAISE EXCEPTION 'TCP must be disabled';
  END IF;
END $$;
CREATE ROLE atlas_synthetic_actor NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE TABLE public.atlas_synthetic_probe (id integer PRIMARY KEY);
SET ROLE atlas_synthetic_actor;
DO $$ BEGIN
  BEGIN
    INSERT INTO public.atlas_synthetic_probe VALUES (1);
    RAISE EXCEPTION 'Unexpected permission bypass';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.atlas_synthetic_probe) THEN
    RAISE EXCEPTION 'Denied write persisted';
  END IF;
END $$;
SQL
printf '%s\n' 'ENVIRONMENT SMOKE PASSED; Advisory migrations and revocation proof NOT EXECUTED'
