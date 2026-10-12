/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

const enableHttps =
  process.env.HTTPS === 'true' ||
  process.env.VITE_HTTPS === 'true' ||
  process.argv.includes('--https')

export default defineConfig({
  plugins: [react(), ...(enableHttps ? [basicSsl()] : [])],
  server: {
    host: true, // exposes on all network interfaces (0.0.0.0)
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    globals: true,
    testTimeout: 30000,
    pool: 'threads',
    maxWorkers: 2,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
})
