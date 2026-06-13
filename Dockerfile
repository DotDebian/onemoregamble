# syntax=docker/dockerfile:1
# OneMoreGamble — Nuxt 4 (SPA + Nitro server). Chat copilot in 'auto' mode:
# subscription (`claude -p` via the Agent SDK) first, API-key fallback.
#
# Ships node_modules so the Agent SDK's bundled native Claude Code binary is
# present at runtime. debian-slim = glibc (the prebuilt binary will NOT run on
# Alpine/musl).

############################  Build stage  ############################
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable

# Deps first for layer caching. Linux platform binaries (incl. the bundled
# Claude Code binary) are fetched here — never copy host node_modules.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Build the Nuxt app + Nitro server into ./.output
COPY . .
RUN pnpm build

############################  Runtime stage  ############################
FROM node:22-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    HOME=/home/node \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000 \
    # Quieter Claude Code in containers (no autoupdate/telemetry).
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
    # 'auto' = subscription (claude -p) first, then API-key fallback.
    # Set 'api' to disable the subprocess entirely, or 'subscription' for no fallback.
    CHAT_MODE=auto \
    NUXT_PUBLIC_MODEL=claude-sonnet-4-6 \
    NUXT_PUBLIC_EFFORT=medium

# Server bundle + node_modules (the Agent SDK + its native binary, kept external
# from the bundle so the subscription path can spawn it).
COPY --from=build --chown=node:node /app/.output ./.output
COPY --from=build --chown=node:node /app/node_modules ./node_modules

USER node
EXPOSE 3000

# Liveness via the status endpoint (Node 22 has global fetch).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/chat-status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Secrets (CLAUDE_CODE_OAUTH_TOKEN, ANTHROPIC_API_KEY) are passed at runtime via
# the compose .env — never baked into the image.
CMD ["node", ".output/server/index.mjs"]
