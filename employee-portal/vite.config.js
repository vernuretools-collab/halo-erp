import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { supabaseFirebaseAliases } from '../shared/supabase/viteAliases.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const debugLogPath = path.resolve(__dirname, '..', '.cursor', 'debug-98b944.log')

function agentDebugLogPlugin() {
  return {
    name: 'agent-debug-log',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/__agent_debug_log') return next()
        if (req.method === 'OPTIONS') {
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
          return res.end()
        }
        if (req.method !== 'POST') return next()
        const chunks = []
        req.on('data', (c) => chunks.push(c))
        req.on('end', () => {
          try {
            fs.appendFileSync(debugLogPath, Buffer.concat(chunks).toString('utf8').trim() + '\n')
          } catch (_) {}
          res.statusCode = 204
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end()
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [
    agentDebugLogPlugin(),
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: supabaseFirebaseAliases(),
  },
  server: {
    port: 3002,
    strictPort: true
  }
})
