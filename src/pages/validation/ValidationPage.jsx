import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import NotificationBell from '../../components/NotificationBell'

const TYPE_LABEL   = { RELEVE_NOTES:'Transcript', ATTESTATION_INSCRIPTION:'Enrollment Cert.', DIPLOME:'Diploma', AUTRE:'Other' }
const SERVICE_LABEL = { CAISSE:'Finance Office', IT:'IT Department', LABORATOIRE:'Laboratory' }
const ROLE_SERVICE  = { CAISSE:'CAISSE', IT:'IT', LABORATOIRE:'LABORATOIRE', SECRETAIRE:'SECRETAIRE' }

export default function ValidationPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [pending,  setPending]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(null)  // { request, action:'VALIDE'|'REJETE' }
  const [comment,  setComment]  = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const service = ROLE_SERVICE[user?.role] || user?.role
  const serviceLabel = SERVICE_LABEL[service] || service

  const load = () => {
    setLoading(true)
    api.get('/validations/pending')
      .then(res => setPending(res.data.pending || []))
      .catch(err => console.error(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openModal = (request, action) => {
    setModal({ request, action })
    setComment('')
    setError('')
  }

  const handleValidate = async () => {
    if (!modal) return
    setSaving(true)
    setError('')
    try {
      await api.post(`/validations/${modal.request.id}`, {
        statut: modal.action,
        commentaire: comment || undefined,
      })
      setModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Action failed.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.page}>
      <aside style={s.sidebar}>
        <div style={s.logo}><img src="/icons/bit-logo.png" alt="BIT" style={{width:'36px',height:'36px',objectFit:'contain',borderRadius:'6px',background:'#fff',padding:'3px',flexShrink:0}} /><span style={s.logoText}>Academic Manager</span></div>
        <nav style={s.nav}>
          <div style={{...s.navItem,...s.navActive}}>
            <span className="material-icons" style={s.navIcon}>verified</span>Validations
          </div>
        </nav>
        <div style={s.sidebarBottom}>
          <div style={s.userInfo}>
            <div style={s.avatar}>{user?.prenom?.[0]}{user?.nom?.[0]}</div>
            <div><div style={s.userName}>{user?.prenom} {user?.nom}</div><div style={s.userRole}>{serviceLabel}</div></div>
          </div>
          <button style={s.logoutBtn} onClick={logout}><span className="material-icons" style={{fontSize:'18px'}}>logout</span></button>
        </div>
      </aside>

      <main style={s.main}>
        <button style={s.backBtn} onClick={() => navigate('/secretaire/dashboard')}>
          <span className="material-icons" style={{fontSize:'18px',marginRight:'4px'}}>arrow_back</span>Back to Dashboard
        </button>

        <header style={s.header}>
          <div>
            <h1 style={s.pageTitle}>Pending Validations</h1>
            <p style={s.pageSubtitle}>{serviceLabel} — review and approve document requests</p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            <NotificationBell />
            <button style={s.refreshBtn} onClick={load}>
              <span className="material-icons" style={{fontSize:'18px',marginRight:'6px'}}>refresh</span>Refresh
            </button>
          </div>
        </header>

        {/* Stats strip */}
        <div style={s.statsStrip}>
          <div style={s.statItem}>
            <span className="material-icons" style={{color:'#f59e0b',marginRight:'8px'}}>hourglass_empty</span>
            <strong>{pending.length}</strong>&nbsp;request{pending.length!==1?'s':''} awaiting your approval
          </div>
        </div>

        {loading ? (
          <div style={s.center}>Loading...</div>
        ) : pending.length === 0 ? (
          <div style={s.empty}>
            <span className="material-icons" style={{fontSize:'56px',color:'#cbd5e1'}}>done_all</span>
            <p style={{color:'#64748b',margin:'12px 0 0',fontSize:'15px',fontWeight:600}}>All caught up!</p>
            <p style={{color:'#94a3b8',margin:'4px 0 0',fontSize:'14px'}}>No pending requests for your department.</p>
          </div>
        ) : (
          <div style={s.cardGrid}>
            {pending.map(r => (
              <div key={r.id} style={s.reqCard}>
                <div style={s.reqCardTop}>
                  <span style={s.reqId}>#{r.id}</span>
                  <span style={s.typeBadge}>{TYPE_LABEL[r.type]||r.type}</span>
                </div>

                <div style={s.studentRow}>
                  <div style={s.studentAvatar}>{r.prenom?.[0]}{r.nom?.[0]}</div>
                  <div>
                    <div style={s.studentName}>{r.prenom} {r.nom}</div>
                    <div style={s.studentEmail}>{r.email}</div>
                    {r.classe_nom && <div style={s.studentClass}>{r.classe_nom}</div>}
                  </div>
                </div>

                <div style={s.reqMeta}>
                  <div style={s.metaItem}>
                    <span className="material-icons" style={{fontSize:'14px',color:'#94a3b8'}}>picture_as_pdf</span>
                    {r.format}
                  </div>
                  <div style={s.metaItem}>
                    <span className="material-icons" style={{fontSize:'14px',color:'#94a3b8'}}>calendar_today</span>
                    {new Date(r.date_demande).toLocaleDateString('fr-FR')}
                  </div>
                </div>

                {r.notes && (
                  <div style={s.notesBox}>
                    <span className="material-icons" style={{fontSize:'14px',color:'#6366f1',marginRight:'6px',flexShrink:0}}>notes</span>
                    <span style={{fontSize:'12px',color:'#4338ca'}}>{r.notes}</span>
                  </div>
                )}

                <div style={s.actions}>
                  <button style={s.rejectBtn} onClick={() => openModal(r,'REJETE')}>
                    <span className="material-icons" style={{fontSize:'16px',marginRight:'4px'}}>close</span>Reject
                  </button>
                  <button style={s.approveBtn} onClick={() => openModal(r,'VALIDE')}>
                    <span className="material-icons" style={{fontSize:'16px',marginRight:'4px'}}>check</span>Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Confirm Modal */}
      {modal && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span className="material-icons" style={{fontSize:'22px', marginRight:'10px', color: modal.action==='VALIDE'?'#10b981':'#ef4444'}}>
                {modal.action==='VALIDE'?'check_circle':'cancel'}
              </span>
              <span style={s.modalTitle}>
                {modal.action==='VALIDE'?'Approve':'Reject'} Request #{modal.request.id}
              </span>
            </div>

            <div style={{fontSize:'14px',color:'#64748b',marginBottom:'16px'}}>
              {modal.request.prenom} {modal.request.nom} — {TYPE_LABEL[modal.request.type]||modal.request.type}
            </div>

            {error && <div style={s.errorMsg}>{error}</div>}

            <label style={s.label}>Comment (optional)</label>
            <textarea style={s.textarea} value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={modal.action==='VALIDE'?'Add a note for the file...':'Reason for rejection...'} />

            <div style={s.modalActions}>
              <button style={s.cancelBtn} onClick={() => setModal(null)}>Cancel</button>
              <button
                style={{...s.confirmBtn, background: modal.action==='VALIDE'?'#10b981':'#ef4444', opacity:saving?0.7:1}}
                onClick={handleValidate} disabled={saving}>
                {saving ? 'Processing...' : (modal.action==='VALIDE'?'Confirm Approval':'Confirm Rejection')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  page:         { display:'flex', minHeight:'100vh', background:'#f8fafc', fontFamily:"'Inter',sans-serif" },
  sidebar:      { width:'240px', background:'#0F1929', display:'flex', flexDirection:'column', padding:'24px 0', flexShrink:0 },
  logo:         { display:'flex', alignItems:'center', gap:'10px', padding:'0 20px 24px', borderBottom:'1px solid rgba(255,255,255,0.08)' },
  logoIcon:     { background:'#C8184A', color:'#fff', fontWeight:700, fontSize:'13px', padding:'4px 8px', borderRadius:'6px' },
  logoText:     { color:'#C8184A', fontSize:'15px', fontWeight:600 },
  nav:          { flex:1, padding:'16px 12px' },
  navItem:      { display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', borderRadius:'8px', color:'rgba(255,255,255,0.6)', fontSize:'14px', cursor:'pointer', marginBottom:'4px' },
  navActive:    { background:'rgba(200,24,74,0.15)', color:'#fff' },
  navIcon:      { fontSize:'20px' },
  sidebarBottom:{ padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:'8px' },
  userInfo:     { flex:1, display:'flex', alignItems:'center', gap:'10px' },
  avatar:       { width:'34px', height:'34px', borderRadius:'50%', background:'#C8184A', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:700, flexShrink:0 },
  userName:     { color:'#fff', fontSize:'13px', fontWeight:600 },
  userRole:     { color:'rgba(255,255,255,0.5)', fontSize:'11px' },
  logoutBtn:    { background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', padding:'4px' },
  main:         { flex:1, padding:'32px', overflow:'auto' },
  header:       { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' },
  pageTitle:    { fontSize:'24px', fontWeight:700, color:'#0f172a', margin:0 },
  pageSubtitle: { fontSize:'14px', color:'#64748b', margin:'4px 0 0' },
  backBtn:      { display:'flex', alignItems:'center', background:'none', border:'none', color:'#C8184A', fontSize:'14px', fontWeight:600, cursor:'pointer', padding:'0', marginBottom:'16px' },
  refreshBtn:   { display:'flex', alignItems:'center', background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:'8px', padding:'9px 16px', fontSize:'13px', color:'#374151', cursor:'pointer', fontWeight:500 },
  statsStrip:   { background:'#fffbeb', border:'1px solid #fde68a', borderRadius:'8px', padding:'12px 16px', marginBottom:'20px', display:'flex', alignItems:'center' },
  statItem:     { display:'flex', alignItems:'center', fontSize:'14px', color:'#92400e' },
  center:       { textAlign:'center', color:'#94a3b8', padding:'80px' },
  empty:        { textAlign:'center', padding:'80px 20px', display:'flex', flexDirection:'column', alignItems:'center' },
  cardGrid:     { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))', gap:'16px' },
  reqCard:      { background:'#fff', borderRadius:'12px', padding:'20px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' },
  reqCardTop:   { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' },
  reqId:        { fontSize:'12px', color:'#94a3b8', fontWeight:600 },
  typeBadge:    { background:'#f1f5f9', color:'#475569', padding:'3px 10px', borderRadius:'4px', fontSize:'11px', fontWeight:600 },
  studentRow:   { display:'flex', alignItems:'center', gap:'12px', marginBottom:'12px' },
  studentAvatar:{ width:'40px', height:'40px', borderRadius:'50%', background:'#ede9fe', color:'#5b21b6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontWeight:700, flexShrink:0 },
  studentName:  { fontSize:'14px', fontWeight:600, color:'#0f172a' },
  studentEmail: { fontSize:'12px', color:'#64748b', marginTop:'1px' },
  studentClass: { fontSize:'11px', color:'#94a3b8', marginTop:'1px' },
  reqMeta:      { display:'flex', gap:'16px', marginBottom:'10px' },
  metaItem:     { display:'flex', alignItems:'center', gap:'4px', fontSize:'12px', color:'#64748b' },
  notesBox:     { display:'flex', alignItems:'flex-start', background:'#eef2ff', borderRadius:'6px', padding:'8px 10px', marginBottom:'14px' },
  actions:      { display:'flex', gap:'10px', marginTop:'14px' },
  rejectBtn:    { flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#fef2f2', border:'1.5px solid #fecaca', borderRadius:'8px', padding:'9px', fontSize:'13px', color:'#dc2626', cursor:'pointer', fontWeight:600 },
  approveBtn:   { flex:1, display:'flex', alignItems:'center', justifyContent:'center', background:'#10b981', border:'none', borderRadius:'8px', padding:'9px', fontSize:'13px', color:'#fff', cursor:'pointer', fontWeight:600 },
  overlay:      { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  modalBox:     { background:'#fff', borderRadius:'14px', padding:'28px', width:'440px', maxWidth:'90vw', boxShadow:'0 10px 40px rgba(0,0,0,0.18)' },
  modalHeader:  { display:'flex', alignItems:'center', marginBottom:'12px' },
  modalTitle:   { fontSize:'16px', fontWeight:700, color:'#0f172a' },
  errorMsg:     { background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px', color:'#dc2626', fontSize:'13px', marginBottom:'12px' },
  label:        { display:'block', fontSize:'12px', fontWeight:600, color:'#374151', marginBottom:'6px' },
  textarea:     { width:'100%', padding:'10px 12px', border:'1.5px solid #e2e8f0', borderRadius:'8px', fontSize:'14px', background:'#f8fafc', outline:'none', boxSizing:'border-box', height:'80px', resize:'vertical', fontFamily:'inherit', marginBottom:'16px' },
  modalActions: { display:'flex', gap:'10px', justifyContent:'flex-end' },
  cancelBtn:    { background:'#f1f5f9', border:'none', borderRadius:'8px', padding:'10px 20px', fontSize:'14px', color:'#374151', cursor:'pointer', fontWeight:500 },
  confirmBtn:   { border:'none', borderRadius:'8px', padding:'10px 20px', fontSize:'14px', color:'#fff', cursor:'pointer', fontWeight:600 },
}
