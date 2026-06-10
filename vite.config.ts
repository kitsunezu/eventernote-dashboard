import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'path'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Dev-only Vite plugin that provides POST /api/places-cache.
 * Merges incoming { [placeId]: PlaceEntry } objects into public/places-cache.json
 * so newly discovered venues are persisted across dev sessions and committed to the repo.
 * In production (Nginx) this endpoint does not exist; the frontend silently falls back.
 */
function placeCachePlugin(): Plugin {
  const cacheFile = resolve(__dirname, 'public/places-cache.json')
  return {
    name: 'place-cache-server',
    configureServer(server) {
      server.middlewares.use('/api/places-cache', (req, res, next) => {
        if (req.method !== 'POST') {
          next()
          return
        }
        let body = ''
        req.on('data', (chunk: Buffer) => { body += chunk.toString() })
        req.on('end', () => {
          try {
            const newEntries = JSON.parse(body) as Record<string, unknown>
            let current: Record<string, unknown> = {}
            try { current = JSON.parse(readFileSync(cacheFile, 'utf-8')) } catch { /* new file */ }
            writeFileSync(cacheFile, JSON.stringify({ ...current, ...newEntries }, null, 2), 'utf-8')
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))
          } catch {
            res.writeHead(400)
            res.end()
          }
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), placeCachePlugin()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        admin: resolve(__dirname, 'admin/index.html'),
      },
    },
  },
  server: {
    proxy: {
      '/api/eventernote': {
        target: 'https://www.eventernote.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/eventernote/, ''),
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept':
            'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'Referer': 'https://www.eventernote.com/',
          'Upgrade-Insecure-Requests': '1',
        },
      },
    },
  },
})
