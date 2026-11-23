#!/usr/bin/env bash
# Executa os testes de RLS num Postgres local descartável (sem Docker).
# Uso: ./supabase/tests/executar.sh
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
PGBIN="${PGBIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)}"
TMP="$(mktemp -d)"
trap '"$PGBIN/pg_ctl" -D "$TMP/data" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
"$PGBIN/initdb" -D "$TMP/data" -U postgres -A trust >/dev/null
"$PGBIN/pg_ctl" -D "$TMP/data" -o "-k $TMP -p 54329 -c listen_addresses=''" -l "$TMP/log" start >/dev/null
PSQL=(psql -h "$TMP" -p 54329 -U postgres -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" -c "create database teste"
"${PSQL[@]}" -d teste -f "$DIR/supabase_stub.sql"
"${PSQL[@]}" -d teste -f "$DIR/../migrations/20261123000001_esquema_inicial.sql"
"${PSQL[@]}" -d teste -f "$DIR/testes_rls.sql"
