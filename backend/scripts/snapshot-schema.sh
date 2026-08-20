#!/usr/bin/env bash
#
# Regenerate backend/schema.sql from the live database.
#
# migrations/ is a changelog: it says how the schema got here, never what it is
# now. Answering "what columns does users have today?" from those files means
# replaying five of them by hand. This script asks the database instead and
# writes the answer down, so the current shape is one greppable, diffable file.
#
# Run it after every `npm run migrate`. The diff it produces is a review aid:
# a migration whose snapshot diff surprises you did something you did not mean.
#
#   npm run schema:snapshot
#
set -euo pipefail

cd "$(dirname "$0")/../.."

if [[ -z "${DATABASE_URL:-}" ]]; then
    # Same file the app reads. Only this one line, so nothing else leaks in.
    DATABASE_URL="$(grep -E '^DATABASE_URL=' backend/.env | cut -d= -f2-)"
fi

if [[ -z "$DATABASE_URL" ]]; then
    echo "DATABASE_URL is not set and backend/.env has no DATABASE_URL line" >&2
    exit 1
fi

out=backend/schema.sql

{
    echo "-- GENERATED FILE — DO NOT EDIT."
    echo "--"
    echo "-- Snapshot of the current database schema, written by"
    echo "-- backend/scripts/snapshot-schema.sh. Read this to learn the shape of a"
    echo "-- table; read backend/migrations/ to learn how it got that way."
    echo "--"
    echo "-- To change the schema, add a migration and re-run:"
    echo "--     npm run migrate && npm run schema:snapshot"
    echo ""
    # --schema-only: shape, not rows. --no-owner/--no-privileges: role names are
    # per-machine noise and would make the file diff on every teammate's laptop.
    #
    # Postgres 18's pg_dump brackets output with \restrict and \unrestrict lines
    # carrying a random token, which would churn the diff on every single run.
    pg_dump "$DATABASE_URL" --schema-only --no-owner --no-privileges |
        grep -vE '^\\restrict|^\\unrestrict' |
        grep -vE '^-- Dumped (from|by)'
} >"$out"

echo "wrote $out"
