#!/bin/sh
set -e

# Ensure the bind-mounted data dir exists.
mkdir -p /app/data 2>/dev/null || true

# First run: seed from the pre-migrated template (kept OUTSIDE /app/data so
# the ./data bind mount does not hide it).
if [ ! -f /app/data/istudy.db ]; then
  if [ -f /app/istudy.db.template ]; then
    echo "[entrypoint] Initializing /app/data/istudy.db from template..."
    cp /app/istudy.db.template /app/data/istudy.db
    echo "[entrypoint] Database initialized."
  else
    echo "[entrypoint] WARNING: no DB and no template found at /app/istudy.db.template"
  fi
fi

# Make sure the DB file is readable/writable by whichever UID the container runs as.
chmod a+rw /app/data/istudy.db 2>/dev/null || true

# Ensure the obsidian export dir exists and is accessible. OBSIDIAN_PATH can
# be overridden via docker-compose env; defaults match the hardcoded path the
# app ships with.
OBSIDIAN_PATH="${OBSIDIAN_PATH:-/Users/mac/Documents/Main/AI_talking}"
if [ -n "$OBSIDIAN_PATH" ]; then
  mkdir -p "$OBSIDIAN_PATH" 2>/dev/null || \
    echo "[entrypoint] WARNING: cannot create or access $OBSIDIAN_PATH (check bind-mount + host permissions)"
fi

exec "$@"
