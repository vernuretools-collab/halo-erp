import { Navigate } from 'react-router-dom'
import { useUserStore } from '../../stores/userStore'
import { employeeCanSeeReels } from '../../../../shared/qc/qcAccess.js'

export function ReelAccess({ children }) {
  const userDoc = useUserStore((state) => state.userDoc)
  if (!employeeCanSeeReels(userDoc)) return <Navigate to="/dashboard" replace />
  return children
}
