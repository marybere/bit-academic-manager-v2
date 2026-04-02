import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import NotificationBell from '../../components/NotificationBell'

const STATUT_STYLE = {
  EN_ATTENTE:    { bg:'#fef9c3', color:'#854d0e', label:'Pending'    },
  EN_TRAITEMENT: { bg:'#dbeafe', color:'#1d4ed8', label:'Processing' },
  APPROUVE:      { bg:'#ede9fe', color:'#5b21b6', label:'Approved'   },
  PRET:          { bg:'#dcfce7', color:'#166534', label:'Ready'      },
  RETIRE:        { bg:'#f1f5f9', color:'#475569', label:'Collected'  },
  REJETE:                  { bg:'#fee2e2', color:'#991b1b', label:'Rejected'             },
  EN_ATTENTE_JUSTIFICATION:{ bg:'#fff7ed', color:'#92400e', label:'Pending Justification' },
}
const TYPE_LABEL = { RELEVE_NOTES:'Transcript', ATTESTATION_INSCRIPTION:'Enrollment Cert.', DIPLOME:'Diploma', AUTRE:'Other' }
const SERVICE_ICON = { CAISSE:'payments', IT:'computer', LABORATOIRE:'science', SECRETAIRE:'badge' }
const SERVICE_LABEL = { CAISSE:'Finance Office', IT:'IT Department', LABORATOIRE:'Laboratory', SECRETAIRE:'Secretary Office' }

