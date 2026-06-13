# syntax=docker/dockerfile:1
# OneMoreGamble — Nuxt 4 (SPA + Nitro server). Runs as a Node server because of
# the /api/* routes (chat, liquidations websocket). Multi-stage, debian-slim
# (glibc — required if you later enable the Claude subscription path, whose
# bundled native binary won't run on Alpine/musl).

############################  Build stage  ############################
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable

# Install deps first for layer caching. Linux platform binaries are fetched
# here — never copy host node_modules into the image.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Build the Nuxt app + standalone Nitro server into ./.output
COPY . .
RUN pnpm build

############################  Runtime stage  ############################
FROM node:22-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    NITRO_HOST=0.0.0.0 \
    NITRO_PORT=3000 \
    # Quieter Claude Code in containers (no autoupdate/telemetry).
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
    # Auth strategy: 'api' (key only — recommended in containers, skips the
    # Claude Code subprocess), 'auto', or 'subscription'. See README/notes.
    CHAT_MODE=api \
    # Model/effort are read server-side at runtime from these.
    NUXT_PUBLIC_MODEL=claude-sonnet-4-6 \
    NUXT_PUBLIC_EFFORT=medium

# Standalone Nitro output. In 'api' mode no node_modules are needed at runtime.
COPY --from=build --chown=node:node /app/.output ./.output

USER node
EXPOSE 3000

# Liveness via the existing status endpoint (Node 22 has global fetch).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/chat-status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# ANTHROPIC_API_KEY is a secret — pass it at runtime, never bake it in:
#   docker run -e ANTHROPIC_API_KEY=sk-ant-... -p 3000:3000 onemoregamble
CMD ["node", ".output/server/index.mjs"]
