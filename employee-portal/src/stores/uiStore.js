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
  try {
    window.desktop?.setTheme?.(theme)
  } catch {
    /* ignore */
  }
}

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

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== 'app-theme' || !event.newValue) return
    const nextTheme = event.newValue === 'dark' ? 'dark' : 'light'
    const { theme, setTheme } = useUIStore.getState()
    if (theme === nextTheme) return
    setTheme(nextTheme)
  })
}

