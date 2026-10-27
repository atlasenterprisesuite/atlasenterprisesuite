#!/usr/bin/env bash
# Manual opt-in only: disposable PostgreSQL URL explicitly supplied by test operator.
# Requires psql, createdb and two independent connections; never production.
set -euo pipefail
: "${SPIDER_TEST_DATABASE_URL:?set an isolated disposable PostgreSQL database URL}"
case "$SPIDER_TEST_DATABASE_URL" in
  *localhost*|*127.0.0.1*|*%2Flocalhost*) ;;
  *) echo "Refusing non-local PostgreSQL URL" >&2; exit 2 ;;
esac
# No implicit invocation. This script is a documented safety gate; exact
# two-session concurrency harness is pending verified test DB and auth schema.
echo "Blocked: two-session barrier and authoritative audit transaction not yet verified" >&2
exit 3
