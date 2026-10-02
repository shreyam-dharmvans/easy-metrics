# ==============================================================================
# EasyMetrics Ingestion & Query API (apps/api)
# Multi-stage Dockerfile for lightweight production deployment
# ==============================================================================

# STAGE 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Install system dependencies needed by Prisma on Alpine Linux
RUN apk add --no-cache openssl libc6-compat

# Copy workspace package manifests
COPY package.json package-lock.json ./
COPY packages/sdk/package.json ./packages/sdk/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY examples/demo-app/package.json ./examples/demo-app/

# Install dependencies across workspaces
RUN npm ci

# Copy API source and Prisma schema
COPY apps/api ./apps/api

# Generate Prisma Client and build TypeScript to dist/
RUN npm run prisma:generate --workspace=apps/api
RUN npm run build --workspace=apps/api

# Prune development dependencies
RUN npm prune --production

# ==============================================================================
# STAGE 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl libc6-compat

ENV NODE_ENV=production
ENV API_PORT=4000

# Copy root and workspace node_modules
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/apps/api ./apps/api

EXPOSE 4000

# Push database schema if needed on first boot, then start the Express server
CMD ["sh", "-c", "npx prisma db push --skip-generate --schema=./apps/api/prisma/schema.prisma && node ./apps/api/dist/server.js"]
