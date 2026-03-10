#!/bin/sh
set -e

mkdir -p /app/data

# If no database exists yet, copy the pre-migrated template
if [ ! -f /app/data/istudy.db ]; then
  echo "Initializing database from template..."
  cp /app/data/istudy.db.template /app/data/istudy.db
  echo "Database initialized."
fi

exec "$@"
