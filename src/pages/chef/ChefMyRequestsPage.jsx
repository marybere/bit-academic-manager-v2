import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import NotificationBell from '../../components/NotificationBell'

const STATUT_STYLE = {
  EN_ATTENTE:               { bg:'#fef3c7', color:'#92400e', label:'Pending'             },
  EN_TRAITEMENT:            { bg:'#dbeafe', color:'#1e40af', label:'In Progress'          },
  EN_ATTENTE_JUSTIFICATION: { bg:'#fff7ed', color:'#c2410c', label:'Needs Justification'  },
  APPROUVE:                 { bg:'#dcfce7', color:'#166534', label:'Approved'             },
  PRET:                     { bg:'#d1fae5', color:'#065f46', label:'Ready for Pickup'     },
  REJETE:                   { bg:'#fee2e2', color:'#991b1b', label:'Rejected'             },
}

const TYPE_LABEL = {
  RELEVE_NOTES:            'Transcript',
  ATTESTATION_INSCRIPTION: 'Enrollment Certificate',
  DIPLOME:                 'Diploma',
  AUTRE:                   'Other',
}

export default function ChefMyRequestsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [requests,  setRequests]  = useState([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [classInfo, setClassInfo] = useState(null)

  useEffect(() => {
    if (user?.classe_id) {
      api.get(`/classes/${user.classe_id}/students`)
        .then(res => setClassInfo(res.data))
        .catch(() => {})
    }
  }, [user])

  useEffect(() => {
    api.get('/requests/my')
      .then(res => setRequests(res.data.requests || []))
      .catch(err => setError(err.response?.data?.error || 'Failed to load requests.'))
      .finally(() => setLoading(false))
  }, [])

  const formatDate = (d) => new Date(d).toLocaleDateString('fr-FR', {
    day:'numeric', month:'short', year:'numeric',
  })

  return (
    <div style={s.page}>
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <img src="/icons/bit-logo.png" alt="BIT" style={{width:'36px',height:'36px',objectFit:'contain',borderRadius:'6px',background:'#fff',padding:'3px',flexShrink:0}} />
          <span style={s.logoText}>Academic Manager</span>
        </div>
        <nav style={s.nav}>
          <div style={s.navItem} onClick={() => navigate('/chef/dashboard')}>
            <span className="material-icons" style={s.navIcon}>dashboard</span>Dashboard
          </div>
          <div style={s.navItem} onClick={() => navigate('/chef/attendance')}>
            <span className="material-icons" style={s.navIcon}>fact_check</span>Take Attendance
          </div>
          <div style={s.navItem} onClick={() => navigate('/chef/history')}>
            <span className="material-icons" style={s.navIcon}>history</span>History
          </div>
          <div style={s.navItem} onClick={() => navigate('/chef/requests/new')}>
            <span className="material-icons" style={s.navIcon}>add_circle</span>New Request
          </div>
          <div style={{...s.navItem,...s.navActive}}>
            <span className="material-icons" style={s.navIcon}>description</span>My Requests
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
              {classInfo?.class ? `Class Rep — ${classInfo.class.filiere} ${classInfo.class.niveau}` : 'Class Representative'}
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

      <main style={s.main}>
        <header style={s.header}>
          <div>
            <h1 style={s.pageTitle}>My Requests</h1>
            <p style={s.pageSubtitle}>Track the status of your document requests</p>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <NotificationBell />
            <button style={s.newBtn} onClick={() => navigate('/chef/requests/new')}>
              <span className="material-icons" style={{fontSize:'18px',marginRight:'6px'}}>add_circle</span>
              New Request
            </button>
          </div>
        </header>

        {loading ? (
          <div style={s.empty}>Loading...</div>
        ) : error ? (
          <div style={s.errorMsg}>{error}</div>
        ) : requests.length === 0 ? (
          <div style={s.emptyState}>
            <span className="material-icons" style={{fontSize:'48px',color:'#cbd5e1',marginBottom:'12px'}}>description</span>
            <div style={{fontWeight:600,color:'#374151',marginBottom:'6px'}}>No requests yet</div>
            <div style={{color:'#64748b',fontSize:'14px',marginBottom:'20px'}}>Submit your first document request to get started.</div>
            <button style={s.newBtn} onClick={() => navigate('/chef/requests/new')}>
              <span className="material-icons" style={{fontSize:'18px',marginRight:'6px'}}>add_circle</span>
              New Request
            </button>
          </div>
        ) : (
          <div style={s.list}>
            {requests.map(r => {
              const st = STATUT_STYLE[r.statut] || { bg:'#f1f5f9', color:'#475569', label: r.statut }
              return (
                <div key={r.id} style={s.card}>
                  <div style={s.cardLeft}>
                    <div style={s.cardType}>{TYPE_LABEL[r.type] || r.type}</div>
                    <div style={s.cardMeta}>
                      {r.format === 'PDF' ? 'PDF (digital)' : 'Paper (printed)'}
                      {' · '}Submitted {formatDate(r.date_demande)}
                    </div>
                    {r.statut === 'EN_ATTENTE_JUSTIFICATION' && r.rejection_reason && (
                      <div style={s.flagNote}>
                        <span className="material-icons" style={{fontSize:'14px',marginRight:'4px'}}>warning</span>
                        {r.rejection_reason}
                      </div>
                    )}
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <span style={{...s.badge, background:st.bg, color:st.color}}>{st.label}</span>
                  </div>
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
  page:        { display:'flex', minHeight:'100vh', background:'#f8fafc', fontFamily:"'Inter',sans-serif" },
  sidebar:     { width:'240px', background:'#0F1929', display:'flex', flexDirection:'column', padding:'24px 0', flexShrink:0 },
  logo:        { display:'flex', alignItems:'center', gap:'10px', padding:'0 20px 24px', borderBottom:'1px solid rgba(255,255,255,0.08)' },
  logoText:    { color:'#C8184A', fontSize:'15px', fontWeight:600 },
  nav:         { flex:1, padding:'16px 12px' },
  navItem:     { display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', borderRadius:'8px', color:'rgba(255,255,255,0.6)', fontSize:'14px', cursor:'pointer', marginBottom:'4px' },
  navActive:   { background:'rgba(200,24,74,0.15)', color:'#fff' },
  navIcon:     { fontSize:'20px' },
  main:        { flex:1, padding:'32px', overflow:'auto' },
  header:      { display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'28px' },
  pageTitle:   { fontSize:'24px', fontWeight:700, color:'#0f172a', margin:'0 0 4px' },
  pageSubtitle:{ fontSize:'14px', color:'#64748b', margin:0 },
  newBtn:      { display:'flex', alignItems:'center', background:'#C8184A', color:'#fff', border:'none', borderRadius:'8px', padding:'10px 18px', fontSize:'14px', fontWeight:600, cursor:'pointer' },
  list:        { display:'flex', flexDirection:'column', gap:'12px' },
  card:        { background:'#fff', borderRadius:'12px', padding:'18px 22px', display:'flex', justifyContent:'space-between', alignItems:'center', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', border:'1px solid #f1f5f9' },
  cardLeft:    { flex:1 },
  cardType:    { fontSize:'15px', fontWeight:600, color:'#0f172a', marginBottom:'4px' },
  cardMeta:    { fontSize:'13px', color:'#64748b' },
  flagNote:    { display:'flex', alignItems:'center', fontSize:'12px', color:'#c2410c', marginTop:'6px', background:'#fff7ed', borderRadius:'6px', padding:'4px 8px', width:'fit-content' },
  badge:       { padding:'4px 12px', borderRadius:'20px', fontSize:'12px', fontWeight:600, whiteSpace:'nowrap' },
  empty:       { textAlign:'center', color:'#64748b', padding:'60px 0', fontSize:'15px' },
  emptyState:  { display:'flex', flexDirection:'column', alignItems:'center', padding:'80px 0', textAlign:'center' },
  errorMsg:    { background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'12px 16px', color:'#dc2626', fontSize:'14px' },
}
