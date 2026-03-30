import api from './api'

const TOKEN_KEY = 'token'
const USER_KEY  = 'user'

const authService = {
  // POST /auth/login → save token + user → return user
  async login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem(TOKEN_KEY, data.token)
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    return data.user
  },

  // Clear storage and go to /login
  logout() {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    window.location.href = '/login'
  },

  // GET /auth/me — validates token with backend
  async getCurrentUser() {
    const { data } = await api.get('/auth/me')
    // Refresh the cached user in case anything changed
    localStorage.setItem(USER_KEY, JSON.stringify(data.user))
    return data.user
  },

  // Quick synchronous check — does a token exist?
  isAuthenticated() {
    return !!localStorage.getItem(TOKEN_KEY)
  },

  // Read cached user without hitting the network
  getCachedUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY))
    } catch {
      return null
    }
  },
}

export default authService
