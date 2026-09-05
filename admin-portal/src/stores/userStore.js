import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useUserStore = create(
  persist(
    (set) => ({
      user: null,             // Firebase Auth user object or demo user
      userDoc: null,          // Firestore /users/{uid} document
      claims: null,           // Decoded custom claims
      isLoading: false,
      setUser: (user, userDoc, claims) => set({ user, userDoc, claims, isLoading: false }),
      clearUser: () => set({ user: null, userDoc: null, claims: null, isLoading: false }),
      // Patch only displayName without wiping claims or other state
      updateDisplayName: (displayName) =>
        set((state) => ({
          user: state.user ? { ...state.user, displayName } : state.user,
          userDoc: state.userDoc ? { ...state.userDoc, displayName } : { displayName },
        })),
    }),
    {
      name: 'business-os-user-auth',
    }
  )
)
