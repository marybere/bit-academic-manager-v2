import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import NotificationBell from '../../components/NotificationBell'

const STATUT_STYLE = {
  EN_ATTENTE:    { bg: '#fef9c3', color: '#854d0e', label: 'Pending'    },
  EN_TRAITEMENT: { bg: '#dbeafe', color: '#1d4ed8', label: 'Processing' },
  APPROUVE:      { bg: '#ede9fe', color: '#5b21b6', label: 'Approved'   },
  PRET:          { bg: '#dcfce7', color: '#166534', label: 'Ready'      },
  RETIRE:        { bg: '#f1f5f9', color: '#475569', label: 'Collected'  },
  REJETE:        { bg: '#fee2e2', color: '#991b1b', label: 'Rejected'   },
}
const TYPE_LABEL = { RELEVE_NOTES:'Transcript', ATTESTATION_INSCRIPTION:'Enrollment Cert.', DIPLOME:'Diploma', AUTRE:'Other' }
const SERVICE_ICON = { CAISSE:'payments', IT:'computer', LABORATOIRE:'science', SECRETAIRE:'badge' }

export default function RequestDetailPage() {
  const { id } = useParams()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [request,  setRequest]  = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')
  const [form, setForm] = useState({ statut: '', rendez_vous: '', notes: '' })

  useEffect(() => {
    api.get(`/requests/${id}`)
      .then(res => {
        setRequest(res.data.request)
        setForm({ statut: res.data.request.statut, rendez_vous: res.data.request.rendez_vous?.slice(0,16) || '', notes: res.data.request.notes || '' })
      })
      .catch(err => setError(err.response?.data?.error || 'Failed to load request.'))
      .finally(() => setLoading(false))
  }, [id])

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await api.put(`/requests/${id}/statut`, form)
      setRequest(prev => ({ ...prev, ...res.data.request }))
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const ss = STATUT_STYLE[request?.statut] || STATUT_STYLE.EN_ATTENTE

  return (
    <div style={s.page}>
      <aside style={s.sidebar}>
        <div style={s.logo}><img src="/icons/bit-logo.png" alt="BIT" style={{width:'36px',height:'36px',objectFit:'contain',borderRadius:'6px',background:'#fff',padding:'3px',flexShrink:0}} /><span style={s.logoText}>Academic Manager</span></div>
        <nav style={s.nav}>
          <div style={s.navItem} onClick={() => navigate('/secretaire/dashboard')}>
            <span className="material-icons" style={s.navIcon}>dashboard</span>Dashboard
          </div>
          <div style={s.navItem} onClick={() => navigate('/secretaire/classes')}>
            <span className="material-icons" style={s.navIcon}>school</span>Classes
          </div>
          <div style={{ ...s.navItem, ...s.navActive }}>
            <span className="material-icons" style={s.navIcon}>description</span>Request Detail
          </div>
        </nav>
        <div style={s.sidebarBottom}>
          <div style={s.userInfo}><div style={s.avatar}>{user?.prenom?.[0]}{user?.nom?.[0]}</div>
            <div><div style={s.userName}>{user?.prenom} {user?.nom}</div><div style={s.userRole}>Secretary Office</div></div>
          </div>
          <button style={s.logoutBtn} onClick={logout}><span className="material-icons" style={{fontSize:'18px'}}>logout</span></button>
        </div>
      </aside>

      <main style={s.main}>
        <div style={s.topBar}>
          <button style={s.backBtn} onClick={() => navigate('/secretaire/dashboard')}>
            <span className="material-icons" style={{fontSize:'18px',marginRight:'4px'}}>arrow_back</span>Back to Dashboard
          </button>
          <NotificationBell />
        </div>

        {loading ? <div style={s.center}>Loading...</div>
        : error && !request ? <div style={s.errorBox}>{error}</div>
        : request && (
          <div style={s.grid}>
            {/* Left column */}
            <div>
              {/* Student card */}
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <span className="material-icons" style={{color:'#6366f1',marginRight:'8px'}}>person</span>
                  <span style={s.cardTitle}>Student</span>
                </div>
                <div style={s.studentRow}>
                  <div style={s.bigAvatar}>{request.prenom?.[0]}{request.nom?.[0]}</div>
                  <div>
                    <div style={s.studentName}>{request.prenom} {request.nom}</div>
                    <div style={s.studentEmail}>{request.email}</div>
                    <div style={s.studentClass}>{request.classe_nom || 'No class'}</div>
                  </div>
                </div>
              </div>

              {/* Request details */}
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <span className="material-icons" style={{color:'#10b981',marginRight:'8px'}}>description</span>
                  <span style={s.cardTitle}>Request Details</span>
                  <span style={{...s.statusPill, background:ss.bg, color:ss.color, marginLeft:'auto'}}>{ss.label}</span>
                </div>
                <div style={s.detailGrid}>
                  <Detail label="Request #" value={`#${request.id}`} />
                  <Detail label="Type"      value={TYPE_LABEL[request.type] || request.type} />
                  <Detail label="Format"    value={request.format} />
                  <Detail label="Submitted" value={new Date(request.date_demande).toLocaleDateString('fr-FR')} />
                  {request.rendez_vous && <Detail label="Appointment" value={new Date(request.rendez_vous).toLocaleString('fr-FR')} />}
                  {request.notes && <Detail label="Notes" value={request.notes} fullWidth />}
                </div>
              </div>

              {/* Validation timeline */}
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <span className="material-icons" style={{color:'#f59e0b',marginRight:'8px'}}>timeline</span>
                  <span style={s.cardTitle}>Validation Timeline</span>
                </div>
                <div style={s.timeline}>
                  {['CAISSE','IT','LABORATOIRE'].map(svc => {
                    const val = request.validations?.find(v => v.service === svc)
                    const done  = val?.statut === 'VALIDE'
                    const rejected = val?.statut === 'REJETE'
                    return (
                      <div key={svc} style={s.timelineItem}>
                        <div style={{...s.timelineDot, background: rejected?'#ef4444': done?'#10b981':'#e2e8f0'}}>
                          <span className="material-icons" style={{fontSize:'16px',color:done||rejected?'#fff':'#94a3b8'}}>
                            {SERVICE_ICON[svc]}
                          </span>
                        </div>
                        <div style={s.timelineContent}>
                          <div style={s.timelineSvc}>{svc}</div>
                          <div style={{fontSize:'12px', color: rejected?'#ef4444': done?'#10b981':'#94a3b8'}}>
                            {rejected ? 'Rejected' : done ? `Approved${val.date_validation ? ' · '+new Date(val.date_validation).toLocaleDateString('fr-FR') : ''}` : 'Pending'}
                          </div>
                          {val?.commentaire && <div style={s.timelineComment}>"{val.commentaire}"</div>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right column — update form */}
            <div>
              <div style={s.card}>
                <div style={s.cardHeader}>
                  <span className="material-icons" style={{color:'#C8184A',marginRight:'8px'}}>edit</span>
                  <span style={s.cardTitle}>Update Status</span>
                </div>
                {error && <div style={s.errorBox}>{error}</div>}
                <form onSubmit={handleSave}>
                  <label style={s.label}>Status</label>
                  <select style={s.input} value={form.statut} onChange={e => setForm(p=>({...p,statut:e.target.value}))}>
                    {['EN_ATTENTE','EN_TRAITEMENT','APPROUVE','PRET','RETIRE','REJETE'].map(st => (
                      <option key={st} value={st}>{STATUT_STYLE[st].label}</option>
                    ))}
                  </select>

                  <label style={s.label}>Appointment (optional)</label>
                  <input style={s.input} type="datetime-local" value={form.rendez_vous}
                    onChange={e => setForm(p=>({...p,rendez_vous:e.target.value}))} />

                  <label style={s.label}>Notes (optional)</label>
                  <textarea style={{...s.input,height:'90px',resize:'vertical'}} value={form.notes}
                    onChange={e => setForm(p=>({...p,notes:e.target.value}))}
                    placeholder="Internal note for this request..." />

                  <button style={{...s.saveBtn,opacity:saving?0.7:1}} type="submit" disabled={saving}>
                    <span className="material-icons" style={{fontSize:'18px',marginRight:'6px'}}>save</span>
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function Detail({ label, value, fullWidth }) {
  return (
    <div style={{ gridColumn: fullWidth ? '1/-1' : undefined }}>
      <div style={{ fontSize:'11px', fontWeight:600, color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'2px' }}>{label}</div>
      <div style={{ fontSize:'14px', color:'#0f172a' }}>{value}</div>
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
  topBar:       { marginBottom:'20px' },
  backBtn:      { display:'flex', alignItems:'center', background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:'8px', padding:'8px 14px', fontSize:'13px', color:'#374151', cursor:'pointer', fontWeight:500 },
  center:       { textAlign:'center', color:'#94a3b8', padding:'60px' },
  errorBox:     { background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'12px', color:'#dc2626', fontSize:'14px', marginBottom:'16px' },
  grid:         { display:'grid', gridTemplateColumns:'1fr 360px', gap:'20px', alignItems:'start' },
  card:         { background:'#fff', borderRadius:'12px', padding:'20px', marginBottom:'16px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' },
  cardHeader:   { display:'flex', alignItems:'center', marginBottom:'16px' },
  cardTitle:    { fontSize:'15px', fontWeight:600, color:'#0f172a' },
  statusPill:   { padding:'3px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:600 },
  studentRow:   { display:'flex', alignItems:'center', gap:'14px' },
  bigAvatar:    { width:'52px', height:'52px', borderRadius:'50%', background:'#ede9fe', color:'#5b21b6', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', fontWeight:700, flexShrink:0 },
  studentName:  { fontSize:'16px', fontWeight:700, color:'#0f172a' },
  studentEmail: { fontSize:'13px', color:'#64748b', marginTop:'2px' },
  studentClass: { fontSize:'12px', color:'#94a3b8', marginTop:'2px' },
  detailGrid:   { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' },
  timeline:     { display:'flex', flexDirection:'column', gap:'0' },
  timelineItem: { display:'flex', gap:'12px', paddingBottom:'16px', position:'relative' },
  timelineDot:  { width:'32px', height:'32px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, zIndex:1 },
  timelineContent:{ flex:1 },
  timelineSvc:  { fontSize:'13px', fontWeight:600, color:'#0f172a' },
  timelineComment:{ fontSize:'11px', color:'#6366f1', fontStyle:'italic', marginTop:'2px' },
  label:        { display:'block', fontSize:'12px', fontWeight:600, color:'#374151', marginBottom:'6px' },
  input:        { width:'100%', padding:'10px 12px', border:'1.5px solid #e2e8f0', borderRadius:'8px', fontSize:'14px', background:'#f8fafc', outline:'none', boxSizing:'border-box', marginBottom:'14px', fontFamily:'inherit' },
  saveBtn:      { display:'flex', alignItems:'center', background:'#C8184A', color:'#fff', border:'none', borderRadius:'8px', padding:'11px 20px', fontSize:'14px', fontWeight:600, cursor:'pointer', width:'100%', justifyContent:'center' },
}
