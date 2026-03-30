import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import NotificationBell from '../../components/NotificationBell'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend,
} from 'recharts'

const TYPE_LABEL = { RELEVE_NOTES:'Transcript', ATTESTATION_INSCRIPTION:'Enrollment', DIPLOME:'Diploma', AUTRE:'Other' }
const STATUT_COLOR = { EN_ATTENTE:'#f59e0b', EN_TRAITEMENT:'#6366f1', PRET:'#10b981', RETIRE:'#94a3b8', REJETE:'#ef4444' }

export default function DirecteurAnalyticsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [absenceData, setAbsenceData] = useState(null)
  const [requestData, setRequestData] = useState(null)
  const [tab,         setTab]         = useState('absences')
  const [loading,     setLoading]     = useState(true)

  useEffect(() => {
    Promise.all([
      api.get('/analytics/absences'),
      api.get('/analytics/requests'),
    ]).then(([absRes, reqRes]) => {
      setAbsenceData(absRes.data)
      setRequestData(reqRes.data)
    }).catch(err => console.error(err.message))
      .finally(() => setLoading(false))
  }, [])

  const handleExport = () => {
    if (!absenceData) return
    const rows = [
      ['Class','Total Absences','Rate (%)'],
      ...absenceData.by_class.map(c => [c.class_name, c.total_absences, c.rate]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['\uFEFF'+csv], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href=url; a.download='absences.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={s.page}>
      <aside style={s.sidebar}>
        <div style={s.logo}><img src="/icons/bit-logo.png" alt="BIT" style={{width:'36px',height:'36px',objectFit:'contain',borderRadius:'6px',background:'#fff',padding:'3px',flexShrink:0}} /><span style={s.logoText}>Academic Manager</span></div>
        <nav style={s.nav}>
          <div style={{...s.navItem,...s.navActive}}>
            <span className="material-icons" style={s.navIcon}>analytics</span>Analytics
          </div>
        </nav>
        <div style={s.sidebarBottom}>
          <div style={s.userInfo}>
            <div style={s.avatar}>{user?.prenom?.[0]}{user?.nom?.[0]}</div>
            <div><div style={s.userName}>{user?.prenom} {user?.nom}</div><div style={s.userRole}>Directeur</div></div>
          </div>
          <button style={s.logoutBtn} onClick={logout}><span className="material-icons" style={{fontSize:'18px'}}>logout</span></button>
        </div>
      </aside>

      <main style={s.main}>
        <header style={s.header}>
          <div>
            <h1 style={s.pageTitle}>Analytics Dashboard</h1>
            <p style={s.pageSubtitle}>School performance overview for {new Date().getFullYear()}</p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            <NotificationBell />
            <button style={s.exportBtn} onClick={handleExport}>
              <span className="material-icons" style={{fontSize:'18px',marginRight:'6px'}}>download</span>Export CSV
            </button>
          </div>
        </header>

        {loading ? <div style={s.center}>Loading analytics...</div> : (
          <>
            {/* Tab switcher */}
            <div style={s.tabs}>
              {['absences','requests'].map(t => (
                <button key={t} style={{...s.tab, ...(tab===t?s.tabActive:{})}} onClick={() => setTab(t)}>
                  <span className="material-icons" style={{fontSize:'18px',marginRight:'6px'}}>
                    {t==='absences'?'event_busy':'description'}
                  </span>
                  {t==='absences'?'Attendance':'Requests'}
                </button>
              ))}
            </div>

            {tab === 'absences' && absenceData && (
              <>
                {/* KPIs */}
                <div style={s.kpiGrid}>
                  {[
                    { icon:'event_busy', label:'Global Absence Rate', value:`${absenceData.global_rate}%`, color:'#ef4444' },
                    { icon:'warning',    label:'At-Risk Students',     value:absenceData.at_risk_students.length, color:'#f59e0b' },
                    { icon:'school',     label:'Classes Tracked',      value:absenceData.by_class.length, color:'#6366f1' },
                  ].map(k => (
                    <div key={k.label} style={s.kpiCard}>
                      <div style={{...s.kpiIcon, background:k.color+'18', color:k.color}}>
                        <span className="material-icons">{k.icon}</span>
                      </div>
                      <div>
                        <div style={s.kpiValue}>{k.value}</div>
                        <div style={s.kpiLabel}>{k.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={s.chartsRow}>
                  {/* Absences by class */}
                  <div style={s.chartCard}>
                    <div style={s.chartTitle}>Absence Rate by Class</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={absenceData.by_class} margin={{top:4,right:8,left:-16,bottom:40}}>
                        <XAxis dataKey="class_name" tick={{fontSize:10}} angle={-40} textAnchor="end" interval={0} />
                        <YAxis tick={{fontSize:11}} unit="%" />
                        <Tooltip formatter={v => `${v}%`} />
                        <Bar dataKey="rate" name="Absence Rate" fill="#ef4444" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Absences by month */}
                  <div style={s.chartCard}>
                    <div style={s.chartTitle}>Monthly Absences (Last 6 Months)</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={absenceData.by_month} margin={{top:4,right:8,left:-16,bottom:4}}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="month" tick={{fontSize:11}} />
                        <YAxis tick={{fontSize:11}} />
                        <Tooltip />
                        <Line type="monotone" dataKey="total_absences" name="Absences" stroke="#C8184A" strokeWidth={2} dot={{r:4}} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* At-risk students */}
                {absenceData.at_risk_students.length > 0 && (
                  <div style={s.tableCard}>
                    <div style={s.tableHeader}>
                      <span className="material-icons" style={{color:'#f59e0b',marginRight:'8px'}}>warning</span>
                      <span style={s.tableTitle}>At-Risk Students (&gt;20% absence rate)</span>
                    </div>
                    <table style={s.table}>
                      <thead><tr style={s.theadRow}>
                        <th style={s.th}>Student</th><th style={s.th}>Class</th>
                        <th style={s.th}>Absences</th><th style={s.th}>Total</th><th style={s.th}>Rate</th>
                      </tr></thead>
                      <tbody>
                        {absenceData.at_risk_students.map(st => (
                          <tr key={st.id} style={s.tr}>
                            <td style={s.td}><strong>{st.prenom} {st.nom}</strong></td>
                            <td style={{...s.td,color:'#64748b'}}>{st.classe || '—'}</td>
                            <td style={s.td}>{st.absences}</td>
                            <td style={{...s.td,color:'#64748b'}}>{st.total}</td>
                            <td style={s.td}>
                              <span style={{...s.rateBadge, background: st.rate>30?'#fee2e2':'#fef9c3', color: st.rate>30?'#991b1b':'#854d0e'}}>
                                {st.rate}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {tab === 'requests' && requestData && (
              <>
                {/* KPIs */}
                <div style={s.kpiGrid}>
                  {[
                    { icon:'hourglass_empty', label:'Pending Requests',       value:requestData.total_pending,          color:'#f59e0b' },
                    { icon:'done_all',        label:'Processed Today',         value:requestData.processed_today,         color:'#10b981' },
                    { icon:'description',     label:'Transcripts This Month',  value:requestData.transcripts_this_month,  color:'#6366f1' },
                    { icon:'timer',           label:'Avg Processing (days)',   value:requestData.avg_processing_days||'—', color:'#C8184A' },
                  ].map(k => (
                    <div key={k.label} style={s.kpiCard}>
                      <div style={{...s.kpiIcon, background:k.color+'18', color:k.color}}>
                        <span className="material-icons">{k.icon}</span>
                      </div>
                      <div>
                        <div style={s.kpiValue}>{k.value}</div>
                        <div style={s.kpiLabel}>{k.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={s.chartsRow}>
                  {/* By type */}
                  <div style={s.chartCard}>
                    <div style={s.chartTitle}>Requests by Type</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={requestData.by_type.map(d=>({...d, name: TYPE_LABEL[d.type]||d.type}))}
                        margin={{top:4,right:8,left:-16,bottom:4}}>
                        <XAxis dataKey="name" tick={{fontSize:11}} />
                        <YAxis tick={{fontSize:11}} />
                        <Tooltip />
                        <Bar dataKey="count" name="Requests" fill="#6366f1" radius={[4,4,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* By status */}
                  <div style={s.chartCard}>
                    <div style={s.chartTitle}>Requests by Status</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={requestData.by_status} margin={{top:4,right:8,left:-16,bottom:4}}>
                        <XAxis dataKey="statut" tick={{fontSize:10}} />
                        <YAxis tick={{fontSize:11}} />
                        <Tooltip />
                        <Bar dataKey="count" name="Count" radius={[4,4,0,0]}
                          fill="#C8184A"
                          label={false}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </main>
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
  sidebarBottom:{ padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:'8px' },
  userInfo:    { flex:1, display:'flex', alignItems:'center', gap:'10px' },
  avatar:      { width:'34px', height:'34px', borderRadius:'50%', background:'#C8184A', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:700, flexShrink:0 },
  userName:    { color:'#fff', fontSize:'13px', fontWeight:600 },
  userRole:    { color:'rgba(255,255,255,0.5)', fontSize:'11px' },
  logoutBtn:   { background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', padding:'4px' },
  main:        { flex:1, padding:'32px', overflow:'auto' },
  header:      { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'20px', flexWrap:'wrap', gap:'12px' },
  pageTitle:   { fontSize:'24px', fontWeight:700, color:'#0f172a', margin:0 },
  pageSubtitle:{ fontSize:'14px', color:'#64748b', margin:'4px 0 0' },
  exportBtn:   { display:'flex', alignItems:'center', background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:'8px', padding:'9px 16px', fontSize:'13px', color:'#374151', cursor:'pointer', fontWeight:500 },
  tabs:        { display:'flex', gap:'8px', marginBottom:'20px' },
  tab:         { display:'flex', alignItems:'center', background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:'8px', padding:'8px 16px', fontSize:'13px', color:'#64748b', cursor:'pointer', fontWeight:500 },
  tabActive:   { background:'#C8184A', border:'1.5px solid #C8184A', color:'#fff' },
  center:      { textAlign:'center', color:'#94a3b8', padding:'80px' },
  kpiGrid:     { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))', gap:'14px', marginBottom:'20px' },
  kpiCard:     { background:'#fff', borderRadius:'12px', padding:'18px 20px', display:'flex', alignItems:'center', gap:'14px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' },
  kpiIcon:     { width:'44px', height:'44px', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  kpiValue:    { fontSize:'22px', fontWeight:700, color:'#0f172a' },
  kpiLabel:    { fontSize:'12px', color:'#64748b', marginTop:'2px' },
  chartsRow:   { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px', marginBottom:'20px' },
  chartCard:   { background:'#fff', borderRadius:'12px', padding:'20px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' },
  chartTitle:  { fontSize:'14px', fontWeight:600, color:'#374151', marginBottom:'14px' },
  tableCard:   { background:'#fff', borderRadius:'12px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', overflow:'hidden' },
  tableHeader: { display:'flex', alignItems:'center', padding:'16px 20px', borderBottom:'1px solid #f1f5f9' },
  tableTitle:  { fontSize:'15px', fontWeight:600, color:'#0f172a' },
  table:       { width:'100%', borderCollapse:'collapse' },
  theadRow:    { background:'#f8fafc' },
  th:          { textAlign:'left', padding:'10px 14px', fontSize:'11px', fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:'1px solid #f1f5f9' },
  tr:          { borderBottom:'1px solid #f8fafc' },
  td:          { padding:'12px 14px', fontSize:'13px', color:'#374151' },
  rateBadge:   { padding:'3px 8px', borderRadius:'20px', fontSize:'12px', fontWeight:600 },
}
