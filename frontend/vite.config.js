/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const registerAccessHandler = require('../api/_registerAccessHandler.cjs')

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'register-access-dev-api',
      configureServer(server) {
        server.middlewares.use('/api/register-access', (req, res) => {
          res.status = (statusCode) => {
            res.statusCode = statusCode
            return res
          }
          res.json = (body) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(body))
          }

          void registerAccessHandler(req, res)
        })
      },
    },
  ],
  css: {
    // Keep production CSS output predictable for backdrop blur rules.
    // This avoids optimizer transformations that can drop unprefixed
    // `backdrop-filter` in some generated selectors.
    transformer: 'postcss',
  },
  build: {
    cssMinify: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: {
      host: 'localhost',
    },
  },
})
