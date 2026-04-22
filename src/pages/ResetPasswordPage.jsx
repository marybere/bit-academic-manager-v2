import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../services/api'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [password,     setPassword]     = useState('')
  const [confirm,      setConfirm]      = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm,  setShowConfirm]  = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState(false)

  useEffect(() => {
    if (!token) navigate('/login')
  }, [token, navigate])

  const handleReset = async () => {
    if (!password || password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    setError('')
    try {
      await api.post('/auth/reset-password', { token, password })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 3000)
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid or expired link')
    } finally {
      setLoading(false)
    }
  }

  if (success) return (
    <div style={s.page}>
      <div style={{ ...s.card, textAlign: 'center', padding: '48px 40px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
        <h2 style={{ color: '#166534', marginBottom: '8px', fontSize: '20px' }}>
          Password Reset Successfully!
        </h2>
        <p style={{ color: '#64748b', fontSize: '14px', margin: 0 }}>
          Redirecting to login page…
        </p>
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{ fontSize: '36px', fontWeight: 800, color: '#C8184A' }}>bit</div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '8px 0 4px' }}>
            Reset Your Password
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            Enter your new password below
          </p>
        </div>

        {error && <div style={s.errorBox}>{error}</div>}

        <label style={s.label}>New Password</label>
        <div style={s.fieldWrap}>
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Min. 6 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={s.input}
          />
          <EyeBtn show={showPassword} toggle={() => setShowPassword(p => !p)} />
        </div>

        <label style={s.label}>Confirm Password</label>
        <div style={{ ...s.fieldWrap, marginBottom: '24px' }}>
          <input
            type={showConfirm ? 'text' : 'password'}
            placeholder="Repeat your password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleReset()}
            style={s.input}
          />
          <EyeBtn show={showConfirm} toggle={() => setShowConfirm(p => !p)} />
        </div>

        <button
          onClick={handleReset}
          disabled={loading}
          style={{ ...s.btn, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
        >
          {loading ? 'Resetting…' : 'Reset Password'}
        </button>
      </div>
    </div>
  )
}

function EyeBtn({ show, toggle }) {
  return (
    <button type="button" onClick={toggle} style={s.eyeBtn}>
      {show ? (
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
  )
}

const s = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8fafc',
    fontFamily: "'Inter', sans-serif",
  },
  card: {
    background: '#fff',
    borderRadius: '14px',
    padding: '40px',
    width: '400px',
    maxWidth: '95vw',
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: '#374151',
    display: 'block',
    marginBottom: '6px',
  },
  fieldWrap: {
    position: 'relative',
    marginBottom: '16px',
  },
  input: {
    width: '100%',
    padding: '11px 44px 11px 14px',
    border: '1.5px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    background: '#f8fafc',
    color: '#0f172a',
  },
  eyeBtn: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#94a3b8',
    display: 'flex',
    alignItems: 'center',
    padding: '4px',
  },
  btn: {
    width: '100%',
    background: '#C8184A',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '13px',
    fontSize: '15px',
    fontWeight: 600,
    fontFamily: 'inherit',
  },
  errorBox: {
    background: '#fee2e2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    padding: '10px 14px',
    color: '#991b1b',
    fontSize: '13px',
    marginBottom: '16px',
  },
}
