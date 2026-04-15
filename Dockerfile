# ═══════════════════════════════════════════════════════════════
# Base
# ═══════════════════════════════════════════════════════════════
FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@10 --activate
WORKDIR /app

# ═══════════════════════════════════════════════════════════════
# Dependencies
# ═══════════════════════════════════════════════════════════════
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json turbo.json ./
COPY packages/core/package.json packages/core/
COPY packages/manifest/package.json packages/manifest/
COPY packages/worker/package.json packages/worker/
COPY packages/app/package.json packages/app/
COPY packages/site/package.json packages/site/
COPY packages/store-postgres/package.json packages/store-postgres/
COPY packages/store-sqlite/package.json packages/store-sqlite/
RUN pnpm install --frozen-lockfile

# ═══════════════════════════════════════════════════════════════
# Build
# ═══════════════════════════════════════════════════════════════
FROM deps AS build
COPY packages/ packages/
RUN pnpm --filter @agntz/core build
RUN pnpm --filter @agntz/manifest build
RUN pnpm --filter @agntz/store-postgres build
RUN pnpm --filter @agntz/worker build
RUN pnpm --filter @agntz/app build
RUN pnpm --filter @agntz/site build

# ═══════════════════════════════════════════════════════════════
# Worker
# ═══════════════════════════════════════════════════════════════
FROM base AS worker
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/core/node_modules ./packages/core/node_modules
COPY --from=deps /app/packages/manifest/node_modules ./packages/manifest/node_modules
COPY --from=deps /app/packages/worker/node_modules ./packages/worker/node_modules
COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/packages/core/package.json ./packages/core/
COPY --from=build /app/packages/manifest/dist ./packages/manifest/dist
COPY --from=build /app/packages/manifest/package.json ./packages/manifest/
COPY --from=build /app/packages/worker/dist ./packages/worker/dist
COPY --from=build /app/packages/worker/package.json ./packages/worker/
COPY --from=deps /app/packages/store-postgres/node_modules ./packages/store-postgres/node_modules
COPY --from=build /app/packages/store-postgres/dist ./packages/store-postgres/dist
COPY --from=build /app/packages/store-postgres/package.json ./packages/store-postgres/
COPY pnpm-workspace.yaml package.json ./
ENV PORT=4001
EXPOSE 4001
CMD ["node", "packages/worker/dist/server.js"]

# ═══════════════════════════════════════════════════════════════
# App
# ═══════════════════════════════════════════════════════════════
FROM base AS app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/app/node_modules ./packages/app/node_modules
COPY --from=deps /app/packages/store-postgres/node_modules ./packages/store-postgres/node_modules
COPY --from=build /app/packages/app/.next ./packages/app/.next
COPY --from=build /app/packages/app/package.json ./packages/app/
COPY --from=build /app/packages/app/next.config.ts ./packages/app/
COPY --from=build /app/packages/core/dist ./packages/core/dist
COPY --from=build /app/packages/core/package.json ./packages/core/
COPY --from=build /app/packages/manifest/dist ./packages/manifest/dist
COPY --from=build /app/packages/manifest/package.json ./packages/manifest/
COPY --from=build /app/packages/worker/dist ./packages/worker/dist
COPY --from=build /app/packages/worker/package.json ./packages/worker/
COPY --from=build /app/packages/store-postgres/dist ./packages/store-postgres/dist
COPY --from=build /app/packages/store-postgres/package.json ./packages/store-postgres/
COPY pnpm-workspace.yaml package.json ./
ENV PORT=3000
EXPOSE 3000
WORKDIR /app/packages/app
CMD ["pnpm", "start"]

# ═══════════════════════════════════════════════════════════════
# Site (marketing)
# ═══════════════════════════════════════════════════════════════
FROM base AS site
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/site/node_modules ./packages/site/node_modules
COPY --from=build /app/packages/site/.next ./packages/site/.next
COPY --from=build /app/packages/site/package.json ./packages/site/
COPY --from=build /app/packages/site/next.config.ts ./packages/site/
COPY pnpm-workspace.yaml package.json ./
ENV PORT=3001
EXPOSE 3001
WORKDIR /app/packages/site
CMD ["pnpm", "start"]
