import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

const STATUT_STYLE = {
  PRESENT: { bg: '#dcfce7', color: '#166534', label: 'Present' },
  ABSENT:  { bg: '#fee2e2', color: '#991b1b', label: 'Absent'  },
  RETARD:  { bg: '#fef9c3', color: '#854d0e', label: 'Late'    },
  EXCUSE:  { bg: '#e0e7ff', color: '#3730a3', label: 'Excused' },
}

export default function AttendanceHistoryPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [sessions, setSessions]     = useState([])   // [ { date, records: [] } ]
  const [expanded, setExpanded]     = useState(null)  // expanded date string
  const [editing, setEditing]       = useState({})    // { recordId: newStatut }
  const [loading, setLoading]       = useState(true)
  const [savingId, setSavingId]     = useState(null)
  const [error, setError]           = useState('')

  useEffect(() => {
    if (!user?.classe_id) { setLoading(false); return }

    api.get(`/attendances/class/${user.classe_id}`)
      .then(res => {
        // Group records by date
        const byDate = {}
        res.data.attendances.forEach(r => {
          const d = r.date.split('T')[0]
          if (!byDate[d]) byDate[d] = []
          byDate[d].push(r)
        })

        const sorted = Object.entries(byDate)
          .sort(([a], [b]) => new Date(b) - new Date(a))
          .map(([date, records]) => ({ date, records }))

        setSessions(sorted)
        if (sorted.length > 0) setExpanded(sorted[0].date)
      })
      .catch(err => {
        console.error('History load error:', err.message)
        setError('Failed to load attendance history.')
      })
      .finally(() => setLoading(false))
  }, [user])

  const canEdit = (createdAt) => {
    return Date.now() - new Date(createdAt).getTime() < 24 * 60 * 60 * 1000
  }

  const handleStatutChange = (recordId, statut) => {
    setEditing(prev => ({ ...prev, [recordId]: statut }))
  }

  const handleSave = async (recordId) => {
    const statut = editing[recordId]
    if (!statut) return
    setSavingId(recordId)
    try {
      await api.put(`/attendances/${recordId}`, { statut })
      setSessions(prev => prev.map(session => ({
        ...session,
        records: session.records.map(r => r.id === recordId ? { ...r, statut } : r),
      })))
      setEditing(prev => { const next = { ...prev }; delete next[recordId]; return next })
    } catch (err) {
      alert(err.response?.data?.error || 'Update failed.')
    } finally {
      setSavingId(null)
    }
  }

  const formatDate = (dateStr) => new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div style={s.page}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <img src="/icons/bit-logo.png" alt="BIT" style={{width:'36px',height:'36px',objectFit:'contain',borderRadius:'6px',background:'#fff',padding:'3px',flexShrink:0}} />
          <span style={s.logoText}>Academic Manager</span>
        </div>
        <nav style={s.nav}>
          <div style={s.navItem} onClick={() => navigate('/chef/dashboard')}>
            <span className="material-icons" style={s.navIcon}>dashboard</span>
            Dashboard
          </div>
          <div style={s.navItem} onClick={() => navigate('/chef/attendance')}>
            <span className="material-icons" style={s.navIcon}>fact_check</span>
            Take Attendance
          </div>
          <div style={{ ...s.navItem, ...s.navActive }}>
            <span className="material-icons" style={s.navIcon}>history</span>
            History
          </div>
        </nav>
        <div style={s.sidebarBottom}>
          <div style={s.userInfo}>
            <div style={s.avatar}>{user?.prenom?.[0]}{user?.nom?.[0]}</div>
            <div>
              <div style={s.userName}>{user?.prenom} {user?.nom}</div>
              <div style={s.userRole}>Chef de Classe</div>
            </div>
          </div>
          <button style={s.logoutBtn} onClick={logout}>
            <span className="material-icons" style={{ fontSize: '18px' }}>logout</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={s.main}>
        <header style={s.header}>
          <div>
            <h1 style={s.pageTitle}>Attendance History</h1>
            <p style={s.pageSubtitle}>{sessions.length} session{sessions.length !== 1 ? 's' : ''} recorded</p>
          </div>
          <button style={s.newBtn} onClick={() => navigate('/chef/attendance')}>
            <span className="material-icons" style={{ fontSize: '20px', marginRight: '8px' }}>add</span>
            New Session
          </button>
        </header>

        {error && <div style={s.errorMsg}>{error}</div>}

        {loading ? (
          <div style={s.loadingWrap}>Loading history...</div>
        ) : sessions.length === 0 ? (
          <div style={s.emptyState}>
            <span className="material-icons" style={{ fontSize: '48px', color: '#cbd5e1', marginBottom: '12px' }}>event_busy</span>
            <p style={{ margin: 0, color: '#64748b' }}>No attendance sessions recorded yet.</p>
            <button style={s.newBtn2} onClick={() => navigate('/chef/attendance')}>Take First Attendance</button>
          </div>
        ) : (
          <div style={s.sessionList}>
            {sessions.map(session => {
              const presentCount = session.records.filter(r => r.statut === 'PRESENT').length
              const total        = session.records.length
              const rate         = total > 0 ? Math.round(presentCount / total * 100) : 0
              const isOpen       = expanded === session.date

              return (
                <div key={session.date} style={s.sessionCard}>
                  {/* Session header */}
                  <div
                    style={s.sessionHeader}
                    onClick={() => setExpanded(isOpen ? null : session.date)}
                  >
                    <div style={s.sessionLeft}>
                      <span className="material-icons" style={{ color: '#6366f1', marginRight: '10px' }}>event</span>
                      <div>
                        <div style={s.sessionDate}>{formatDate(session.date)}</div>
                        <div style={s.sessionMeta}>
                          {presentCount}/{total} present · {rate}% attendance
                        </div>
                      </div>
                    </div>
                    <div style={s.sessionRight}>
                      <div style={{
                        ...s.rateBadge,
                        background: rate >= 80 ? '#dcfce7' : rate >= 60 ? '#fef9c3' : '#fee2e2',
                        color:      rate >= 80 ? '#166534' : rate >= 60 ? '#854d0e' : '#991b1b',
                      }}>
                        {rate}%
                      </div>
                      <span className="material-icons" style={{ color: '#94a3b8', fontSize: '20px' }}>
                        {isOpen ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>
                  </div>

                  {/* Expanded records */}
                  {isOpen && (
                    <div style={s.recordsWrap}>
                      <table style={s.table}>
                        <thead>
                          <tr>
                            <th style={s.th}>Student</th>
                            <th style={s.th}>Status</th>
                            <th style={s.th}>Edit</th>
                          </tr>
                        </thead>
                        <tbody>
                          {session.records.map(r => {
                            const editable = canEdit(r.created_at)
                            const current  = editing[r.id] || r.statut
                            const style    = STATUT_STYLE[current]

                            return (
                              <tr key={r.id} style={s.tr}>
                                <td style={s.td}>{r.prenom} {r.nom}</td>
                                <td style={s.td}>
                                  <span style={{ ...s.badge, background: style.bg, color: style.color }}>
                                    {style.label}
                                  </span>
                                </td>
                                <td style={s.td}>
                                  {editable ? (
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                      <select
                                        value={current}
                                        onChange={e => handleStatutChange(r.id, e.target.value)}
                                        style={s.select}
                                      >
                                        {Object.entries(STATUT_STYLE).map(([key, val]) => (
                                          <option key={key} value={key}>{val.label}</option>
                                        ))}
                                      </select>
                                      {editing[r.id] && editing[r.id] !== r.statut && (
                                        <button
                                          style={s.saveBtn}
                                          onClick={() => handleSave(r.id)}
                                          disabled={savingId === r.id}
                                        >
                                          {savingId === r.id ? '...' : 'Save'}
                                        </button>
                                      )}
                                    </div>
                                  ) : (
                                    <span style={s.lockedText}>Locked</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

const s = {
  page:         { display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" },
  sidebar:      { width: '240px', background: '#0F1929', display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0 },
  logo:         { display: 'flex', alignItems: 'center', gap: '10px', padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  logoIcon:     { background: '#C8184A', color: '#fff', fontWeight: 700, fontSize: '13px', padding: '4px 8px', borderRadius: '6px' },
  logoText:     { color: '#C8184A', fontSize: '15px', fontWeight: 600 },
  nav:          { flex: 1, padding: '16px 12px' },
  navItem:      { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '14px', cursor: 'pointer', marginBottom: '4px' },
  navActive:    { background: 'rgba(200,24,74,0.15)', color: '#fff' },
  navIcon:      { fontSize: '20px' },
  sidebarBottom:{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '8px' },
  userInfo:     { flex: 1, display: 'flex', alignItems: 'center', gap: '10px' },
  avatar:       { width: '34px', height: '34px', borderRadius: '50%', background: '#C8184A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 },
  userName:     { color: '#fff', fontSize: '13px', fontWeight: 600 },
  userRole:     { color: 'rgba(255,255,255,0.5)', fontSize: '11px' },
  logoutBtn:    { background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '4px' },
  main:         { flex: 1, padding: '32px', overflow: 'auto' },
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' },
  pageTitle:    { fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0 },
  pageSubtitle: { fontSize: '14px', color: '#64748b', margin: '4px 0 0' },
  newBtn:       { display: 'flex', alignItems: 'center', background: '#C8184A', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  errorMsg:     { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '14px', marginBottom: '16px' },
  loadingWrap:  { textAlign: 'center', color: '#94a3b8', padding: '40px' },
  emptyState:   { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', background: '#fff', borderRadius: '12px' },
  newBtn2:      { marginTop: '16px', background: '#C8184A', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  sessionList:  { display: 'flex', flexDirection: 'column', gap: '10px' },
  sessionCard:  { background: '#fff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  sessionHeader:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', cursor: 'pointer' },
  sessionLeft:  { display: 'flex', alignItems: 'center' },
  sessionDate:  { fontSize: '15px', fontWeight: 600, color: '#0f172a', textTransform: 'capitalize' },
  sessionMeta:  { fontSize: '13px', color: '#64748b', marginTop: '2px' },
  sessionRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  rateBadge:    { padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 700 },
  recordsWrap:  { borderTop: '1px solid #f1f5f9', padding: '0 8px 8px' },
  table:        { width: '100%', borderCollapse: 'collapse' },
  th:           { textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #f1f5f9' },
  tr:           { borderBottom: '1px solid #f8fafc' },
  td:           { padding: '10px 12px', fontSize: '14px', color: '#374151' },
  badge:        { padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 },
  select:       { border: '1.5px solid #e2e8f0', borderRadius: '6px', padding: '4px 8px', fontSize: '13px', color: '#374151', background: '#f8fafc', outline: 'none' },
  saveBtn:      { background: '#C8184A', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  lockedText:   { fontSize: '12px', color: '#94a3b8' },
}
