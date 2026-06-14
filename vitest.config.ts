import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Mirror Nuxt's `~` / `@` aliases (srcDir = ./app) so tests can import indicator
// definitions that reference `~/utils/...` the same way the app does.
const appDir = fileURLToPath(new URL('./app', import.meta.url))

export default defineConfig({
  resolve: {
    alias: { '~': appDir, '@': appDir },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
})
