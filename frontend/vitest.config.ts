import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html']
    },
    environment: 'jsdom',
    include: ['src/**/*.test.ts']
  }
})
