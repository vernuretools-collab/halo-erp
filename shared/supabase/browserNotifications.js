const ANNOUNCEMENT_SOUND = '/sounds/announcement.wav'
const ICON = '/halologo.png'

const recentlyShown = new Set()
const suppressedAnnouncementIds = new Set()

export const ensureNotificationPermission = async () => {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  try {
    return await Notification.requestPermission()
  } catch {
    return 'denied'
  }
}

export const ensureNotificationServiceWorker = async () => {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return null
  try {
    const existing = await navigator.serviceWorker.getRegistration('/notification-sw.js')
    if (existing) return existing
    return await navigator.serviceWorker.register('/notification-sw.js')
  } catch (err) {
    console.warn('Notification service worker failed to register:', err.message)
    return null
  }
}

export const unlockAnnouncementAudio = () => {
  if (typeof navigator !== 'undefined' && navigator.userActivation && !navigator.userActivation.isActive) {
    return
  }
  try {
    const audio = new Audio(ANNOUNCEMENT_SOUND)
    audio.volume = 0
    void audio
      .play()
      .then(() => {
        audio.pause()
        audio.currentTime = 0
      })
      .catch(() => {})
  } catch {
    // ignore
  }
}

export const playAnnouncementChime = () => {
  const playOscillator = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      if (ctx.state === 'suspended') void ctx.resume()
      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, now)
      osc.frequency.setValueAtTime(1174.7, now + 0.18)
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.42)
    } catch {
      // ignore
    }
  }

  try {
    const audio = new Audio(ANNOUNCEMENT_SOUND)
    audio.volume = 0.7
    void audio.play().catch(playOscillator)
  } catch {
    playOscillator()
  }
}

export const closeAnnouncementNotification = (announcementId) => {
  if (!announcementId) return
  const id = String(announcementId)
  suppressedAnnouncementIds.add(id)
  const tag = `announcement-${id}`
  recentlyShown.add(tag)

  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
  void navigator.serviceWorker.ready
    .then((reg) => reg.getNotifications({ tag }))
    .then((list) => list.forEach((n) => n.close()))
    .catch(() => {})
}

export const showForegroundBrowserNotification = async (payload) => {
  const type = payload?.data?.type
  if (type === 'announcement_deleted') {
    closeAnnouncementNotification(payload?.data?.announcementId)
    return
  }

  const title =
    payload?.notification?.title ||
    payload?.data?.title ||
    (type === 'payslip'
      ? 'Check your balance'
      : type === 'wellness'
        ? 'Wellness reminder'
        : type === 'project'
          ? payload?.data?.tag?.startsWith('project-assigned-')
            ? 'Assigned to a project'
            : 'New project created'
          : type === 'task'
            ? 'Task status updated'
            : 'New Announcement')
  const body = payload?.notification?.body || payload?.data?.body || payload?.data?.message || ''
  const link =
    payload?.data?.link ||
    (type === 'payslip'
      ? '/payslips'
      : type === 'wellness'
        ? '/wellness'
        : type === 'project'
          ? '/projects/list'
          : type === 'task'
            ? '/tasks'
            : '/announcements')
  const announcementId = payload?.data?.announcementId ? String(payload.data.announcementId) : ''
  const tag =
    payload?.data?.tag ||
    (announcementId
      ? `announcement-${announcementId}`
      : type === 'payslip' && payload?.data?.month && payload?.data?.year
        ? `payslip-${payload.data.year}-${payload.data.month}`
        : `${type || 'notice'}-${title}`)

  if (announcementId && suppressedAnnouncementIds.has(announcementId)) return
  if (recentlyShown.has(tag)) return
  recentlyShown.add(tag)
  setTimeout(() => recentlyShown.delete(tag), 30000)

  if (type !== 'wellness') playAnnouncementChime()

  const permission = await ensureNotificationPermission()
  if (permission !== 'granted') return

  const options = {
    body,
    icon: ICON,
    tag,
    silent: false,
    data: { url: link },
  }

  try {
    const notif = new Notification(title, options)
    notif.onclick = () => {
      window.focus()
      window.location.assign(link)
      notif.close()
    }
    setTimeout(() => notif.close(), 12000)
    return
  } catch {
    // fall through to service worker
  }

  try {
    const reg = await ensureNotificationServiceWorker()
    const ready = (await navigator.serviceWorker?.ready) || reg
    if (ready?.showNotification) {
      await ready.showNotification(title, options)
    }
  } catch {
    // In-app bell still updates via inbox documents.
  }
}

export const showForegroundAnnouncementNotification = (payload) =>
  showForegroundBrowserNotification(payload)

export const armBrowserNotifications = async () => {
  unlockAnnouncementAudio()
  const permission = await ensureNotificationPermission()
  await ensureNotificationServiceWorker()
  return permission
}
