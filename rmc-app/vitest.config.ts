import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // The full suite runs every file in parallel and re-transforms large pages
    // (e.g. Users.tsx), which starves CPU and makes interaction-heavy tests
    // (userEvent click/type + waitFor) drift past the 5s default and time out
    // non-deterministically. A generous global timeout keeps the gate reliable
    // under load; tests still finish in ~1s when run in isolation.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
})
