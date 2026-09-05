import { create } from 'zustand'

export const useUserStore = create((set) => ({
  user: null,             // Firebase Auth user object
  userDoc: null,          // Firestore /users/{uid} document
  claims: null,           // Decoded custom claims
  isLoading: false,       // Default false so dev preview doesn't get stuck
  setUser: (user, userDoc, claims) => set({ user, userDoc, claims, isLoading: false }),
  clearUser: () => set({ user: null, userDoc: null, claims: null, isLoading: false }),
}))
