#!/bin/sh
set -e

# Run database migrations on first start
npx prisma migrate deploy 2>/dev/null || echo "Migrations applied or skipped."

exec "$@"
