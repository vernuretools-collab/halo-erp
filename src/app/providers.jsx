import React from 'react'
import { useAuth } from '../features/auth/useAuth'

export const AppProviders = ({ children }) => {
  // Initialize Firebase Auth listener and sync custom claims + org context
  useAuth()

  return <>{children}</>
}
