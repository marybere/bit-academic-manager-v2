import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import NotificationBell from '../../components/NotificationBell'

const STATUTS = ['PRESENT', 'ABSENT', 'RETARD', 'EXCUSE']

const STATUT_STYLE = {
  PRESENT: { bg: '#dcfce7', color: '#166534', label: 'Present' },
  ABSENT:  { bg: '#fee2e2', color: '#991b1b', label: 'Absent'  },
  RETARD:  { bg: '#fef9c3', color: '#854d0e', label: 'Late'    },
  EXCUSE:  { bg: '#e0e7ff', color: '#3730a3', label: 'Excused' },
}

export default function AttendancePage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const todayISO = new Date().toISOString().split('T')[0]

  const [students, setStudents]   = useState([])
  const [classInfo, setClassInfo] = useState(null)
  const [records, setRecords]     = useState({})   // { student_id: 'PRESENT'|... }
  const [search, setSearch]       = useState('')
  const [date, setDate]           = useState(todayISO)
  const [loading, setLoading]     = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError]         = useState('')

  useEffect(() => {
    if (!user?.classe_id) { setLoading(false); return }

    const fetchStudentsAndSession = async () => {
      try {
        // Always fetch fresh from classes endpoint (includes new students added by secretary)
        const [classRes, sessionRes] = await Promise.all([
          api.get(`/classes/${user.classe_id}/students`),
          api.get(`/attendances/session/${user.classe_id}/${date}`),
        ])

        setClassInfo(classRes.data.class)
        const studentList = classRes.data.students
        setStudents(studentList)

        // Pre-fill from existing session (if any)
        const initial = {}
        studentList.forEach(s => { initial[s.id] = 'PRESENT' })
        sessionRes.data.session.forEach(r => { initial[r.student_id] = r.statut })
        setRecords(initial)

        if (sessionRes.data.session.length > 0) setSubmitted(true)
      } catch (err) {
        console.error('Load error:', err.message)
        setError('Failed to load students.')
      } finally {
        setLoading(false)
      }
    }

    fetchStudentsAndSession()
  }, [user, date])

  const handleDateChange = (e) => {
    setDate(e.target.value)
    setSubmitted(false)
    setError('')
    setLoading(true)
  }

  const toggle = (studentId, statut) => {
    setRecords(prev => ({ ...prev, [studentId]: statut }))
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        class_id: user.classe_id,
        date,
        students: Object.entries(records).map(([student_id, statut]) => ({
          student_id: parseInt(student_id),
          statut,
        })),
      }
      await api.post('/attendances', payload)
      setSubmitted(true)
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const presentCount = Object.values(records).filter(s => s === 'PRESENT').length
  const absentCount  = Object.values(records).filter(s => s === 'ABSENT').length

  const filtered = students.filter(s =>
    `${s.prenom} ${s.nom}`.toLowerCase().includes(search.toLowerCase())
  )

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
          <div style={{ ...s.navItem, ...s.navActive }}>
            <span className="material-icons" style={s.navIcon}>fact_check</span>
            Take Attendance
          </div>
          <div style={s.navItem} onClick={() => navigate('/chef/history')}>
            <span className="material-icons" style={s.navIcon}>history</span>
            History
          </div>
          <div style={s.navItem} onClick={() => navigate('/chef/requests/new')}>
            <span className="material-icons" style={s.navIcon}>add_circle</span>
            New Request
          </div>
          <div style={s.navItem} onClick={() => navigate('/chef/requests')}>
            <span className="material-icons" style={s.navIcon}>description</span>
            My Requests
          </div>
        </nav>
        <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ width:'38px', height:'38px', borderRadius:'50%', background:'#C8184A', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:700, flexShrink:0 }}>
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:'13px', fontWeight:700, color:'#ffffff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {user?.prenom} {user?.nom}
            </div>
            <div style={{ fontSize:'11px', color:'rgba(255,255,255,0.50)', marginTop:'2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
              {classInfo ? `Class Rep — ${classInfo.filiere} ${classInfo.niveau}` : 'Class Representative'}
            </div>
          </div>
          <button onClick={logout} title="Logout" style={{ background:'none', border:'none', color:'rgba(255,255,255,0.40)', cursor:'pointer', padding:'4px', display:'flex', alignItems:'center', flexShrink:0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={s.main}>
        <header style={s.header}>
          <div>
            <h1 style={s.pageTitle}>Take Attendance</h1>
            <p style={s.pageSubtitle}>Mark each student's status for the selected date</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <NotificationBell />
            <input
              type="date"
              value={date}
              onChange={handleDateChange}
              style={s.datePicker}
            />
          </div>
        </header>

        {/* Class info strip */}
        {classInfo && (
          <div style={s.classStrip}>
            <span className="material-icons" style={{ fontSize: '18px', color: '#6366f1' }}>school</span>
            <span style={s.classStripText}>
              {classInfo.nom}
            </span>
            <span style={s.classStripCount}>{students.length} students</span>
          </div>
        )}

        {/* Counter bar */}
        <div style={s.counterBar}>
          <Counter label="Present" count={presentCount} color="#10b981" />
          <Counter label="Absent"  count={absentCount}  color="#ef4444" />
          <Counter label="Total"   count={students.length} color="#6366f1" />
          {submitted && (
            <div style={s.savedBadge}>
              <span className="material-icons" style={{ fontSize: '16px', marginRight: '4px' }}>check_circle</span>
              Saved
            </div>
          )}
        </div>

        {/* Search */}
        <div style={s.searchWrap}>
          <span className="material-icons" style={s.searchIcon}>search</span>
          <input
            style={s.searchInput}
            placeholder="Search student..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        {error && <div style={s.errorMsg}>{error}</div>}

        {loading ? (
          <div style={s.loadingWrap}>Loading students...</div>
        ) : students.length === 0 ? (
          <div style={s.emptyState}>No students found in your class.</div>
        ) : (
          <>
            <div style={s.studentList}>
              {filtered.map(student => {
                const statut = records[student.id] || 'PRESENT'
                const style  = STATUT_STYLE[statut]
                return (
                  <div key={student.id} style={s.studentCard}>
                    <div style={s.studentLeft}>
                      <div style={{ ...s.studentAvatar, background: style.bg, color: style.color }}>
                        {student.prenom[0]}{student.nom[0]}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={s.studentName}>{student.prenom} {student.nom}</span>
                          {Date.now() - new Date(student.created_at).getTime() < 7 * 24 * 60 * 60 * 1000 && (
                            <span style={s.newBadge}>NEW</span>
                          )}
                        </div>
                        <div style={s.studentEmail}>{student.email}</div>
                      </div>
                    </div>
                    <div style={s.statutBtns}>
                      {STATUTS.map(st => (
                        <button
                          key={st}
                          onClick={() => toggle(student.id, st)}
                          style={{
                            ...s.statutBtn,
                            background: statut === st ? STATUT_STYLE[st].bg : '#f1f5f9',
                            color:      statut === st ? STATUT_STYLE[st].color : '#94a3b8',
                            fontWeight: statut === st ? 700 : 400,
                            border:     statut === st ? `1.5px solid ${STATUT_STYLE[st].color}` : '1.5px solid transparent',
                          }}
                        >
                          {STATUT_STYLE[st].label}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={s.submitWrap}>
              <button
                style={{ ...s.submitBtn, opacity: submitting ? 0.7 : 1 }}
                onClick={handleSubmit}
                disabled={submitting}
              >
                <span className="material-icons" style={{ fontSize: '20px', marginRight: '8px' }}>
                  {submitted ? 'update' : 'save'}
                </span>
                {submitting ? 'Saving...' : submitted ? 'Update Attendance' : 'Submit Attendance'}
              </button>
              {submitted && (
                <button style={s.historyBtn} onClick={() => navigate('/chef/history')}>
                  View History
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

function Counter({ label, count, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color }} />
      <span style={{ fontSize: '14px', color: '#64748b' }}>{label}:</span>
      <span style={{ fontSize: '16px', fontWeight: 700, color }}>{count}</span>
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
  navItem:     { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '14px', cursor: 'pointer', marginBottom: '4px' },
  navActive:   { background: 'rgba(200,24,74,0.15)', color: '#fff' },
  navIcon:     { fontSize: '20px' },
  sidebarBottom: { padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '8px' },
  userInfo:    { flex: 1, display: 'flex', alignItems: 'center', gap: '10px' },
  avatar:      { width: '34px', height: '34px', borderRadius: '50%', background: '#C8184A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 },
  userName:    { color: '#fff', fontSize: '13px', fontWeight: 600 },
  userRole:    { color: 'rgba(255,255,255,0.5)', fontSize: '11px' },
  logoutBtn:   { background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '4px' },
  main:        { flex: 1, padding: '32px', overflow: 'auto' },
  header:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' },
  pageTitle:   { fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0 },
  pageSubtitle:{ fontSize: '14px', color: '#64748b', margin: '4px 0 0' },
  datePicker:  { border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px', fontSize: '14px', color: '#0f172a', background: '#fff', outline: 'none' },
  counterBar:  { background: '#fff', borderRadius: '12px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', flexWrap: 'wrap' },
  savedBadge:  { marginLeft: 'auto', display: 'flex', alignItems: 'center', background: '#dcfce7', color: '#166534', padding: '4px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: 600 },
  searchWrap:  { position: 'relative', marginBottom: '16px' },
  searchIcon:  { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '20px' },
  searchInput: { width: '100%', padding: '10px 12px 10px 40px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', background: '#fff', outline: 'none', boxSizing: 'border-box' },
  errorMsg:    { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', color: '#dc2626', fontSize: '14px', marginBottom: '16px' },
  loadingWrap: { textAlign: 'center', color: '#94a3b8', padding: '40px' },
  emptyState:  { textAlign: 'center', color: '#94a3b8', padding: '40px', background: '#fff', borderRadius: '12px' },
  studentList: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' },
  studentCard: { background: '#fff', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', flexWrap: 'wrap', gap: '12px' },
  studentLeft: { display: 'flex', alignItems: 'center', gap: '12px' },
  studentAvatar: { width: '38px', height: '38px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, flexShrink: 0 },
  studentName: { fontSize: '14px', fontWeight: 600, color: '#0f172a' },
  studentEmail:{ fontSize: '12px', color: '#94a3b8' },
  statutBtns:  { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  statutBtn:   { padding: '5px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', transition: 'all 0.15s' },
  submitWrap:  { display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' },
  submitBtn:   { display: 'flex', alignItems: 'center', background: '#C8184A', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 24px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },
  historyBtn:   { background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '12px 20px', fontSize: '14px', color: '#374151', cursor: 'pointer', fontWeight: 500 },
  classStrip:   { display: 'flex', alignItems: 'center', gap: '8px', background: '#eef2ff', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px' },
  classStripText: { fontSize: '14px', fontWeight: 600, color: '#3730a3' },
  classStripCount:{ fontSize: '13px', color: '#6366f1', marginLeft: '4px' },
  newBadge:     { background: '#fef9c3', color: '#854d0e', fontSize: '10px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', letterSpacing: '0.04em' },
}
