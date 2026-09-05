import { create } from 'zustand'

const STORAGE_KEY = 'crm_wellness_settings'

// Default wellness reminder definitions
export const WELLNESS_REMINDERS = [
  {
    id: 'hydration',
    name: 'Hydration Check',
    description: 'Drink a glass of water to stay hydrated',
    icon: 'Droplets',
    defaultInterval: 60, // minutes
    message: 'Time to drink some water! Stay hydrated.',
    color: 'sky',
  },
  {
    id: 'stretch',
    name: 'Stretch Break',
    description: 'Stand up and stretch your muscles',
    icon: 'StretchHorizontal',
    defaultInterval: 90,
    message: 'Stand up and stretch for 2 minutes! Your body will thank you.',
    color: 'violet',
  },
  {
    id: 'eye_rest',
    name: 'Eye Rest (20-20-20)',
    description: 'Look at something 20 feet away for 20 seconds',
    icon: 'Eye',
    defaultInterval: 20,
    message: 'Look at something 20 feet away for 20 seconds.',
    color: 'cyan',
  },
  {
    id: 'walk',
    name: 'Walk Break',
    description: 'Take a short walk to boost creativity',
    icon: 'Footprints',
    defaultInterval: 120,
    message: 'Take a 5-minute walk. Movement boosts creativity!',
    color: 'emerald',
  },
  {
    id: 'breathing',
    name: 'Deep Breathing',
    description: 'Practice box breathing: inhale 4s, hold 4s, exhale 4s',
    icon: 'Wind',
    defaultInterval: 90,
    message: 'Take 5 deep breaths. Inhale 4s, hold 4s, exhale 4s.',
    color: 'teal',
  },
  {
    id: 'snack',
    name: 'Healthy Snack',
    description: 'Fuel your brain with a nutritious snack',
    icon: 'Apple',
    defaultInterval: 180,
    message: 'Fuel your brain with a healthy snack.',
    color: 'rose',
  },
  {
    id: 'mood',
    name: 'Mood Check-in',
    description: 'Reflect on how you are feeling right now',
    icon: 'Smile',
    defaultInterval: 180,
    message: 'How are you feeling? Take a moment to reflect.',
    color: 'amber',
  },
  {
    id: 'posture',
    name: 'Posture Check',
    description: 'Sit up straight, shoulders back, feet flat',
    icon: 'AlignVerticalSpaceAround',
    defaultInterval: 45,
    message: 'Check your posture! Sit up straight, shoulders back.',
    color: 'indigo',
  },
]

// Build default settings map from WELLNESS_REMINDERS
const buildDefaultReminderSettings = () => {
  const map = {}
  WELLNESS_REMINDERS.forEach((r) => {
    map[r.id] = {
      enabled: true, // all enabled by default per user request
      interval: r.defaultInterval,
    }
  })
  return map
}

const DEFAULT_STATE = {
  globalEnabled: true,
  reminderSettings: buildDefaultReminderSettings(),
  workHoursStart: '10:30', // 10:30 AM
  workHoursEnd: '19:00', // 7:00 PM
  snoozedUntil: null, // ISO timestamp or null
  notificationPermission: 'default', // 'default' | 'granted' | 'denied'
  hydrationCount: 0, // glasses of water today
  hydrationDate: new Date().toISOString().split('T')[0],
  lastFiredAt: {}, // { [reminderId]: ISO timestamp }
}

const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      // Reset hydration count if the date changed
      const today = new Date().toISOString().split('T')[0]
      if (parsed.hydrationDate !== today) {
        parsed.hydrationCount = 0
        parsed.hydrationDate = today
      }
      // Merge with defaults in case new reminders were added
      const mergedSettings = { ...buildDefaultReminderSettings(), ...parsed.reminderSettings }
      return { ...DEFAULT_STATE, ...parsed, reminderSettings: mergedSettings }
    }
  } catch {
    // ignore parse errors
  }
  return DEFAULT_STATE
}

