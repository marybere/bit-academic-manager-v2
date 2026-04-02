import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Role → home route mapping
const ROLE_ROUTES = {
  ADMIN:       '/secretaire/dashboard',
  SECRETAIRE:  '/secretaire/dashboard',
  CHEF_CLASSE: '/chef/dashboard',
  STUDENT:     '/etudiant/dashboard',
  DIRECTEUR:   '/directeur/analytics',
  CAISSE:      '/validation',
  IT:          '/validation',
  LABORATOIRE: '/validation',
}

export default function LoginPage() {
  const { login } = useAuth()
  const navigate  = useNavigate()

  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const user = await login(email.trim(), password)
      const dest = ROLE_ROUTES[user.role] || '/login'
      navigate(dest, { replace: true })
    } catch (err) {
      setError(
        err.response?.data?.error || 'Login failed. Please check your credentials.'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.body}>
      <div style={styles.card}>

        {/* ── LEFT PANEL ── */}
        <div style={styles.leftPanel}>
          <div style={styles.overlay} />
          <div style={styles.leftContent}>
            <h2 style={styles.title}>Burkina Institute<br />of Technology</h2>
            <hr style={styles.divider} />
            <p style={styles.quote}><em>Educating a New Generation of Leaders</em></p>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={styles.rightPanel}>
          <h1 style={styles.heading}>Sign in</h1>
          <p style={styles.subtitle}>Access your academic portal</p>

          <form onSubmit={handleSubmit}>

            {/* Email */}
            <label style={styles.label}>Email address</label>
            <div style={styles.fieldWrap}>
              <span className="material-icons" style={styles.icon}>mail_outline</span>
              <input
                style={styles.input}
                type="email"
                placeholder="name@bit.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            {/* Password */}
            <label style={styles.label}>Password</label>
            <div style={styles.fieldWrap}>
              <span className="material-icons" style={styles.icon}>lock_outline</span>
              <input
                style={{ ...styles.input, paddingRight: '2.75rem' }}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                style={styles.eyeBtn}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>

            {/* Error */}
            {error && <p style={styles.errorMsg}>{error}</p>}

            {/* Remember / Forgot */}
            <div style={styles.rowBetween}>
              <label style={styles.rememberLabel}>
                <input type="checkbox" style={{ accentColor: '#C8184A' }} />
                &nbsp;Remember me
              </label>
              <a href="#" style={styles.link}>Forgot password?</a>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{ ...styles.btn, opacity: loading ? 0.75 : 1 }}
            >
              {loading ? 'Signing in…' : 'Login Now'}
            </button>

          </form>

          <p style={styles.signupRow}>
            Don't have an account?{' '}
            <a href="#" style={styles.link}>Create a new one</a>
          </p>
        </div>
      </div>
    </div>
  )
}

// ── Inline styles (mirrors login.html design) ─────────────────────────────────
const styles = {
  body: {
    minHeight: '100dvh',
    backgroundColor: '#0F1929',
    fontFamily: "'Inter', sans-serif",
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1.5rem',
  },
  card: {
    display: 'flex',
    flexDirection: 'row',
    width: '860px',
    maxWidth: '95vw',
    maxHeight: '520px',
    borderRadius: '16px',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  },
  leftPanel: {
    flex: 1,
    position: 'relative',
    backgroundImage: "url('/screens/assets/campus.jpg')",
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '48px 40px',
    minHeight: '520px',
  },
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(15, 25, 50, 0.55)',
  },
  leftContent: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginTop: '70px',
  },
  title: {
    color: '#fff',
    fontSize: '32px',
    fontWeight: 700,
    lineHeight: 1.3,
    margin: '0 0 1.25rem 0',
  },
  divider: {
    width: '60px',
    height: '5px',
    background: 'rgba(255,255,255,0.45)',
    border: 'none',
    borderRadius: '10px',
    margin: '0 0 1.25rem 0',
  },
  quote: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: '16px',
    margin: 0,
    lineHeight: 1.6,
  },
  rightPanel: {
    flex: 1,
    backgroundColor: '#fff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '48px 44px',
    minHeight: '520px',
  },
  heading: {
    fontSize: '1.75rem',
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 0.375rem 0',
  },
  subtitle: {
    fontSize: '0.875rem',
    color: '#64748b',
    margin: '0 0 2rem 0',
  },
  label: {
    display: 'block',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#374151',
    marginBottom: '0.375rem',
  },
  fieldWrap: {
    position: 'relative',
    marginBottom: '1.25rem',
  },
  icon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#9ca3af',
    fontSize: '18px',
    pointerEvents: 'none',
  },
  input: {
    width: '100%',
    padding: '0.75rem 0.875rem 0.75rem 2.5rem',
    border: '1.5px solid #e2e8f0',
    borderRadius: '8px',
    background: '#f8fafc',
    fontSize: '0.875rem',
    color: '#0f172a',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  errorMsg: {
    color: '#dc2626',
    fontSize: '0.8125rem',
    marginBottom: '0.75rem',
    padding: '0.5rem 0.75rem',
    background: '#fef2f2',
    borderRadius: '6px',
    border: '1px solid #fecaca',
  },
  rowBetween: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '1.5rem',
    fontSize: '0.8125rem',
  },
  rememberLabel: {
    display: 'flex',
    alignItems: 'center',
    color: '#64748b',
    cursor: 'pointer',
  },
  link: {
    color: '#C8184A',
    fontWeight: 500,
    textDecoration: 'none',
  },
  btn: {
    width: '100%',
    padding: '0.8125rem',
    background: '#C8184A',
    color: '#fff',
    fontSize: '0.9375rem',
    fontWeight: 600,
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    marginBottom: '1.5rem',
    fontFamily: 'inherit',
    transition: 'background 0.15s',
  },
  signupRow: {
    textAlign: 'center',
    fontSize: '0.8125rem',
    color: '#64748b',
  },
  eyeBtn: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    color: '#9ca3af',
    display: 'flex',
    alignItems: 'center',
  },
}
