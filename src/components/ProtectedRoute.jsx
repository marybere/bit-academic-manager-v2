import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Wrap any route that requires authentication (and optionally specific roles).
 *
 * Usage:
 *   <ProtectedRoute>                          // any authenticated user
 *   <ProtectedRoute roles={['SECRETAIRE']}>   // specific role(s) only
 */
export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()

  // Still validating the stored token — render nothing to avoid flash
  if (loading) return null

  // Not logged in
  if (!user) return <Navigate to="/login" replace />

  // Logged in but role not permitted
  if (roles && !roles.includes(user.role)) return <Navigate to="/login" replace />

  return children
}
