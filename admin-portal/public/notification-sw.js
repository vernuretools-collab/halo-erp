self.addEventListener('message', (event) => {
  const payload = event.data || {}
  if (payload.type !== 'SHOW_NOTIFICATION') return
  const title = payload.title || 'Notification'
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || '',
      icon: payload.icon || '/halologo.png',
      tag: payload.tag || 'crm-notification',
      silent: false,
      data: { url: payload.url || '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (typeof client.navigate === 'function') {
            return client.navigate(target).then((c) => (c ? c.focus() : client.focus()))
          }
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        const absolute = target.startsWith('http') ? target : `${self.location.origin}${target}`
        return self.clients.openWindow(absolute)
      }
      return undefined
    })
  )
})
