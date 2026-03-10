# ---- Dependencies ----
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- Builder ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV DATABASE_URL="file:/app/data/istudy.db"

# Generate Prisma client
RUN npx prisma generate

# Pre-create the database with migrations applied
RUN mkdir -p /app/data && npx prisma migrate deploy

# Build Next.js (standalone mode)
RUN npm run build

# ---- Runner ----
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_URL="file:/app/data/istudy.db"

# Create directories for persistent data
RUN mkdir -p /app/data /app/public/images/knowledge

# Copy standalone build
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Copy generated Prisma client
COPY --from=builder /app/src/generated ./src/generated

# Copy pre-migrated empty database as template
COPY --from=builder /app/data/istudy.db /app/data/istudy.db.template

# Copy entrypoint
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
