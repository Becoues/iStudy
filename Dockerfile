# ---- Dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app

# Swap Alpine + npm to China-accessible mirrors. dl-cdn.alpinelinux.org
# and GitHub release binaries are frequently blocked/slow on mainland
# networks; aliyun + npmmirror make `apk`, `npm install`, and the
# better-sqlite3 prebuild download reliable. Harmless elsewhere.
RUN sed -i 's|dl-cdn.alpinelinux.org|mirrors.aliyun.com|g' /etc/apk/repositories \
 && apk add --no-cache python3 make g++ libc6-compat

RUN npm config set registry https://registry.npmmirror.com

# Route better-sqlite3's prebuild-install through npmmirror's GitHub
# release cache so we don't hit github.com directly.
ENV npm_config_better_sqlite3_binary_host_mirror=https://registry.npmmirror.com/-/binary/better-sqlite3

COPY package.json package-lock.json ./
# Retry once so a transient network blip doesn't fail the whole build.
RUN npm ci --prefer-offline --no-audit --progress=false \
    || npm ci --prefer-offline --no-audit --progress=false

# ---- Builder ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Pre-migrate a template DB at a neutral location (NOT inside /app/data,
# because /app/data will be bind-mounted at runtime and would hide it).
RUN mkdir -p /app/db-seed && \
    DATABASE_URL="file:/app/db-seed/istudy.db" npx prisma migrate deploy

# Build Next.js (standalone mode)
RUN npm run build

# ---- Runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/istudy.db"

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy generated Prisma client
COPY --from=builder /app/src/generated ./src/generated

# Copy pre-migrated template to a path OUTSIDE /app/data so that the
# ./data bind mount at runtime does not hide it.
COPY --from=builder /app/db-seed/istudy.db /app/istudy.db.template

# Copy entrypoint
COPY docker-entrypoint.sh ./

# Create persistent dirs and make them world-writable so the container
# can write to them regardless of UID (matters when docker-compose `user:`
# is set to the host UID for bind-mount permission compatibility).
RUN mkdir -p /app/data /app/public/images/knowledge /app/.next/cache && \
    chmod +x docker-entrypoint.sh && \
    chmod -R a+rwX /app/data /app/public/images/knowledge /app/.next/cache && \
    chmod a+r /app/istudy.db.template

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