export default function TrackRequestPage() {
  const { id } = useParams()
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [requests,     setRequests]     = useState([])
  const [selected,     setSelected]     = useState(null)
  const [validations,  setValidations]  = useState([])
  const [loadingList,  setLoadingList]  = useState(true)
  const [loadingDetail,setLoadingDetail]= useState(false)
  const [classInfo,    setClassInfo]    = useState(null)

  useEffect(() => {
    if (user?.classe_id) {
      api.get(`/classes/${user.classe_id}/info`)
        .then(res => setClassInfo(res.data.classe))
        .catch(() => {})
    }
  }, [user])

  // Load all requests
  useEffect(() => {
    api.get('/requests/my')
      .then(res => {
        setRequests(res.data.requests)
        if (id) {
          const found = res.data.requests.find(r => String(r.id) === String(id))
          if (found) loadDetail(found)
        }
      })
      .catch(err => console.error(err.message))
      .finally(() => setLoadingList(false))
  }, [id])

  const loadDetail = async (req) => {
    setSelected(req)
    setLoadingDetail(true)
    try {
      const res = await api.get(`/validations/${req.id}`)
      setValidations(res.data.validations || [])
    } catch {
      setValidations([])
    } finally {
      setLoadingDetail(false)
    }
  }

  const ss = selected ? (STATUT_STYLE[selected.statut] || STATUT_STYLE.EN_ATTENTE) : null

  return (
    <div style={s.page}>
      <aside style={s.sidebar}>
        <div style={s.logo}><img src="/icons/bit-logo.png" alt="BIT" style={{width:'36px',height:'36px',objectFit:'contain',borderRadius:'6px',background:'#fff',padding:'3px',flexShrink:0}} /><span style={s.logoText}>Academic Manager</span></div>
        <nav style={s.nav}>
          <div style={s.navItem} onClick={() => navigate('/etudiant/dashboard')}>
            <span className="material-icons" style={s.navIcon}>dashboard</span>Dashboard
          </div>
          <div style={s.navItem} onClick={() => navigate('/etudiant/new-request')}>
            <span className="material-icons" style={s.navIcon}>add_circle</span>New Request
          </div>
          <div style={{...s.navItem,...s.navActive}}>
            <span className="material-icons" style={s.navIcon}>track_changes</span>Track Requests
          </div>
        </nav>
        <div style={s.sidebarBottom}>
          <div style={s.userInfo}>
            <div style={s.avatar}>{user?.prenom?.[0]}{user?.nom?.[0]}</div>
            <div>
              <div style={s.userName}>{user?.prenom} {user?.nom}</div>
              <div style={s.userRole}>{classInfo ? `${classInfo.niveau} ${classInfo.filiere}` : 'Student'}</div>
            </div>
          </div>
          <button style={s.logoutBtn} onClick={logout}><span className="material-icons" style={{fontSize:'18px'}}>logout</span></button>
        </div>
      </aside>

      <main style={s.main}>
        <header style={s.header}>
          <div>
            <h1 style={s.pageTitle}>Track Requests</h1>
            <p style={s.pageSubtitle}>Monitor the status of your document requests</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <NotificationBell />
            <button style={s.newBtn} onClick={() => navigate('/etudiant/new-request')}>
              <span className="material-icons" style={{fontSize:'18px',marginRight:'6px'}}>add_circle</span>New Request
            </button>
          </div>
        </header>

        <div style={s.layout}>
          {/* List panel */}
          <div style={s.listPanel}>
            <div style={s.panelHeader}>All Requests</div>
            {loadingList ? (
              <div style={s.center}>Loading...</div>
            ) : requests.length === 0 ? (
              <div style={s.empty}>
                <span className="material-icons" style={{fontSize:'40px',color:'#cbd5e1'}}>inbox</span>
                <p style={{color:'#64748b',margin:'8px 0 0',fontSize:'14px'}}>No requests yet.</p>
              </div>
            ) : requests.map(r => {
              const st = STATUT_STYLE[r.statut] || STATUT_STYLE.EN_ATTENTE
              const isActive = selected?.id === r.id
              return (
                <div key={r.id} style={{...s.requestCard, borderColor: isActive?'#C8184A':'#e2e8f0', background: isActive?'#fff5f7':'#fff'}}
                  onClick={() => loadDetail(r)}>
                  <div style={s.cardTop}>
                    <span style={s.reqType}>{TYPE_LABEL[r.type]||r.type}</span>
                    <span style={{...s.statusDot, background:st.bg, color:st.color}}>{st.label}</span>
                  </div>
                  <div style={s.cardBottom}>
                    <span style={s.reqId}>#{r.id}</span>
                    <span style={s.reqDate}>{new Date(r.date_demande).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Detail panel */}
          <div style={s.detailPanel}>
            {!selected ? (
              <div style={s.placeholder}>
                <span className="material-icons" style={{fontSize:'48px',color:'#cbd5e1'}}>touch_app</span>
                <p style={{color:'#94a3b8',marginTop:'12px',fontSize:'14px'}}>Select a request to view details</p>
              </div>
            ) : (
              <>
                {/* Request info */}
                <div style={s.detailCard}>
                  <div style={s.detailCardHeader}>
                    <span className="material-icons" style={{color:'#6366f1',marginRight:'8px',fontSize:'20px'}}>description</span>
                    <span style={s.detailCardTitle}>Request Details</span>
                    <span style={{...s.statusPill, background:ss.bg, color:ss.color, marginLeft:'auto'}}>{ss.label}</span>
                  </div>
                  <div style={s.infoGrid}>
                    <InfoRow label="Request #" value={`#${selected.id}`} />
                    <InfoRow label="Type" value={TYPE_LABEL[selected.type]||selected.type} />
                    <InfoRow label="Format" value={selected.format} />
                    <InfoRow label="Submitted" value={new Date(selected.date_demande).toLocaleDateString('fr-FR')} />
                    {selected.rendez_vous && <InfoRow label="Appointment" value={new Date(selected.rendez_vous).toLocaleString('fr-FR')} fullWidth />}
                    {selected.notes && <InfoRow label="Notes" value={selected.notes} fullWidth />}
                  </div>
                </div>

                {/* Status banners */}
                {selected.statut === 'APPROUVE' && (
                  <div style={s.approvedBanner}>
                    <span className="material-icons" style={{fontSize:'20px'}}>verified</span>
                    <div>
                      <strong>Approved by All Departments!</strong>
                      <div style={{fontSize:'13px',marginTop:'2px'}}>Your request has been validated. The secretary will contact you shortly to arrange pickup or delivery.</div>
                    </div>
                  </div>
                )}
                {selected.statut === 'PRET' && selected.format === 'PAPIER' && (
                  <div style={s.readyBanner}>
                    <span className="material-icons" style={{fontSize:'20px'}}>event_available</span>
                    <div>
                      <strong>Your document is ready for pickup!</strong>
                      {selected.rendez_vous
                        ? <>
                            <div style={{fontSize:'13px',marginTop:'2px'}}>Date: {new Date(selected.rendez_vous).toLocaleDateString('fr-FR')}</div>
                            <div style={{fontSize:'13px',marginTop:'1px'}}>Time: {new Date(selected.rendez_vous).toLocaleTimeString('fr-FR', {hour:'2-digit',minute:'2-digit'})}</div>
                            <div style={{fontSize:'13px',marginTop:'1px'}}>Location: Secretary Office, BIT</div>
                          </>
                        : <div style={{fontSize:'13px',marginTop:'2px'}}>Please visit the secretary office to collect your document.</div>
                      }
                    </div>
                  </div>
                )}
                {selected.statut === 'PRET' && selected.format === 'PDF' && (
                  <div style={s.readyBanner}>
                    <span className="material-icons" style={{fontSize:'20px'}}>mark_email_read</span>
                    <div>
                      <strong>Your document has been sent to your email!</strong>
                      <div style={{fontSize:'13px',marginTop:'2px'}}>Please check your inbox for the PDF document.</div>
                    </div>
                  </div>
                )}
                {selected.statut === 'REJETE' && (
                  <div style={s.rejectedBanner}>
                    <span className="material-icons" style={{fontSize:'20px'}}>cancel</span>
                    <div>
                      <strong>Request Rejected</strong>
                      <div style={{fontSize:'13px',marginTop:'2px'}}>Please contact the secretary office for more information.</div>
                    </div>
                  </div>
                )}
                {selected.statut === 'EN_ATTENTE_JUSTIFICATION' && (
                  <div style={s.justificationBanner}>
                    <span className="material-icons" style={{fontSize:'20px'}}>warning</span>
                    <div>
                      <strong>Action Required — Pending Justification</strong>
                      {selected.rejection_service && (
                        <div style={{fontSize:'13px',marginTop:'4px'}}>
                          Flagged by: <strong>{SERVICE_LABEL[selected.rejection_service] || selected.rejection_service}</strong>
                        </div>
                      )}
                      {selected.rejection_reason && (
                        <div style={{fontSize:'13px',marginTop:'2px'}}>
                          Reason: "{selected.rejection_reason}"
                        </div>
                      )}
                      <div style={{fontSize:'13px',marginTop:'6px'}}>
                        Please contact the Secretary Office to resolve this issue. Once resolved, the department will reopen your request.
                      </div>
                    </div>
                  </div>
                )}

                {/* Validation timeline */}
                <div style={s.detailCard}>
                  <div style={s.detailCardHeader}>
                    <span className="material-icons" style={{color:'#f59e0b',marginRight:'8px',fontSize:'20px'}}>timeline</span>
                    <span style={s.detailCardTitle}>Progress</span>
                  </div>
                  {loadingDetail ? (
                    <div style={s.center}>Loading...</div>
                  ) : selected.type === 'RELEVE_NOTES' ? (
                    <TranscriptTimeline statut={selected.statut} format={selected.format} />
                  ) : (
                    <DeptTimeline statut={selected.statut} validations={validations} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

// ── Transcript timeline (no dept validation) ──────────────────────────────────
function TranscriptTimeline({ statut, format }) {
  const steps = [
    { key: 'SUBMITTED',   label: 'Submitted',   icon: 'upload_file',   done: true },
    { key: 'PROCESSING',  label: 'Processing',  icon: 'pending_actions',
      done: ['EN_TRAITEMENT','PRET','RETIRE'].includes(statut) },
    { key: 'READY',       label: format === 'PDF' ? 'PDF Sent to Email' : 'Ready for Pickup',
      icon: format === 'PDF' ? 'mark_email_read' : 'event_available',
      done: ['PRET','RETIRE'].includes(statut) },
    { key: 'COLLECTED',   label: 'Collected',   icon: 'task_alt',
      done: statut === 'RETIRE' },
  ]
  return (
    <div style={s.timeline}>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1
        return (
          <div key={step.key} style={s.timelineRow}>
            <div style={s.timelineLeft}>
              <div style={{...s.timelineDot, background: step.done ? '#10b981' : '#e2e8f0'}}>
                <span className="material-icons" style={{fontSize:'16px', color: step.done ? '#fff' : '#94a3b8'}}>{step.icon}</span>
              </div>
              {!isLast && <div style={{...s.timelineLine, background: step.done ? '#10b981' : '#e2e8f0'}} />}
            </div>
            <div style={s.timelineBody}>
              <div style={s.timelineSvc}>{step.label}</div>
              <div style={{fontSize:'12px', color: step.done ? '#10b981' : '#94a3b8', marginTop:'2px'}}>
                {step.done ? 'Done' : 'Pending'}
              </div>
            </div>
            <div style={{...s.stepBadge, background: step.done ? '#dcfce7' : '#f1f5f9', color: step.done ? '#166534' : '#94a3b8'}}>
              {idx + 1}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Attestation / Diploma timeline (dept validation chain) ────────────────────
function DeptTimeline({ statut, validations }) {
  const allApproved = statut === 'APPROUVE' || statut === 'PRET' || statut === 'RETIRE'
  const isReady     = statut === 'PRET' || statut === 'RETIRE'
  const isCollected = statut === 'RETIRE'

  const deptSteps = ['CAISSE', 'IT', 'LABORATOIRE']
  const extraSteps = [
    { key: 'SUBMITTED', label: 'Submitted',            icon: 'upload_file',    done: true },
    ...deptSteps.map(svc => {
      const val = validations.find(v => v.service === svc)
      return {
        key: svc,
        label: SERVICE_LABEL[svc],
        icon: SERVICE_ICON[svc],
        done: val?.statut === 'VALIDE',
        rejected: val?.statut === 'REJETE',
        comment: val?.commentaire,
        date: val?.date_validation,
      }
    }),
    { key: 'APPROVED', label: 'All Departments Approved', icon: 'verified',    done: allApproved },
    { key: 'READY',    label: 'Ready (Secretary Action)', icon: 'event_available', done: isReady },
    { key: 'COLLECTED',label: 'Collected',               icon: 'task_alt',     done: isCollected },
  ]

  return (
    <div style={s.timeline}>
      {extraSteps.map((step, idx) => {
        const isLast = idx === extraSteps.length - 1
        return (
          <div key={step.key} style={s.timelineRow}>
            <div style={s.timelineLeft}>
              <div style={{...s.timelineDot, background: step.rejected ? '#ef4444' : step.done ? '#10b981' : '#e2e8f0'}}>
                <span className="material-icons" style={{fontSize:'16px', color: step.done || step.rejected ? '#fff' : '#94a3b8'}}>{step.icon}</span>
              </div>
              {!isLast && <div style={{...s.timelineLine, background: step.done ? '#10b981' : '#e2e8f0'}} />}
            </div>
            <div style={s.timelineBody}>
              <div style={s.timelineSvc}>{step.label}</div>
              <div style={{fontSize:'12px', color: step.rejected ? '#ef4444' : step.done ? '#10b981' : '#94a3b8', marginTop:'2px'}}>
                {step.rejected ? 'Rejected' : step.done
                  ? `Approved${step.date ? ' · ' + new Date(step.date).toLocaleDateString('fr-FR') : ''}`
                  : 'Pending'}
              </div>
              {step.comment && <div style={s.timelineComment}>"{step.comment}"</div>}
            </div>
            <div style={{...s.stepBadge,
              background: step.rejected ? '#fee2e2' : step.done ? '#dcfce7' : '#f1f5f9',
              color: step.rejected ? '#991b1b' : step.done ? '#166534' : '#94a3b8'}}>
              {idx + 1}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function InfoRow({ label, value, fullWidth }) {
  return (
    <div style={{ gridColumn: fullWidth ? '1/-1' : undefined }}>
      <div style={{fontSize:'11px',fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.04em',marginBottom:'2px'}}>{label}</div>
      <div style={{fontSize:'14px',color:'#0f172a'}}>{value}</div>
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
  main:         { flex:1, padding:'32px', overflow:'auto', display:'flex', flexDirection:'column' },
  header:       { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' },
  pageTitle:    { fontSize:'24px', fontWeight:700, color:'#0f172a', margin:0 },
  pageSubtitle: { fontSize:'14px', color:'#64748b', margin:'4px 0 0' },
  newBtn:       { display:'flex', alignItems:'center', background:'#C8184A', color:'#fff', border:'none', borderRadius:'8px', padding:'10px 18px', fontSize:'14px', fontWeight:600, cursor:'pointer' },
  layout:       { display:'grid', gridTemplateColumns:'300px 1fr', gap:'20px', flex:1, alignItems:'start' },
  listPanel:    { background:'#fff', borderRadius:'12px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', overflow:'hidden' },
  panelHeader:  { padding:'16px 20px', borderBottom:'1px solid #f1f5f9', fontSize:'15px', fontWeight:600, color:'#0f172a' },
  requestCard:  { padding:'14px 16px', borderLeft:'3px solid', cursor:'pointer', transition:'all 0.15s', borderBottom:'1px solid #f8fafc' },
  cardTop:      { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' },
  reqType:      { fontSize:'13px', fontWeight:600, color:'#0f172a' },
  statusDot:    { padding:'2px 8px', borderRadius:'20px', fontSize:'11px', fontWeight:600 },
  cardBottom:   { display:'flex', alignItems:'center', justifyContent:'space-between' },
  reqId:        { fontSize:'11px', color:'#94a3b8' },
  reqDate:      { fontSize:'11px', color:'#94a3b8' },
  center:       { padding:'40px', textAlign:'center', color:'#94a3b8' },
  empty:        { padding:'40px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center' },
  detailPanel:  { display:'flex', flexDirection:'column', gap:'16px' },
  placeholder:  { background:'#fff', borderRadius:'12px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', padding:'80px 20px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' },
  detailCard:   { background:'#fff', borderRadius:'12px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', padding:'20px' },
  detailCardHeader: { display:'flex', alignItems:'center', marginBottom:'16px' },
  detailCardTitle:  { fontSize:'15px', fontWeight:600, color:'#0f172a' },
  statusPill:   { padding:'3px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:600 },
  infoGrid:     { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' },
  approvedBanner:{ display:'flex', gap:'12px', background:'#ede9fe', border:'1px solid #c4b5fd', borderRadius:'10px', padding:'14px 16px', color:'#5b21b6', alignItems:'flex-start' },
  readyBanner:  { display:'flex', gap:'12px', background:'#dcfce7', border:'1px solid #86efac', borderRadius:'10px', padding:'14px 16px', color:'#166534', alignItems:'flex-start' },
  rejectedBanner:    { display:'flex', gap:'12px', background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:'10px', padding:'14px 16px', color:'#991b1b', alignItems:'flex-start' },
  justificationBanner:{ display:'flex', gap:'12px', background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:'10px', padding:'14px 16px', color:'#92400e', alignItems:'flex-start' },
  timeline:     { display:'flex', flexDirection:'column', gap:'0' },
  timelineRow:  { display:'flex', gap:'12px', alignItems:'flex-start' },
  timelineLeft: { display:'flex', flexDirection:'column', alignItems:'center', width:'32px', flexShrink:0 },
  timelineDot:  { width:'32px', height:'32px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, zIndex:1 },
  timelineLine: { width:'2px', flex:1, minHeight:'20px', marginTop:'2px' },
  timelineBody: { flex:1, paddingBottom:'16px' },
  timelineSvc:  { fontSize:'13px', fontWeight:600, color:'#0f172a' },
  timelineComment:{ fontSize:'11px', color:'#6366f1', fontStyle:'italic', marginTop:'4px' },
  stepBadge:    { width:'22px', height:'22px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'11px', fontWeight:700, flexShrink:0, marginTop:'4px' },
}
