import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'

export default function NotificationBell() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [unread, setUnread]               = useState(0)
  const [open, setOpen]                   = useState(false)
  const ref = useRef(null)

  const load = () => {
    api.get('/notifications/my')
      .then(res => { setNotifications(res.data.notifications || []); setUnread(res.data.unread || 0) })
      .catch(() => {})
  }

  useEffect(() => {
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const markRead = async (n) => {
    if (!n.read) {
      await api.put(`/notifications/${n.id}/read`).catch(() => {})
      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x))
      setUnread(prev => Math.max(0, prev - 1))
    }
    if (n.reference_type === 'REQUEST' && n.reference_id) {
      setOpen(false)
      navigate(`/secretaire/request/${n.reference_id}`)
    }
  }

  const markAllRead = async () => {
    await api.put('/notifications/read-all').catch(() => {})
    setNotifications(prev => prev.map(x => ({ ...x, read: true })))
    setUnread(0)
  }

  const TYPE_COLOR = { SUCCESS: '#10b981', INFO: '#3b82f6', WARNING: '#f59e0b', ERROR: '#ef4444' }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button style={s.bell} onClick={() => setOpen(o => !o)}>
        <span className="material-icons" style={{ fontSize: '22px', color: 'rgba(255,255,255,0.7)' }}>notifications</span>
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
              <span className="material-icons" style={{ fontSize: '32px', color: '#cbd5e1' }}>notifications_none</span>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '8px 0 0' }}>No notifications</p>
            </div>
          ) : (
            <div style={s.list}>
              {notifications.map(n => (
                <div key={n.id} style={{ ...s.item, background: n.read ? '#fff' : '#f0f9ff' }}
                  onClick={() => markRead(n)}>
                  <div style={{ ...s.dot, background: TYPE_COLOR[n.type] || '#6366f1' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.itemTitle}>{n.title}</div>
                    {n.message && <div style={s.itemMsg}>{n.message}</div>}
                    <div style={s.itemTime}>{new Date(n.created_at).toLocaleString('fr-FR')}</div>
                  </div>
                  {!n.read && <div style={s.unreadDot} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const s = {
  bell:       { position: 'relative', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' },
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
  itemMsg:    { fontSize: '12px', color: '#64748b', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  itemTime:   { fontSize: '11px', color: '#94a3b8', marginTop: '3px' },
  unreadDot:  { width: '8px', height: '8px', borderRadius: '50%', background: '#3b82f6', flexShrink: 0, marginTop: '5px' },
}
