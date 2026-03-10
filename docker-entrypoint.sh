#!/bin/sh
set -e

# Ensure data directory exists
mkdir -p /app/data

# Run database migrations on startup
echo "Running database migrations..."
npx prisma migrate deploy
echo "Migrations complete."

exec "$@"
