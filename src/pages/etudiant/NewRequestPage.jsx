import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'

const TYPES = [
  { value:'RELEVE_NOTES',            label:'Transcript (Relevé de notes)' },
  { value:'ATTESTATION_INSCRIPTION', label:'Enrollment Certificate (Attestation)' },
  { value:'DIPLOME',                 label:'Diploma' },
  { value:'AUTRE',                   label:'Other' },
]
const FORMATS = [
  { value:'PDF',    label:'PDF (digital)' },
  { value:'PAPIER', label:'Paper (printed copy)' },
]

export default function NewRequestPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [form, setForm]     = useState({ type:'RELEVE_NOTES', format:'PDF', notes:'' })
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/requests', form)
      setSuccess(true)
      setTimeout(() => navigate(`/etudiant/track/${res.data.request.id}`), 1200)
    } catch (err) {
      setError(err.response?.data?.error || 'Submission failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <aside style={s.sidebar}>
        <div style={s.logo}><img src="/icons/bit-logo.png" alt="BIT" style={{width:'36px',height:'36px',objectFit:'contain',borderRadius:'6px',background:'#fff',padding:'3px',flexShrink:0}} /><span style={s.logoText}>Academic Manager</span></div>
        <nav style={s.nav}>
          <div style={s.navItem} onClick={() => navigate('/etudiant/dashboard')}>
            <span className="material-icons" style={s.navIcon}>dashboard</span>Dashboard
          </div>
          <div style={{...s.navItem,...s.navActive}}>
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
        <div style={s.topBar}>
          <button style={s.backBtn} onClick={() => navigate('/etudiant/dashboard')}>
            <span className="material-icons" style={{fontSize:'18px',marginRight:'4px'}}>arrow_back</span>Back
          </button>
        </div>

        <div style={s.formWrap}>
          <div style={s.formHeader}>
            <span className="material-icons" style={{fontSize:'32px',color:'#C8184A',marginBottom:'8px'}}>description</span>
            <h1 style={s.formTitle}>New Document Request</h1>
            <p style={s.formSubtitle}>Select the document type and format. Your request will be processed by the secretary office.</p>
          </div>

          {success ? (
            <div style={s.successBox}>
              <span className="material-icons" style={{fontSize:'40px',color:'#10b981',marginBottom:'8px'}}>check_circle</span>
              <div style={{fontWeight:700,fontSize:'16px',color:'#0f172a'}}>Request Submitted!</div>
              <div style={{color:'#64748b',fontSize:'14px',marginTop:'4px'}}>Redirecting to tracking page...</div>
            </div>
          ) : (
            <form style={s.form} onSubmit={handleSubmit}>
              {error && <div style={s.errorMsg}>{error}</div>}

              <div style={s.field}>
                <label style={s.label}>Document Type</label>
                {TYPES.map(t => (
                  <label key={t.value} style={{...s.radioLabel, borderColor: form.type===t.value?'#C8184A':'#e2e8f0', background: form.type===t.value?'#fff5f7':'#fff'}}>
                    <input type="radio" name="type" value={t.value} checked={form.type===t.value}
                      onChange={e => setForm(p=>({...p,type:e.target.value}))} style={{accentColor:'#C8184A'}} />
                    <span style={{marginLeft:'10px', fontSize:'14px', color:'#374151', fontWeight: form.type===t.value?600:400}}>{t.label}</span>
                  </label>
                ))}
              </div>

              <div style={s.field}>
                <label style={s.label}>Format</label>
                <div style={{display:'flex',gap:'10px'}}>
                  {FORMATS.map(f => (
                    <label key={f.value} style={{...s.radioLabel, flex:1, borderColor: form.format===f.value?'#C8184A':'#e2e8f0', background: form.format===f.value?'#fff5f7':'#fff'}}>
                      <input type="radio" name="format" value={f.value} checked={form.format===f.value}
                        onChange={e => setForm(p=>({...p,format:e.target.value}))} style={{accentColor:'#C8184A'}} />
                      <span style={{marginLeft:'10px', fontSize:'14px', color:'#374151', fontWeight: form.format===f.value?600:400}}>{f.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div style={s.field}>
                <label style={s.label}>Additional Notes (optional)</label>
                <textarea style={s.textarea} value={form.notes}
                  onChange={e => setForm(p=>({...p,notes:e.target.value}))}
                  placeholder="Any special instructions or details..." />
              </div>

              <div style={s.infoBox}>
                <span className="material-icons" style={{fontSize:'18px',color:'#6366f1',flexShrink:0}}>info</span>
                <div style={{fontSize:'13px',color:'#4338ca'}}>
                  Your request will go through validation by Finance, IT, and Laboratory departments before it's ready for collection.
                  Estimated processing time: <strong>3–5 business days</strong>.
                </div>
              </div>

              <button style={{...s.submitBtn,opacity:loading?0.7:1}} type="submit" disabled={loading}>
                {loading ? 'Submitting...' : 'Submit Request'}
                <span className="material-icons" style={{fontSize:'18px',marginLeft:'8px'}}>send</span>
              </button>
            </form>
          )}
        </div>
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
  sidebarBottom: { padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:'8px' },
  userInfo:    { flex:1, display:'flex', alignItems:'center', gap:'10px' },
  avatar:      { width:'34px', height:'34px', borderRadius:'50%', background:'#C8184A', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:700, flexShrink:0 },
  userName:    { color:'#fff', fontSize:'13px', fontWeight:600 },
  userRole:    { color:'rgba(255,255,255,0.5)', fontSize:'11px' },
  logoutBtn:   { background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', padding:'4px' },
  main:        { flex:1, padding:'32px', overflow:'auto', display:'flex', flexDirection:'column' },
  topBar:      { marginBottom:'20px' },
  backBtn:     { display:'flex', alignItems:'center', background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:'8px', padding:'8px 14px', fontSize:'13px', color:'#374151', cursor:'pointer', fontWeight:500 },
  formWrap:    { background:'#fff', borderRadius:'14px', padding:'32px', maxWidth:'560px', width:'100%', margin:'0 auto', boxShadow:'0 1px 3px rgba(0,0,0,0.06)' },
  formHeader:  { textAlign:'center', marginBottom:'28px', display:'flex', flexDirection:'column', alignItems:'center' },
  formTitle:   { fontSize:'22px', fontWeight:700, color:'#0f172a', margin:'0 0 8px' },
  formSubtitle:{ fontSize:'14px', color:'#64748b', margin:0, lineHeight:1.5 },
  form:        { display:'flex', flexDirection:'column', gap:'20px' },
  field:       { display:'flex', flexDirection:'column', gap:'8px' },
  label:       { fontSize:'13px', fontWeight:600, color:'#374151' },
  radioLabel:  { display:'flex', alignItems:'center', padding:'12px 14px', border:'1.5px solid', borderRadius:'8px', cursor:'pointer', transition:'all 0.15s' },
  textarea:    { width:'100%', padding:'10px 12px', border:'1.5px solid #e2e8f0', borderRadius:'8px', fontSize:'14px', background:'#f8fafc', outline:'none', boxSizing:'border-box', height:'90px', resize:'vertical', fontFamily:'inherit' },
  infoBox:     { display:'flex', gap:'10px', background:'#eef2ff', borderRadius:'8px', padding:'12px 14px', alignItems:'flex-start' },
  errorMsg:    { background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', color:'#dc2626', fontSize:'13px' },
  successBox:  { display:'flex', flexDirection:'column', alignItems:'center', padding:'40px 20px', textAlign:'center' },
  submitBtn:   { display:'flex', alignItems:'center', justifyContent:'center', background:'#C8184A', color:'#fff', border:'none', borderRadius:'8px', padding:'13px 24px', fontSize:'15px', fontWeight:600, cursor:'pointer' },
}
