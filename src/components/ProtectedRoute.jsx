import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const ROLE_HOME = {
  ADMIN:       '/admin/settings',
  SECRETAIRE:  '/secretaire/dashboard',
  CHEF_CLASSE: '/chef/dashboard',
  STUDENT:     '/etudiant/dashboard',
  DIRECTEUR:   '/directeur/analytics',
  CAISSE:      '/validation',
  IT:          '/validation',
  LABORATOIRE: '/validation',
}

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()

  if (loading) return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'center',
      minHeight:'100vh', color:'#94a3b8', fontSize:'14px',
      fontFamily:"'Inter',sans-serif"
    }}>
      Loading...
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  if (roles && !roles.includes(user.role)) {
    const dest = ROLE_HOME[user.role] || '/login'
    return <Navigate to={dest} replace />
  }

  return children
}
