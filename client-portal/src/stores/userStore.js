import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useUserStore = create(
  persist(
    (set) => ({
      user: null,
      userDoc: null,
      claims: null,
      isLoading: false,
      setUser: (user, userDoc, claims) => set({ user, userDoc, claims, isLoading: false }),
      clearUser: () => set({ user: null, userDoc: null, claims: null, isLoading: false }),
    }),
    {
      name: 'business-os-client-auth',
    }
  )
)
