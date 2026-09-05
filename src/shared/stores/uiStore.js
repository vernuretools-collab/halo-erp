import { create } from 'zustand'

const getInitialTheme = () => {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem('app-theme')
  if (saved) return saved
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const applyTheme = (theme) => {
  if (typeof window === 'undefined') return
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  localStorage.setItem('app-theme', theme)
}

// Apply theme immediately on store creation
const initialTheme = getInitialTheme()
applyTheme(initialTheme)

export const useUIStore = create((set, get) => ({
  sidebarOpen: true,
  activeModule: 'dashboard',
  theme: initialTheme,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setActiveModule: (activeModule) => set({ activeModule }),
  setTheme: (theme) => {
    applyTheme(theme)
    set({ theme })
  },
  toggleTheme: () => {
    const current = get().theme
    const nextTheme = current === 'dark' ? 'light' : 'dark'
    applyTheme(nextTheme)
    set({ theme: nextTheme })
  },
}))

