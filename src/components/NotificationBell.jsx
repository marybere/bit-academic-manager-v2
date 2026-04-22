import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

export default function NotificationBell() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread]               = useState(0)
  const [open, setOpen]                   = useState(false)
  const [expanded, setExpanded]           = useState(null)
  const ref = useRef(null)

  const load = useCallback(() => {
    api.get('/notifications/my')
      .then(res => { setNotifications(res.data.notifications || []); setUnread(res.data.unread || 0) })
      .catch(() => {})
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [load])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markRead = async (n) => {
    try {
      // Optimistic: mark as read
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
      if (!n.read) setUnread(prev => Math.max(0, prev - 1))

      await api.put(`/notifications/${n.id}/read`)

      // Remove from list after short delay
      setTimeout(() => {
        setNotifications(prev => prev.filter(x => x.id !== n.id))
      }, 400)

      setOpen(false)

      // Role-based navigation
      if (n.reference_id && n.reference_type === 'REQUEST') {
        const role = user?.role
        const goTo = (path) => {
          if (window.location.pathname === path) {
            // Already on target — force a reload so the page re-fetches fresh data
            window.location.reload()
          } else {
            navigate(path)
          }
        }
        if (role === 'SECRETAIRE' || role === 'ADMIN') {
          navigate(`/secretaire/request/${n.reference_id}`)
        } else if (role === 'STUDENT') {
          navigate(`/etudiant/track/${n.reference_id}`)
        } else if (role === 'CAISSE' || role === 'IT' || role === 'LABORATOIRE') {
          goTo('/validation')
        } else if (role === 'DIRECTEUR') {
          navigate('/directeur/analytics')
        } else if (role === 'CHEF_CLASSE') {
          navigate('/chef/history')
        }
      }
    } catch (err) {
      console.error('markRead error:', err)
    }
  }

  const markAllRead = async () => {
    try {
      setNotifications(prev => prev.map(x => ({ ...x, read: true })))
      setUnread(0)
      await api.put('/notifications/read-all')
      setTimeout(() => setNotifications([]), 800)
    } catch (err) {
      console.error('markAllRead error:', err)
      load()
    }
  }

  const TYPE_COLOR = { SUCCESS: '#10b981', INFO: '#3b82f6', WARNING: '#f59e0b', ERROR: '#ef4444' }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button style={s.bell} onClick={() => setOpen(o => !o)}>
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#C8184A"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unread > 0 && (
          <span style={s.badge}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div style={s.dropdown}>
          <div style={s.dropHeader}>
            <span style={s.dropTitle}>Notifications</span>
            {unread > 0 && (
              <button style={s.markAllBtn} onClick={markAllRead}>Mark all read</button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div style={s.empty}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '8px 0 0' }}>No notifications</p>
            </div>
          ) : (
            <div style={s.list}>
              {notifications.map(n => {
                const isExpanded = expanded === n.id
                const isLong = n.message?.length > 60
                return (
                  <div key={n.id}>
                    {/* Notification row */}
                    <div
                      style={{ ...s.item, background: n.read ? '#fff' : '#f0f9ff' }}
                      onClick={() => setExpanded(isExpanded ? null : n.id)}
                    >
                      <div style={{ ...s.dot, background: TYPE_COLOR[n.type] || '#6366f1' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={s.itemTitle}>{n.title}</div>
                        {n.message && (
                          <div style={s.itemMsg}>
                            {isExpanded || !isLong
                              ? n.message
                              : n.message.slice(0, 60) + '…'}
                          </div>
                        )}
                        <div style={s.itemTime}>{new Date(n.created_at).toLocaleString('fr-FR')}</div>
                      </div>
                      {!n.read && <div style={s.unreadDot} />}
                      {isLong && (
                        <span style={{ fontSize: '10px', color: '#94a3b8', marginLeft: '4px', flexShrink: 0 }}>
                          {isExpanded ? '▲' : '▼'}
                        </span>
                      )}
                    </div>

                    {/* Expanded panel */}
                    {isExpanded && (
                      <div style={{
                        background: '#f8fafc',
                        borderLeft: `3px solid ${TYPE_COLOR[n.type] || '#6366f1'}`,
                        padding: '12px 16px',
                        borderBottom: '1px solid #f1f5f9'
                      }}>
                        <p style={{ fontSize: '13px', color: '#374151', margin: '0 0 12px', lineHeight: '1.5' }}>
                          {n.message}
                        </p>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {n.reference_id && (
                            <button
                              onClick={e => { e.stopPropagation(); markRead(n) }}
                              style={s.viewBtn}
                            >
                              View Request →
                            </button>
                          )}
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              api.put(`/notifications/${n.id}/read`).catch(() => {})
                              setNotifications(prev => prev.filter(x => x.id !== n.id))
                              if (!n.read) setUnread(prev => Math.max(0, prev - 1))
                              setExpanded(null)
                            }}
                            style={s.dismissBtn}
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  bell:       { position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: '8px' },
  badge:      { position: 'absolute', top: '-2px', right: '-2px', background: '#C8184A', color: '#fff', borderRadius: '10px', fontSize: '10px', fontWeight: 700, minWidth: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' },
  dropdown:   { position: 'absolute', right: 0, top: 'calc(100% + 8px)', width: '340px', background: '#fff', borderRadius: '12px', boxShadow: '0 8px 30px rgba(0,0,0,0.18)', zIndex: 200, overflow: 'hidden', border: '1px solid #e2e8f0' },
  dropHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid #f1f5f9' },
  dropTitle:  { fontSize: '14px', fontWeight: 700, color: '#0f172a' },
  markAllBtn: { background: 'none', border: 'none', color: '#C8184A', fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0 },
  empty:      { padding: '32px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  list:       { maxHeight: '360px', overflowY: 'auto' },
  item:       { display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid #f8fafc', transition: 'background 0.1s' },
  dot:        { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginTop: '5px' },
  itemTitle:  { fontSize: '13px', fontWeight: 600, color: '#0f172a' },
  itemMsg:    { fontSize: '12px', color: '#64748b', marginTop: '2px', lineHeight: '1.4' },
  viewBtn:    { background: '#C8184A', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  dismissBtn: { background: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' },
  itemTime:   { fontSize: '11px', color: '#94a3b8', marginTop: '3px' },
  unreadDot:  { width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: '5px' },
}
