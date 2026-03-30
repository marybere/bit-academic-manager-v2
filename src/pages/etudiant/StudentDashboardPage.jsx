import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import NotificationBell from '../../components/NotificationBell'

const STATUT_STYLE = {
  EN_ATTENTE:    { bg:'#fef9c3', color:'#854d0e', label:'Pending'    },
  EN_TRAITEMENT: { bg:'#dbeafe', color:'#1d4ed8', label:'Processing' },
  PRET:          { bg:'#dcfce7', color:'#166534', label:'Ready'      },
  RETIRE:        { bg:'#f1f5f9', color:'#475569', label:'Collected'  },
  REJETE:        { bg:'#fee2e2', color:'#991b1b', label:'Rejected'   },
}
const TYPE_LABEL = { RELEVE_NOTES:'Transcript', ATTESTATION_INSCRIPTION:'Enrollment Cert.', DIPLOME:'Diploma', AUTRE:'Other' }

export default function StudentDashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [requests,   setRequests]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [showPwdModal, setShowPwdModal] = useState(false)
  const [pwdForm,    setPwdForm]    = useState({ current:'', next:'', confirm:'' })
  const [pwdSaving,  setPwdSaving]  = useState(false)
  const [pwdError,   setPwdError]   = useState('')
  const [pwdSuccess, setPwdSuccess] = useState(false)

  useEffect(() => {
    api.get('/requests/my')
      .then(res => setRequests(res.data.requests))
      .catch(err => console.error(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleChangePwd = async (e) => {
    e.preventDefault()
    if (pwdForm.next !== pwdForm.confirm) { setPwdError('Passwords do not match.'); return }
    if (pwdForm.next.length < 6) { setPwdError('New password must be at least 6 characters.'); return }
    setPwdSaving(true)
    setPwdError('')
    try {
      await api.put('/auth/change-password', { current_password: pwdForm.current, new_password: pwdForm.next })
      setPwdSuccess(true)
      setPwdForm({ current:'', next:'', confirm:'' })
      setTimeout(() => { setShowPwdModal(false); setPwdSuccess(false) }, 1500)
    } catch (err) {
      setPwdError(err.response?.data?.error || 'Failed to change password.')
    } finally {
      setPwdSaving(false)
    }
  }

  const stats = {
    total:  requests.length,
    active: requests.filter(r => ['EN_ATTENTE','EN_TRAITEMENT'].includes(r.statut)).length,
    ready:  requests.filter(r => r.statut === 'PRET').length,
  }

  return (
    <div style={s.page}>
      <aside style={s.sidebar}>
        <div style={s.logo}><img src="/icons/bit-logo.png" alt="BIT" style={{width:'36px',height:'36px',objectFit:'contain',borderRadius:'6px',background:'#fff',padding:'3px',flexShrink:0}} /><span style={s.logoText}>Academic Manager</span></div>
        <nav style={s.nav}>
          <div style={{...s.navItem,...s.navActive}}>
            <span className="material-icons" style={s.navIcon}>dashboard</span>Dashboard
          </div>
          <div style={s.navItem} onClick={() => navigate('/etudiant/new-request')}>
            <span className="material-icons" style={s.navIcon}>add_circle</span>New Request
          </div>
          <div style={s.navItem} onClick={() => navigate('/etudiant/track')}>
            <span className="material-icons" style={s.navIcon}>track_changes</span>Track Requests
          </div>
        </nav>
        <div style={s.sidebarBottom}>
          <div style={s.userInfo}>
            <div style={s.avatar}>{user?.prenom?.[0]}{user?.nom?.[0]}</div>
            <div><div style={s.userName}>{user?.prenom} {user?.nom}</div><div style={s.userRole}>Student</div></div>
          </div>
          <button style={s.logoutBtn} onClick={logout}><span className="material-icons" style={{fontSize:'18px'}}>logout</span></button>
        </div>
      </aside>

      <main style={s.main}>
        <header style={s.header}>
          <div>
            <h1 style={s.pageTitle}>My Dashboard</h1>
            <p style={s.pageSubtitle}>{new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p>
          </div>
          <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
            <NotificationBell />
            <button style={s.changePwdBtn} onClick={() => { setShowPwdModal(true); setPwdError(''); setPwdSuccess(false) }}>
              <span className="material-icons" style={{fontSize:'16px',marginRight:'6px'}}>lock</span>Change Password
            </button>
            <button style={s.newBtn} onClick={() => navigate('/etudiant/new-request')}>
              <span className="material-icons" style={{fontSize:'18px',marginRight:'6px'}}>add_circle</span>New Request
            </button>
          </div>
        </header>

        {/* Stats */}
        <div style={s.statsGrid}>
          {[
            { icon:'inbox',        label:'Total Requests',  value:stats.total,  color:'#6366f1' },
            { icon:'hourglass_empty', label:'In Progress',  value:stats.active, color:'#f59e0b' },
            { icon:'check_circle', label:'Ready to Collect',value:stats.ready,  color:'#10b981' },
          ].map(c => (
            <div key={c.label} style={s.statCard}>
              <div style={{...s.statIcon, background:c.color+'18', color:c.color}}>
                <span className="material-icons">{c.icon}</span>
              </div>
              <div>
                <div style={s.statValue}>{c.value}</div>
                <div style={s.statLabel}>{c.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Ready banner */}
        {stats.ready > 0 && (
          <div style={s.readyBanner}>
            <span className="material-icons" style={{fontSize:'20px'}}>notifications_active</span>
            <span>You have <strong>{stats.ready}</strong> request{stats.ready>1?'s':''} ready for collection at the secretary office!</span>
          </div>
        )}

        {/* Requests list */}
        <div style={s.tableCard}>
          <div style={s.tableHeader}>
            <span style={s.tableTitle}>My Requests</span>
            <button style={s.trackBtn} onClick={() => navigate('/etudiant/track')}>
              <span className="material-icons" style={{fontSize:'16px',marginRight:'4px'}}>track_changes</span>Track All
            </button>
          </div>

          {loading ? <div style={s.center}>Loading...</div>
          : requests.length === 0 ? (
            <div style={s.empty}>
              <span className="material-icons" style={{fontSize:'48px',color:'#cbd5e1'}}>inbox</span>
              <p style={{color:'#64748b',margin:'8px 0'}}>No requests yet.</p>
              <button style={s.newBtn} onClick={() => navigate('/etudiant/new-request')}>Submit Your First Request</button>
            </div>
          ) : (
            <table style={s.table}>
              <thead><tr style={s.theadRow}>
                <th style={s.th}>#</th><th style={s.th}>Type</th><th style={s.th}>Format</th>
                <th style={s.th}>Date</th><th style={s.th}>Status</th><th style={s.th}></th>
              </tr></thead>
              <tbody>
                {requests.map(r => {
                  const ss = STATUT_STYLE[r.statut] || STATUT_STYLE.EN_ATTENTE
                  return (
                    <tr key={r.id} style={s.tr}>
                      <td style={{...s.td,color:'#94a3b8',fontSize:'12px'}}>#{r.id}</td>
                      <td style={s.td}><span style={s.typeBadge}>{TYPE_LABEL[r.type]||r.type}</span></td>
                      <td style={{...s.td,color:'#64748b',fontSize:'12px'}}>{r.format}</td>
                      <td style={{...s.td,color:'#64748b',fontSize:'12px'}}>{new Date(r.date_demande).toLocaleDateString('fr-FR')}</td>
                      <td style={s.td}><span style={{...s.statusBadge,background:ss.bg,color:ss.color}}>{ss.label}</span></td>
                      <td style={s.td}>
                        <button style={s.viewBtn} onClick={() => navigate(`/etudiant/track/${r.id}`)}>
                          <span className="material-icons" style={{fontSize:'16px'}}>chevron_right</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Change Password Modal */}
      {showPwdModal && (
        <div style={s.overlay} onClick={() => setShowPwdModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span className="material-icons" style={{color:'#C8184A',marginRight:'10px',fontSize:'22px'}}>lock</span>
              <span style={s.modalTitle}>Change Password</span>
              <button style={s.closeBtn} onClick={() => setShowPwdModal(false)}>
                <span className="material-icons">close</span>
              </button>
            </div>

            {pwdSuccess ? (
              <div style={s.successBox}>
                <span className="material-icons" style={{fontSize:'36px',color:'#10b981',marginBottom:'8px'}}>check_circle</span>
                <div style={{fontWeight:700,color:'#0f172a'}}>Password changed!</div>
              </div>
            ) : (
              <form onSubmit={handleChangePwd}>
                {pwdError && <div style={s.errorMsg}>{pwdError}</div>}
                <label style={s.label}>Current Password</label>
                <input style={s.input} type="password" value={pwdForm.current}
                  onChange={e => setPwdForm(p=>({...p,current:e.target.value}))} required autoFocus />
                <label style={s.label}>New Password</label>
                <input style={s.input} type="password" value={pwdForm.next}
                  onChange={e => setPwdForm(p=>({...p,next:e.target.value}))} required placeholder="At least 6 characters" />
                <label style={s.label}>Confirm New Password</label>
                <input style={s.input} type="password" value={pwdForm.confirm}
                  onChange={e => setPwdForm(p=>({...p,confirm:e.target.value}))} required />
                <div style={s.modalActions}>
                  <button type="button" style={s.cancelBtn} onClick={() => setShowPwdModal(false)}>Cancel</button>
                  <button type="submit" style={{...s.submitBtn,opacity:pwdSaving?0.7:1}} disabled={pwdSaving}>
                    {pwdSaving ? 'Saving...' : 'Change Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page:        { display:'flex', minHeight:'100vh', background:'#f8fafc', fontFamily:"'Inter',sans-serif" },
  sidebar:     { width:'240px', background:'#0F1929', display:'flex', flexDirection:'column', padding:'24px 0', flexShrink:0 },
  logo:        { display:'flex', alignItems:'center', gap:'10px', padding:'0 20px 24px', borderBottom:'1px solid rgba(255,255,255,0.08)' },
  logoIcon:    { background:'#C8184A', color:'#fff', fontWeight:700, fontSize:'13px', padding:'4px 8px', borderRadius:'6px' },
  logoText:    { color:'#C8184A', fontSize:'15px', fontWeight:600 },
  nav:         { flex:1, padding:'16px 12px' },
  navItem:     { display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', borderRadius:'8px', color:'rgba(255,255,255,0.6)', fontSize:'14px', cursor:'pointer', marginBottom:'4px' },
  navActive:   { background:'rgba(200,24,74,0.15)', color:'#fff' },
  navIcon:     { fontSize:'20px' },
  sidebarBottom: { padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:'8px' },
  userInfo:    { flex:1, display:'flex', alignItems:'center', gap:'10px' },
  avatar:      { width:'34px', height:'34px', borderRadius:'50%', background:'#C8184A', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:700, flexShrink:0 },
  userName:    { color:'#fff', fontSize:'13px', fontWeight:600 },
  userRole:    { color:'rgba(255,255,255,0.5)', fontSize:'11px' },
  logoutBtn:   { background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', padding:'4px' },
  main:        { flex:1, padding:'32px', overflow:'auto' },
  header:      { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' },
  pageTitle:   { fontSize:'24px', fontWeight:700, color:'#0f172a', margin:0 },
  pageSubtitle:{ fontSize:'14px', color:'#64748b', margin:'4px 0 0', textTransform:'capitalize' },
  newBtn:      { display:'flex', alignItems:'center', background:'#C8184A', color:'#fff', border:'none', borderRadius:'8px', padding:'10px 18px', fontSize:'14px', fontWeight:600, cursor:'pointer' },
  statsGrid:   { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'14px', marginBottom:'16px' },
  statCard:    { background:'#fff', borderRadius:'12px', padding:'18px 20px', display:'flex', alignItems:'center', gap:'14px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' },
  statIcon:    { width:'44px', height:'44px', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  statValue:   { fontSize:'22px', fontWeight:700, color:'#0f172a' },
  statLabel:   { fontSize:'12px', color:'#64748b', marginTop:'2px' },
  readyBanner: { display:'flex', alignItems:'center', gap:'10px', background:'#dcfce7', border:'1px solid #86efac', borderRadius:'8px', padding:'12px 16px', color:'#166534', fontSize:'14px', marginBottom:'16px' },
  tableCard:   { background:'#fff', borderRadius:'12px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', overflow:'hidden' },
  tableHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid #f1f5f9' },
  tableTitle:  { fontSize:'15px', fontWeight:600, color:'#0f172a' },
  trackBtn:    { display:'flex', alignItems:'center', background:'#f1f5f9', border:'none', borderRadius:'6px', padding:'6px 12px', fontSize:'12px', color:'#374151', cursor:'pointer', fontWeight:500 },
  center:      { padding:'40px', textAlign:'center', color:'#94a3b8' },
  empty:       { padding:'60px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center' },
  table:       { width:'100%', borderCollapse:'collapse' },
  theadRow:    { background:'#f8fafc' },
  th:          { textAlign:'left', padding:'10px 14px', fontSize:'11px', fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:'1px solid #f1f5f9' },
  tr:          { borderBottom:'1px solid #f8fafc' },
  td:          { padding:'12px 14px', fontSize:'13px', color:'#374151' },
  typeBadge:   { background:'#f1f5f9', color:'#475569', padding:'2px 8px', borderRadius:'4px', fontSize:'11px', fontWeight:600 },
  statusBadge: { padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:600 },
  viewBtn:     { background:'none', border:'none', cursor:'pointer', color:'#94a3b8', padding:'4px', display:'flex', alignItems:'center' },
  changePwdBtn:{ display:'flex', alignItems:'center', background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:'8px', padding:'9px 14px', fontSize:'13px', color:'#374151', cursor:'pointer', fontWeight:500 },
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  modal:       { background:'#fff', borderRadius:'14px', padding:'28px', width:'420px', maxWidth:'90vw', boxShadow:'0 10px 40px rgba(0,0,0,0.18)' },
  modalHeader: { display:'flex', alignItems:'center', marginBottom:'20px' },
  modalTitle:  { fontSize:'18px', fontWeight:700, color:'#0f172a', flex:1 },
  closeBtn:    { background:'none', border:'none', color:'#94a3b8', cursor:'pointer', padding:'4px', display:'flex' },
  errorMsg:    { background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px', color:'#dc2626', fontSize:'13px', marginBottom:'12px' },
  label:       { display:'block', fontSize:'12px', fontWeight:600, color:'#374151', marginBottom:'5px' },
  input:       { width:'100%', padding:'10px 12px', border:'1.5px solid #e2e8f0', borderRadius:'8px', fontSize:'14px', background:'#f8fafc', outline:'none', boxSizing:'border-box', marginBottom:'14px', fontFamily:'inherit' },
  modalActions:{ display:'flex', gap:'10px', justifyContent:'flex-end', marginTop:'4px' },
  cancelBtn:   { background:'#f1f5f9', border:'none', borderRadius:'8px', padding:'10px 18px', fontSize:'14px', color:'#374151', cursor:'pointer', fontWeight:500 },
  submitBtn:   { background:'#C8184A', color:'#fff', border:'none', borderRadius:'8px', padding:'10px 20px', fontSize:'14px', fontWeight:600, cursor:'pointer' },
  successBox:  { display:'flex', flexDirection:'column', alignItems:'center', padding:'24px 0', textAlign:'center' },
}
