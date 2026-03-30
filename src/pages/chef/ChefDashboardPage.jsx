import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import NotificationBell from '../../components/NotificationBell'

export default function ChefDashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats]             = useState(null)
  const [lastSession, setLastSession]  = useState(null)
  const [classInfo, setClassInfo]      = useState(null)   // { class, students }
  const [downloading, setDownloading]  = useState(false)
  const [loading, setLoading]          = useState(true)

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  useEffect(() => {
    if (!user?.classe_id) { setLoading(false); return }

    const fetchData = async () => {
      try {
        const [statsRes, historyRes, classRes] = await Promise.all([
          api.get(`/attendances/stats/${user.classe_id}`),
          api.get(`/attendances/class/${user.classe_id}`),
          api.get(`/classes/${user.classe_id}/students`),
        ])
        setClassInfo(classRes.data)
        setStats(statsRes.data)

        // Find most recent session date
        const dates = [...new Set(historyRes.data.attendances.map(a => a.date))]
          .sort((a, b) => new Date(b) - new Date(a))
        if (dates.length > 0) {
          const lastDate = dates[0]
          const sessionRows = historyRes.data.attendances.filter(a => a.date === lastDate)
          const presentCount = sessionRows.filter(a => a.statut === 'PRESENT').length
          setLastSession({
            date: new Date(lastDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }),
            total: sessionRows.length,
            present: presentCount,
          })
        }
      } catch (err) {
        console.error('Dashboard load error:', err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [user])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await api.get(`/classes/${user.classe_id}/students/export`, { responseType: 'blob' })
      const cls = classInfo?.class
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      const a   = document.createElement('a')
      a.href    = url
      a.download = `class-${cls?.filiere || ''}-${cls?.niveau || ''}-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      // Refresh class info to update list_downloaded_at
      const refresh = await api.get(`/classes/${user.classe_id}/students`)
      setClassInfo(refresh.data)
    } catch (err) {
      console.error('Download failed:', err.message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div style={s.page}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <img src="/icons/bit-logo.png" alt="BIT" style={{width:'36px',height:'36px',objectFit:'contain',borderRadius:'6px',background:'#fff',padding:'3px',flexShrink:0}} />
          <span style={s.logoText}>Academic Manager</span>
        </div>

        <nav style={s.nav}>
          <div style={{ ...s.navItem, ...s.navActive }}>
            <span className="material-icons" style={s.navIcon}>dashboard</span>
            Dashboard
          </div>
          <div style={s.navItem} onClick={() => navigate('/chef/attendance')}>
            <span className="material-icons" style={s.navIcon}>fact_check</span>
            Take Attendance
          </div>
          <div style={s.navItem} onClick={() => navigate('/chef/history')}>
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
            <h1 style={s.pageTitle}>Dashboard</h1>
            <p style={s.pageSubtitle}>{today}</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <NotificationBell />
            <button style={s.attendanceBtn} onClick={() => navigate('/chef/attendance')}>
              <span className="material-icons" style={{ fontSize: '20px', marginRight: '8px' }}>add_circle</span>
              Take Attendance
            </button>
          </div>
        </header>

        {/* Class list update banner */}
        {classInfo && (() => {
          const cls = classInfo.class
          const updated  = cls.list_updated_at  ? new Date(cls.list_updated_at)  : null
          const downloaded = cls.list_downloaded_at ? new Date(cls.list_downloaded_at) : null
          const needsRedownload = updated && (!downloaded || updated > downloaded)
          return needsRedownload ? (
            <div style={s.updateBanner}>
              <span className="material-icons" style={{ fontSize: '18px', marginRight: '8px' }}>warning</span>
              Class list was updated since your last download — please re-download.
              <button style={s.bannerBtn} onClick={handleDownload}>Re-download now</button>
            </div>
          ) : null
        })()}

        {loading ? (
          <div style={s.loadingWrap}>
            <span className="material-icons" style={s.loadingIcon}>hourglass_empty</span>
            <p>Loading...</p>
          </div>
        ) : (
          <>
            {/* Stats cards */}
            <div style={s.statsGrid}>
              <StatCard
                icon="school"
                label="Total Students"
                value={stats?.students?.length ?? '—'}
                color="#3b82f6"
              />
              <StatCard
                icon="event_note"
                label="Sessions Held"
                value={stats?.total_sessions ?? '—'}
                color="#8b5cf6"
              />
              <StatCard
                icon="trending_up"
                label="Avg Presence"
                value={stats ? `${stats.avg_presence_rate}%` : '—'}
                color="#10b981"
              />
              <StatCard
                icon="warning"
                label="At-Risk Students"
                value={stats?.at_risk_students?.length ?? '—'}
                color="#ef4444"
              />
            </div>

            {/* Class list card */}
            {classInfo && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <span className="material-icons" style={{ color: '#3b82f6', marginRight: '8px' }}>list_alt</span>
                  <h2 style={s.cardTitle}>Class List</h2>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={s.classNameBadge}>{classInfo.class.nom}</span>
                    <span style={{ fontSize: '13px', color: '#64748b' }}>{classInfo.students.length} students</span>
                  </div>
                </div>
                <div style={s.downloadRow}>
                  <button
                    style={{ ...s.downloadBtn, opacity: downloading ? 0.7 : 1 }}
                    onClick={handleDownload}
                    disabled={downloading}
                  >
                    <span className="material-icons" style={{ fontSize: '18px', marginRight: '6px' }}>download</span>
                    {downloading ? 'Downloading...' : 'Download Class List (CSV)'}
                  </button>
                  {classInfo.class.list_downloaded_at && (
                    <span style={s.lastDownload}>
                      Last downloaded: {new Date(classInfo.class.list_downloaded_at).toLocaleString('fr-FR')}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Last session card */}
            {lastSession && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <span className="material-icons" style={{ color: '#6366f1', marginRight: '8px' }}>event</span>
                  <h2 style={s.cardTitle}>Last Session</h2>
                </div>
                <div style={s.lastSessionBody}>
                  <div style={s.sessionDate}>{lastSession.date}</div>
                  <div style={s.sessionStats}>
                    <span style={{ ...s.sessionBadge, background: '#dcfce7', color: '#166534' }}>
                      {lastSession.present} Present
                    </span>
                    <span style={{ ...s.sessionBadge, background: '#fee2e2', color: '#991b1b' }}>
                      {lastSession.total - lastSession.present} Absent
                    </span>
                    <span style={{ ...s.sessionBadge, background: '#f1f5f9', color: '#475569' }}>
                      {lastSession.total} Total
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* At-risk students */}
            {stats?.at_risk_students?.length > 0 && (
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <span className="material-icons" style={{ color: '#ef4444', marginRight: '8px' }}>warning</span>
                  <h2 style={s.cardTitle}>At-Risk Students (&gt;20% absences)</h2>
                </div>
                <table style={s.table}>
                  <thead>
                    <tr>
                      <th style={s.th}>Student</th>
                      <th style={s.th}>Absences</th>
                      <th style={s.th}>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.at_risk_students.map(st => (
                      <tr key={st.id} style={s.tr}>
                        <td style={s.td}>{st.prenom} {st.nom}</td>
                        <td style={s.td}>{st.absences}</td>
                        <td style={s.td}>
                          <span style={{ ...s.badge, background: '#fee2e2', color: '#991b1b' }}>
                            {st.absence_rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!user?.classe_id && (
              <div style={s.noClass}>
                No class assigned to your account. Contact an administrator.
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={s.statCard}>
      <div style={{ ...s.statIcon, background: color + '20', color }}>
        <span className="material-icons">{icon}</span>
      </div>
      <div>
        <div style={s.statValue}>{value}</div>
        <div style={s.statLabel}>{label}</div>
      </div>
    </div>
  )
}

const s = {
  page:        { display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" },
  sidebar:     { width: '240px', background: '#0F1929', display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0 },
  logo:        { display: 'flex', alignItems: 'center', gap: '10px', padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  logoIcon:    { background: '#C8184A', color: '#fff', fontWeight: 700, fontSize: '13px', padding: '4px 8px', borderRadius: '6px' },
  logoText:    { color: '#C8184A', fontSize: '15px', fontWeight: 600 },
  nav:         { flex: 1, padding: '16px 12px' },
  navItem:     { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '14px', cursor: 'pointer', marginBottom: '4px', transition: 'all 0.15s' },
  navActive:   { background: 'rgba(200,24,74,0.15)', color: '#fff' },
  navIcon:     { fontSize: '20px' },
  sidebarBottom: { padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '8px' },
  userInfo:    { flex: 1, display: 'flex', alignItems: 'center', gap: '10px' },
  avatar:      { width: '34px', height: '34px', borderRadius: '50%', background: '#C8184A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 },
  userName:    { color: '#fff', fontSize: '13px', fontWeight: 600 },
  userRole:    { color: 'rgba(255,255,255,0.5)', fontSize: '11px' },
  logoutBtn:   { background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '4px' },
  main:        { flex: 1, padding: '32px', overflow: 'auto' },
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' },
  pageTitle:   { fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0 },
  pageSubtitle:{ fontSize: '14px', color: '#64748b', margin: '4px 0 0', textTransform: 'capitalize' },
  attendanceBtn: { display: 'flex', alignItems: 'center', background: '#C8184A', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  statsGrid:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' },
  statCard:    { background: '#fff', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  statIcon:    { width: '48px', height: '48px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statValue:   { fontSize: '24px', fontWeight: 700, color: '#0f172a' },
  statLabel:   { fontSize: '12px', color: '#64748b', marginTop: '2px' },
  card:        { background: '#fff', borderRadius: '12px', padding: '20px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  cardHeader:  { display: 'flex', alignItems: 'center', marginBottom: '16px' },
  cardTitle:   { fontSize: '16px', fontWeight: 600, color: '#0f172a', margin: 0 },
  lastSessionBody: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' },
  sessionDate: { fontSize: '15px', color: '#374151', fontWeight: 500 },
  sessionStats:{ display: 'flex', gap: '8px', flexWrap: 'wrap' },
  sessionBadge:{ padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 500 },
  table:       { width: '100%', borderCollapse: 'collapse' },
  th:          { textAlign: 'left', padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #f1f5f9', textTransform: 'uppercase', letterSpacing: '0.04em' },
  tr:          { borderBottom: '1px solid #f8fafc' },
  td:          { padding: '12px', fontSize: '14px', color: '#374151' },
  badge:       { padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 },
  noClass:        { background: '#fef9c3', border: '1px solid #fde047', borderRadius: '8px', padding: '16px', color: '#854d0e', fontSize: '14px' },
  loadingWrap:    { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: '#94a3b8' },
  loadingIcon:    { fontSize: '40px', marginBottom: '8px', animation: 'spin 1s linear infinite' },
  updateBanner:   { display: 'flex', alignItems: 'center', background: '#fef9c3', border: '1px solid #fde047', borderRadius: '8px', padding: '10px 16px', color: '#854d0e', fontSize: '13px', marginBottom: '16px', gap: '4px' },
  bannerBtn:      { marginLeft: 'auto', background: '#854d0e', color: '#fff', border: 'none', borderRadius: '6px', padding: '4px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  classNameBadge: { background: '#dbeafe', color: '#1d4ed8', padding: '2px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 },
  downloadRow:    { display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' },
  downloadBtn:    { display: 'flex', alignItems: 'center', background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: '#374151', cursor: 'pointer' },
  lastDownload:   { fontSize: '12px', color: '#94a3b8' },
}
