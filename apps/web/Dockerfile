# ==============================================================================
# EasyMetrics Developer Dashboard (apps/web)
# Multi-stage Dockerfile for Next.js 14 Standalone Output
# ==============================================================================

# STAGE 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache libc6-compat

# Copy workspace package manifests
COPY package.json package-lock.json ./
COPY packages/sdk/package.json ./packages/sdk/
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY examples/demo-app/package.json ./examples/demo-app/

# Install dependencies across workspaces
RUN npm ci

# Copy web application source code
COPY apps/web ./apps/web

# Set production build-time arguments (can be overridden during build)
ARG NEXT_PUBLIC_API_URL="http://localhost:4000"
ARG NEXT_PUBLIC_AGENT_URL="http://localhost:8000"
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_AGENT_URL=$NEXT_PUBLIC_AGENT_URL
ENV NEXT_TELEMETRY_DISABLED=1

# Build Next.js application (generates .next/standalone)
RUN npm run build --workspace=apps/web

# ==============================================================================
# STAGE 2: Production Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Non-root system user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy static assets and standalone build output
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

USER nextjs

EXPOSE 3000

# Start Next.js standalone server
CMD ["node", "apps/web/server.js"]
