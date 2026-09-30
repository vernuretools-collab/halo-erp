/** Internal auth address for username-only client accounts. Never shown in the UI. */
export const CLIENT_AUTH_EMAIL_DOMAIN = 'client.halo.local'

export function clientDisplayName(raw) {
  return String(raw || '').trim().replace(/\s+/g, ' ')
}

export function normalizeClientUsername(raw) {
  return clientDisplayName(raw).toLowerCase().replace(/\s+/g, '')
}

export function isValidClientUsername(username) {
  return /^[a-z0-9](?:[a-z0-9._-]{1,30}[a-z0-9])?$/.test(normalizeClientUsername(username))
}

export function usernameToAuthEmail(username) {
  return `${normalizeClientUsername(username)}@${CLIENT_AUTH_EMAIL_DOMAIN}`
}

export function isSyntheticClientEmail(email) {
  return String(email || '').trim().toLowerCase().endsWith(`@${CLIENT_AUTH_EMAIL_DOMAIN}`)
}

/** Real emails pass through. Usernames become the internal auth address. */
export function loginIdentifierToEmail(identifier) {
  const value = String(identifier || '').trim()
  if (!value) return ''
  if (value.includes('@')) return value.toLowerCase()
  return usernameToAuthEmail(value)
}

/** What an admin or client should see as the login name. */
export function clientLoginLabel(record) {
  const displayName = clientDisplayName(record?.displayName)
  if (displayName) return displayName
  const username = normalizeClientUsername(record?.username)
  if (username) return username
  const email = String(record?.email || '').trim()
  if (isSyntheticClientEmail(email)) return email.split('@')[0]
  return email
}
