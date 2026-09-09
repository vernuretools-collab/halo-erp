import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 1) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = value
  }
}

export function loadMigrateEnv(root) {
  loadEnvFile(resolve(root, '.env'))
  loadEnvFile(resolve(root, '.env.development'))
  loadEnvFile(resolve(root, 'admin-portal/.env'))
  loadEnvFile(resolve(root, 'admin-portal/.env.development'))

  const downloads = resolve(process.env.USERPROFILE || process.env.HOME || '', 'Downloads')
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const keyFile = resolve(downloads, 'supabase-service-role.txt')
    if (existsSync(keyFile)) {
      process.env.SUPABASE_SERVICE_ROLE_KEY = readFileSync(keyFile, 'utf8').trim()
    }
  }
  if (!process.env.SUPABASE_URL && process.env.VITE_SUPABASE_URL) {
    process.env.SUPABASE_URL = process.env.VITE_SUPABASE_URL
  }
}
