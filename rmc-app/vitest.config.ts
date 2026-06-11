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
    // Worker threads start far cheaper than forked processes and share the
    // parent's transform cache, so the jsdom-heavy suite (every file imports a
    // large page like Users.tsx) collects and runs noticeably faster and with
    // less CPU contention than the default 'forks' pool. (isolate:false was
    // tried too but leaks module/mock state across files, so it's left on.)
    pool: 'threads',
    // With the faster, less-contended threads pool the slowest interaction test
    // (userEvent click/type + waitFor) lands well under 5s even under load, so
    // 15s gives ~3x headroom while letting a real hang surface sooner than the
    // previous 20s stop-gap did.
    testTimeout: 15000,
    hookTimeout: 15000,
  },
})
