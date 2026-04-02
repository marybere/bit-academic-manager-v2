import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import NotificationBell from '../../components/NotificationBell'

const ROLES = ['STUDENT','CHEF_CLASSE','SECRETAIRE','DIRECTEUR','CAISSE','IT','LABORATOIRE','ADMIN']
const ROLE_COLOR = {
  STUDENT:'#6366f1', CHEF_CLASSE:'#8b5cf6', SECRETAIRE:'#C8184A',
  DIRECTEUR:'#0ea5e9', CAISSE:'#f59e0b', IT:'#10b981', LABORATOIRE:'#06b6d4', ADMIN:'#ef4444',
}

const EMPTY_FORM = { prenom:'', nom:'', email:'', password:'', role:'STUDENT', classe_id:'' }

export default function AdminSettingsPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [users,    setUsers]    = useState([])
  const [classes,  setClasses]  = useState([])
  const [loading,  setLoading]  = useState(true)
  const [roleTab,  setRoleTab]  = useState('ALL')
  const [modal,    setModal]    = useState(null)  // null | 'add' | 'edit'
  const [editing,  setEditing]  = useState(null)  // user obj when editing
  const [form,     setForm]     = useState(EMPTY_FORM)
  const [saving,       setSaving]       = useState(false)
  const [error,        setError]        = useState('')
  const [search,       setSearch]       = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([api.get('/admin/users'), api.get('/classes')])
      .then(([uRes, cRes]) => {
        setUsers(uRes.data.users)
        setClasses(cRes.data.classes || [])
      })
      .catch(err => console.error(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setEditing(null)
    setError('')
    setShowPassword(false)
    setModal('add')
  }

  const openEdit = (u) => {
    setForm({ prenom:u.prenom, nom:u.nom, email:u.email, password:'', role:u.role, classe_id:u.classe_id||'' })
    setEditing(u)
    setError('')
    setShowPassword(false)
    setModal('edit')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload = { ...form, classe_id: form.classe_id || null }
      if (modal === 'edit' && !payload.password) delete payload.password
      if (modal === 'add') {
        await api.post('/admin/users', payload)
      } else {
        await api.put(`/admin/users/${editing.id}`, payload)
      }
      setModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (u) => {
    if (!window.confirm(`Deactivate ${u.prenom} ${u.nom}?`)) return
    try {
      await api.delete(`/admin/users/${u.id}`)
      load()
    } catch (err) {
      alert(err.response?.data?.error || 'Delete failed.')
    }
  }

  const filtered = users.filter(u => {
    const matchRole = roleTab === 'ALL' || u.role === roleTab
    const q = search.toLowerCase()
    const matchSearch = !q || `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(q)
    return matchRole && matchSearch
  })

  const roleCounts = {}
  users.forEach(u => { roleCounts[u.role] = (roleCounts[u.role]||0)+1 })

  return (
    <div style={s.page}>
      <aside style={s.sidebar}>
        <div style={s.logo}><img src="/icons/bit-logo.png" alt="BIT" style={{width:'36px',height:'36px',objectFit:'contain',borderRadius:'6px',background:'#fff',padding:'3px',flexShrink:0}} /><span style={s.logoText}>Academic Manager</span></div>
        <nav style={s.nav}>
          <div style={{...s.navItem,...s.navActive}}>
            <span className="material-icons" style={s.navIcon}>manage_accounts</span>User Management
          </div>
        </nav>
        <div style={s.sidebarBottom}>
          <div style={s.userInfo}>
            <div style={s.avatar}>{user?.prenom?.[0]}{user?.nom?.[0]}</div>
            <div><div style={s.userName}>{user?.prenom} {user?.nom}</div><div style={s.userRole}>Admin</div></div>
          </div>
          <button style={s.logoutBtn} onClick={logout}><span className="material-icons" style={{fontSize:'18px'}}>logout</span></button>
        </div>
      </aside>

      <main style={s.main}>
        <header style={s.header}>
          <div>
            <h1 style={s.pageTitle}>User Management</h1>
            <p style={s.pageSubtitle}>{users.length} total accounts</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <NotificationBell />
            <button style={s.addBtn} onClick={openAdd}>
              <span className="material-icons" style={{fontSize:'18px',marginRight:'6px'}}>person_add</span>Add User
            </button>
          </div>
        </header>

        {/* Role tabs */}
        <div style={s.tabs}>
          {['ALL',...ROLES].map(r => (
            <button key={r} style={{...s.tab, ...(roleTab===r?{...s.tabActive, borderColor:r==='ALL'?'#6366f1':(ROLE_COLOR[r]||'#6366f1'), background:(r==='ALL'?'#6366f1':(ROLE_COLOR[r]||'#6366f1'))+'18', color:r==='ALL'?'#fff':(ROLE_COLOR[r]||'#6366f1')}:{})}}
              onClick={() => setRoleTab(r)}>
              {r==='ALL'?'All':r}
              {r!=='ALL' && roleCounts[r] ? <span style={s.roleCnt}>{roleCounts[r]}</span> : null}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={s.searchRow}>
          <span className="material-icons" style={{fontSize:'18px',color:'#94a3b8',marginRight:'8px'}}>search</span>
          <input style={s.searchInput} value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..." />
        </div>

        {/* Table */}
        <div style={s.tableCard}>
          {loading ? <div style={s.center}>Loading...</div>
          : filtered.length === 0 ? <div style={s.center}>No users found.</div>
          : (
            <table style={s.table}>
              <thead><tr style={s.theadRow}>
                <th style={s.th}>User</th><th style={s.th}>Email</th>
                <th style={s.th}>Role</th><th style={s.th}>Class</th>
                <th style={s.th}>Status</th><th style={s.th}></th>
              </tr></thead>
              <tbody>
                {filtered.map(u => {
                  const color = ROLE_COLOR[u.role] || '#94a3b8'
                  return (
                    <tr key={u.id} style={s.tr}>
                      <td style={s.td}>
                        <div style={s.userCell}>
                          <div style={{...s.userAvatar, background:color+'22', color}}>
                            {u.prenom?.[0]}{u.nom?.[0]}
                          </div>
                          <span style={{fontWeight:600,color:'#0f172a'}}>{u.prenom} {u.nom}</span>
                        </div>
                      </td>
                      <td style={{...s.td,color:'#64748b',fontSize:'12px'}}>{u.email}</td>
                      <td style={s.td}>
                        <span style={{...s.roleBadge, background:color+'18', color}}>{u.role}</span>
                      </td>
                      <td style={{...s.td,color:'#94a3b8',fontSize:'12px'}}>{u.classe_nom||'—'}</td>
                      <td style={s.td}>
                        <span style={{...s.statusDot, background: u.active!==false?'#dcfce7':'#fee2e2', color: u.active!==false?'#166534':'#991b1b'}}>
                          {u.active!==false?'Active':'Inactive'}
                        </span>
                      </td>
                      <td style={s.td}>
                        <div style={{display:'flex',gap:'6px'}}>
                          <button style={s.iconBtn} title="Edit" onClick={() => openEdit(u)}>
                            <span className="material-icons" style={{fontSize:'18px'}}>edit</span>
                          </button>
                          {u.id !== user?.id && (
                            <button style={{...s.iconBtn,color:'#ef4444'}} title="Deactivate" onClick={() => handleDelete(u)}>
                              <span className="material-icons" style={{fontSize:'18px'}}>person_off</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>

      {/* Add/Edit Modal */}
      {modal && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span className="material-icons" style={{color:'#C8184A',marginRight:'10px',fontSize:'22px'}}>
                {modal==='add'?'person_add':'edit'}
              </span>
              <span style={s.modalTitle}>{modal==='add'?'Add New User':'Edit User'}</span>
            </div>

            {error && <div style={s.errorMsg}>{error}</div>}

            <form onSubmit={handleSave}>
              <div style={s.formRow}>
                <div style={s.field}>
                  <label style={s.label}>First Name</label>
                  <input style={s.input} value={form.prenom} onChange={e => setForm(p=>({...p,prenom:e.target.value}))} required />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Last Name</label>
                  <input style={s.input} value={form.nom} onChange={e => setForm(p=>({...p,nom:e.target.value}))} required />
                </div>
              </div>

              <div style={s.field}>
                <label style={s.label}>Email</label>
                <input style={s.input} type="email" value={form.email} onChange={e => setForm(p=>({...p,email:e.target.value}))} required />
              </div>

              <div style={s.field}>
                <label style={s.label}>{modal==='edit'?'New Password (leave blank to keep)':'Password'}</label>
                <div style={{ position:'relative' }}>
                  <input style={{ ...s.input, paddingRight:'40px' }}
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(p=>({...p,password:e.target.value}))}
                    required={modal==='add'}
                    placeholder={modal==='edit'?'Leave blank to keep current':''} />
                  <button type="button" onClick={() => setShowPassword(v=>!v)}
                    style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', padding:'4px', color:'#94a3b8', display:'flex', alignItems:'center' }}>
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div style={s.formRow}>
                <div style={s.field}>
                  <label style={s.label}>Role</label>
                  <select style={s.input} value={form.role} onChange={e => setForm(p=>({...p,role:e.target.value}))}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Class (optional)</label>
                  <select style={s.input} value={form.classe_id} onChange={e => setForm(p=>({...p,classe_id:e.target.value}))}>
                    <option value="">— None —</option>
                    {classes.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                </div>
              </div>

              <div style={s.modalActions}>
                <button type="button" style={s.cancelBtn} onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" style={{...s.saveBtn,opacity:saving?0.7:1}} disabled={saving}>
                  <span className="material-icons" style={{fontSize:'18px',marginRight:'6px'}}>save</span>
                  {saving?'Saving...':'Save User'}
                </button>
              </div>
            </form>
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
  addBtn:       { display:'flex', alignItems:'center', background:'#C8184A', color:'#fff', border:'none', borderRadius:'8px', padding:'10px 18px', fontSize:'14px', fontWeight:600, cursor:'pointer' },
  tabs:         { display:'flex', gap:'6px', marginBottom:'14px', flexWrap:'wrap' },
  tab:          { padding:'6px 12px', borderRadius:'6px', border:'1.5px solid #e2e8f0', background:'#fff', fontSize:'12px', color:'#64748b', cursor:'pointer', fontWeight:500, display:'flex', alignItems:'center', gap:'4px' },
  tabActive:    {},
  roleCnt:      { background:'rgba(0,0,0,0.12)', borderRadius:'10px', padding:'0 5px', fontSize:'10px', fontWeight:700 },
  searchRow:    { display:'flex', alignItems:'center', background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:'8px', padding:'8px 14px', marginBottom:'16px' },
  searchInput:  { border:'none', outline:'none', fontSize:'14px', color:'#374151', flex:1, background:'transparent' },
  tableCard:    { background:'#fff', borderRadius:'12px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', overflow:'hidden' },
  center:       { padding:'40px', textAlign:'center', color:'#94a3b8' },
  table:        { width:'100%', borderCollapse:'collapse' },
  theadRow:     { background:'#f8fafc' },
  th:           { textAlign:'left', padding:'10px 14px', fontSize:'11px', fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:'1px solid #f1f5f9' },
  tr:           { borderBottom:'1px solid #f8fafc' },
  td:           { padding:'12px 14px', fontSize:'13px', color:'#374151' },
  userCell:     { display:'flex', alignItems:'center', gap:'10px' },
  userAvatar:   { width:'32px', height:'32px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:700, flexShrink:0 },
  roleBadge:    { padding:'3px 8px', borderRadius:'4px', fontSize:'11px', fontWeight:600 },
  statusDot:    { padding:'3px 8px', borderRadius:'20px', fontSize:'11px', fontWeight:600 },
  iconBtn:      { background:'none', border:'none', color:'#94a3b8', cursor:'pointer', padding:'4px', display:'flex', alignItems:'center', borderRadius:'4px' },
  overlay:      { position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  modalBox:     { background:'#fff', borderRadius:'14px', padding:'28px', width:'500px', maxWidth:'90vw', boxShadow:'0 10px 40px rgba(0,0,0,0.18)' },
  modalHeader:  { display:'flex', alignItems:'center', marginBottom:'20px' },
  modalTitle:   { fontSize:'18px', fontWeight:700, color:'#0f172a' },
  errorMsg:     { background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px', color:'#dc2626', fontSize:'13px', marginBottom:'12px' },
  formRow:      { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' },
  field:        { marginBottom:'14px' },
  label:        { display:'block', fontSize:'12px', fontWeight:600, color:'#374151', marginBottom:'5px' },
  input:        { width:'100%', padding:'10px 12px', border:'1.5px solid #e2e8f0', borderRadius:'8px', fontSize:'14px', background:'#f8fafc', outline:'none', boxSizing:'border-box', fontFamily:'inherit' },
  modalActions: { display:'flex', gap:'10px', justifyContent:'flex-end', marginTop:'8px' },
  cancelBtn:    { background:'#f1f5f9', border:'none', borderRadius:'8px', padding:'10px 20px', fontSize:'14px', color:'#374151', cursor:'pointer', fontWeight:500 },
  saveBtn:      { display:'flex', alignItems:'center', background:'#C8184A', color:'#fff', border:'none', borderRadius:'8px', padding:'10px 20px', fontSize:'14px', fontWeight:600, cursor:'pointer' },
}
