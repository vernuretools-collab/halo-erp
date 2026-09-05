import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { supabaseFirebaseAliases } from '../shared/supabase/viteAliases.js'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss()
  ],
  resolve: {
    alias: supabaseFirebaseAliases(),
  },
  server: {
    port: 3003,
    strictPort: true
  }
})
