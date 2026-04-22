import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const ROLE_ROUTES = {
  ADMIN:       '/admin/settings',
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
  const [rememberMe,   setRememberMe]   = useState(false)

  // Forgot password
  const [showForgotModal, setShowForgotModal] = useState(false)
  const [forgotEmail,     setForgotEmail]     = useState('')
  const [forgotLoading,   setForgotLoading]   = useState(false)
  const [forgotSuccess,   setForgotSuccess]   = useState(false)
  const [forgotError,     setForgotError]     = useState('')

  // Create account info
  const [showContactMsg, setShowContactMsg] = useState(false)

  // Pre-fill remembered email on mount
  useEffect(() => {
    const remembered = localStorage.getItem('remembered_email')
    if (remembered) {
      setEmail(remembered)
      setRememberMe(true)
    }
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const user = await login(email.trim(), password)

      if (rememberMe) {
        localStorage.setItem('remembered_email', email.trim())
      } else {
        localStorage.removeItem('remembered_email')
      }

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

  const closeForgot = () => {
    setShowForgotModal(false)
    setForgotEmail('')
    setForgotSuccess(false)
    setForgotError('')
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

            {/* Remember Me / Forgot Password */}
            <div style={styles.rowBetween}>
              <label style={styles.rememberLabel}>
                <input
                  type="checkbox"
                  id="rememberMe"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#C8184A', cursor: 'pointer' }}
                />
                &nbsp;Remember me
              </label>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                style={styles.linkBtn}
              >
                Forgot password?
              </button>
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

          {/* Create account */}
          {showContactMsg ? (
            <div style={styles.contactMsg}>
              Account creation is managed by the Administrator.
              Please contact your system administrator to create an account.
              <button
                onClick={() => setShowContactMsg(false)}
                style={{ marginLeft: '8px', background: 'none', border: 'none', color: '#C8184A', cursor: 'pointer', fontWeight: 600, fontSize: '12px' }}
              >
                OK
              </button>
            </div>
          ) : (
            <p style={styles.signupRow}>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => setShowContactMsg(true)}
                style={styles.linkBtn}
              >
                Create a new one
              </button>
            </p>
          )}
        </div>
      </div>

      {/* ── Forgot Password Modal ── */}
      {showForgotModal && (
        <div style={styles.modalBackdrop} onClick={closeForgot}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>Forgot Password</h2>
            <p style={styles.modalSubtitle}>
              Enter your email address and we will send you a link to reset your password.
            </p>

            {forgotSuccess ? (
              <div style={styles.successBox}>
                If this email exists in our system, a reset link has been sent. Check your inbox.
              </div>
            ) : (
              <>
                {forgotError && <div style={styles.errorBox}>{forgotError}</div>}
                <input
                  type="email"
                  placeholder="Enter your email address"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleForgotSubmit()}
                  style={styles.modalInput}
                />
                <button
                  onClick={handleForgotSubmit}
                  disabled={forgotLoading}
                  style={{ ...styles.modalPrimaryBtn, opacity: forgotLoading ? 0.7 : 1, cursor: forgotLoading ? 'not-allowed' : 'pointer' }}
                >
                  {forgotLoading ? 'Sending…' : 'Send Reset Link'}
                </button>
              </>
            )}

            <button onClick={closeForgot} style={styles.modalSecondaryBtn}>
              {forgotSuccess ? 'Close' : 'Cancel'}
            </button>
          </div>
        </div>
      )}
    </div>
  )

  async function handleForgotSubmit() {
    if (!forgotEmail.trim()) { setForgotError('Please enter your email'); return }
    setForgotLoading(true)
    setForgotError('')
    try {
      await api.post('/auth/forgot-password', { email: forgotEmail.trim() })
      setForgotSuccess(true)
    } catch {
      setForgotError('Something went wrong. Please try again.')
    } finally {
      setForgotLoading(false)
    }
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────
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
    gap: '4px',
  },
  linkBtn: {
    background: 'none',
    border: 'none',
    color: '#C8184A',
    fontWeight: 500,
    cursor: 'pointer',
    fontSize: '0.8125rem',
    padding: 0,
    fontFamily: 'inherit',
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
    margin: 0,
  },
  contactMsg: {
    textAlign: 'center',
    fontSize: '0.8125rem',
    color: '#475569',
    background: '#f1f5f9',
    borderRadius: '8px',
    padding: '10px 14px',
    lineHeight: 1.5,
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
  // Modal
  modalBackdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: '#fff',
    borderRadius: '14px',
    padding: '32px',
    width: '400px',
    maxWidth: '95vw',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  modalTitle: {
    fontSize: '18px',
    fontWeight: 700,
    color: '#0f172a',
    margin: '0 0 8px',
  },
  modalSubtitle: {
    fontSize: '14px',
    color: '#64748b',
    margin: '0 0 20px',
    lineHeight: 1.5,
  },
  modalInput: {
    width: '100%',
    padding: '11px 14px',
    border: '1.5px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: '16px',
    fontFamily: 'inherit',
  },
  modalPrimaryBtn: {
    width: '100%',
    background: '#C8184A',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '14px',
    fontWeight: 600,
    marginBottom: '10px',
    fontFamily: 'inherit',
  },
  modalSecondaryBtn: {
    width: '100%',
    background: '#f1f5f9',
    color: '#64748b',
    border: 'none',
    borderRadius: '8px',
    padding: '11px',
    fontSize: '14px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  successBox: {
    background: '#dcfce7',
    border: '1px solid #bbf7d0',
    borderRadius: '8px',
    padding: '14px',
    color: '#166534',
    fontSize: '14px',
    textAlign: 'center',
    marginBottom: '16px',
    lineHeight: 1.5,
  },
  errorBox: {
    background: '#fee2e2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#991b1b',
    fontSize: '13px',
    marginBottom: '14px',
  },
}
