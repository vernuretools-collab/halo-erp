import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useTeamStore } from '../features/team/stores/teamStore'

export const useUserStore = create(
  persist(
    (set) => ({
      user: null,
      userDoc: null,
      claims: null,
      isLoading: false,
      setUser: (user, userDoc, claims) =>
        set((state) => ({
          user,
          userDoc,
          claims: claims !== null && claims !== undefined ? claims : state.claims,
          isLoading: false,
        })),
      clearUser: () => {
        try {
          useTeamStore.getState().resetAttendanceState()
        } catch (e) {
          console.error('Error resetting attendance state on clearUser:', e)
        }
        set({ user: null, userDoc: null, claims: null, isLoading: false })
      },
    }),
    {
      name: 'business-os-employee-auth',
    }
  )
)

