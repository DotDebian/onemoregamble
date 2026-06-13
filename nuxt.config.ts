// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  // Realtime trading dashboard: render as a SPA. Avoids SSR/canvas hydration
  // issues with lightweight-charts and live WebSocket data. The Nitro server
  // (used for /api/chat) still runs normally.
  ssr: false,

  devtools: { enabled: true },

  css: ['~/assets/css/main.css'],

  nitro: {
    // Keep the Claude Agent SDK (and its bundled native binary) OUT of the
    // server bundle, loaded from node_modules at runtime instead. Required so
    // the subscription path (`claude -p`) can locate and spawn its binary
    // inside the container. The image ships node_modules for this.
    externals: { external: ['@anthropic-ai/claude-agent-sdk'] },
  },

  runtimeConfig: {
    // Filled from NUXT_ANTHROPIC_API_KEY at runtime. The server route also
    // falls back to the plain ANTHROPIC_API_KEY env var (and the SDK default).
    anthropicApiKey: '',
    public: {
      // Sonnet 4.6 : moins cher et limites de débit plus hautes qu'Opus, tout
      // en gérant très bien la lecture d'indicateurs. `effort` pilote la
      // profondeur de réflexion (low | medium | high | max) ; 'medium' = bon
      // compromis coût/latence pour du live, passe à 'high' pour plus de fond.
      model: 'claude-sonnet-4-6',
      effort: 'medium',
      symbol: 'BTCUSDT',
      interval: '5m',
    },
  },

  app: {
    head: {
      title: 'OneMoreGamble — BTC/USDT · 5m',
      htmlAttrs: { lang: 'fr' },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'color-scheme', content: 'dark' },
      ],
    },
  },

  compatibilityDate: '2025-06-13',
})
