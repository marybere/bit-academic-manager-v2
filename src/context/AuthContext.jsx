import { createContext, useContext, useState, useEffect } from 'react'
import authService from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null)
  const [loading, setLoading] = useState(true)  // true while validating token on mount

  // On mount: if a token exists, validate it with /auth/me
  useEffect(() => {
    const validate = async () => {
      if (!authService.isAuthenticated()) {
        setLoading(false)
        return
      }
      try {
        const me = await authService.getCurrentUser()
        setUser(me)
      } catch {
        // Token invalid/expired — clean up silently
        localStorage.removeItem('token')
        localStorage.removeItem('user')
        setUser(null)
      } finally {
        setLoading(false)
      }
    }
    validate()
  }, [])

  const login = async (email, password) => {
    const loggedInUser = await authService.login(email, password)
    setUser(loggedInUser)
    return loggedInUser
  }

  const logout = () => {
    setUser(null)
    authService.logout()
  }

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Convenience hook
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