const saveToStorage = (state) => {
  try {
    const toSave = {
      globalEnabled: state.globalEnabled,
      reminderSettings: state.reminderSettings,
      workHoursStart: state.workHoursStart,
      workHoursEnd: state.workHoursEnd,
      snoozedUntil: state.snoozedUntil,
      notificationPermission: state.notificationPermission,
      hydrationCount: state.hydrationCount,
      hydrationDate: state.hydrationDate,
      lastFiredAt: state.lastFiredAt,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch {
    // ignore storage errors
  }
}

export const useWellnessStore = create((set, get) => ({
  ...loadFromStorage(),

  // Toggle global on/off
  setGlobalEnabled: (enabled) => {
    set({ globalEnabled: enabled })
    saveToStorage(get())
  },

  // Toggle individual reminder
  toggleReminder: (reminderId) => {
    set((state) => {
      const current = state.reminderSettings[reminderId]
      if (!current) return state
      const updated = {
        ...state.reminderSettings,
        [reminderId]: { ...current, enabled: !current.enabled },
      }
      return { reminderSettings: updated }
    })
    saveToStorage(get())
  },

  // Set individual reminder interval (minutes)
  setReminderInterval: (reminderId, interval) => {
    set((state) => {
      const current = state.reminderSettings[reminderId]
      if (!current) return state
      const updated = {
        ...state.reminderSettings,
        [reminderId]: { ...current, interval: Math.max(1, Number(interval)) },
      }
      return { reminderSettings: updated }
    })
    saveToStorage(get())
  },

  // Work hours
  setWorkHours: (start, end) => {
    set({ workHoursStart: start, workHoursEnd: end })
    saveToStorage(get())
  },

  // Snooze
  snooze: (durationMinutes) => {
    const until = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString()
    set({ snoozedUntil: until })
    saveToStorage(get())
  },

  snoozeRestOfDay: () => {
    const endOfDay = new Date()
    endOfDay.setHours(23, 59, 59, 999)
    set({ snoozedUntil: endOfDay.toISOString() })
    saveToStorage(get())
  },

  clearSnooze: () => {
    set({ snoozedUntil: null })
    saveToStorage(get())
  },

  isSnoozed: () => {
    const { snoozedUntil } = get()
    if (!snoozedUntil) return false
    return new Date(snoozedUntil) > new Date()
  },

  // Notification permission
  setNotificationPermission: (permission) => {
    set({ notificationPermission: permission })
    saveToStorage(get())
  },

  // Hydration tracker
  incrementHydration: () => {
    const today = new Date().toISOString().split('T')[0]
    set((state) => ({
      hydrationCount: state.hydrationDate === today ? state.hydrationCount + 1 : 1,
      hydrationDate: today,
    }))
    saveToStorage(get())
  },

  decrementHydration: () => {
    set((state) => ({
      hydrationCount: Math.max(0, state.hydrationCount - 1),
    }))
    saveToStorage(get())
  },

  // Track last fired time for each reminder
  setLastFired: (reminderId) => {
    set((state) => ({
      lastFiredAt: { ...state.lastFiredAt, [reminderId]: new Date().toISOString() },
    }))
    saveToStorage(get())
  },

  // Check if within work hours
  isWithinWorkHours: () => {
    const { workHoursStart, workHoursEnd } = get()
    if (!workHoursStart || !workHoursEnd) return true

    const now = new Date()
    const [startH, startM] = workHoursStart.split(':').map(Number)
    const [endH, endM] = workHoursEnd.split(':').map(Number)
    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    const startMinutes = startH * 60 + startM
    const endMinutes = endH * 60 + endM

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes
    } else {
      // Overnight work hours (e.g. 22:00 to 06:00)
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes
    }
  },

  // Get next reminder info (for widget countdown)
  getNextReminder: () => {
    const { reminderSettings, lastFiredAt, globalEnabled } = get()
    if (!globalEnabled) return null

    let earliest = null
    let earliestTime = Infinity

    WELLNESS_REMINDERS.forEach((r) => {
      const settings = reminderSettings[r.id]
      if (!settings?.enabled) return

      const lastFired = lastFiredAt[r.id] ? new Date(lastFiredAt[r.id]).getTime() : null
      const nextFire = lastFired
        ? lastFired + settings.interval * 60 * 1000
        : Date.now() + settings.interval * 60 * 1000

      if (nextFire < earliestTime) {
        earliestTime = nextFire
        earliest = { ...r, nextFireAt: nextFire }
      }
    })

    return earliest
  },
})
)
