const apps = new Map()

export function initializeApp(_config, name = '[DEFAULT]') {
  const app = { name, options: _config || {} }
  apps.set(name, app)
  return app
}

export function getApp(name = '[DEFAULT]') {
  if (!apps.has(name)) return initializeApp({}, name)
  return apps.get(name)
}

export async function deleteApp(app) {
  apps.delete(app?.name || '[DEFAULT]')
}

export function getApps() {
  return [...apps.values()]
}
