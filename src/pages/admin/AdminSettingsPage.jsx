import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import NotificationBell from '../../components/NotificationBell'

const STAFF_ROLES = ['SECRETAIRE', 'DIRECTEUR', 'CAISSE', 'IT', 'LABORATOIRE', 'ADMIN']

const ROLE_META = {
  SECRETAIRE:  { color:'#C8184A', bg:'#fff0f3', label:'Secretary'    },
  DIRECTEUR:   { color:'#0ea5e9', bg:'#f0f9ff', label:'Director'     },
  CAISSE:      { color:'#f59e0b', bg:'#fffbeb', label:'Finance'      },
  IT:          { color:'#10b981', bg:'#f0fdf4', label:'IT'           },
  LABORATOIRE: { color:'#06b6d4', bg:'#ecfeff', label:'Laboratory'   },
  ADMIN:       { color:'#ef4444', bg:'#fef2f2', label:'Admin'        },
}

const EMPTY_FORM = { prenom:'', nom:'', email:'', password:'', role:'SECRETAIRE' }

export default function AdminSettingsPage() {
  const { user, logout } = useAuth()

  const [users,         setUsers]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [roleTab,       setRoleTab]       = useState('ALL')
  const [statusTab,     setStatusTab]     = useState('active')
  const [modal,         setModal]         = useState(null)   // null | 'add' | 'edit' | 'reset'
  const [target,        setTarget]        = useState(null)   // user being edited/reset
  const [form,          setForm]          = useState(EMPTY_FORM)
  const [resetPwd,      setResetPwd]      = useState('')
  const [saving,        setSaving]        = useState(false)
  const [error,         setError]         = useState('')
  const [successMsg,    setSuccessMsg]    = useState('')
  const [search,        setSearch]        = useState('')
  const [showPassword,  setShowPassword]  = useState(false)

  const load = () => {
    setLoading(true)
    api.get('/admin/users')
      .then(res => setUsers(res.data.users || []))
      .catch(err => console.error(err.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const flash = (msg) => {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 3500)
  }

  const openAdd = () => {
    setForm(EMPTY_FORM)
    setTarget(null)
    setError('')
    setShowPassword(false)
    setModal('add')
  }

  const openEdit = (u) => {
    setForm({ prenom:u.prenom, nom:u.nom, email:u.email, password:'', role:u.role })
    setTarget(u)
    setError('')
    setShowPassword(false)
    setModal('edit')
  }

  const openReset = (u) => {
    setResetPwd('')
    setTarget(u)
    setError('')
    setShowPassword(false)
    setModal('reset')
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const payload = { ...form }
      if (modal === 'edit' && !payload.password) delete payload.password
      if (modal === 'add') {
        await api.post('/admin/users', payload)
        flash(`${form.prenom} ${form.nom} created successfully.`)
      } else {
        await api.put(`/admin/users/${target.id}`, payload)
        flash(`${form.prenom} ${form.nom} updated successfully.`)
      }
      setModal(null)
      load()
    } catch (err) {
      setError(err.response?.data?.error || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    if (resetPwd.length < 6) { setError('Password must be at least 6 characters.'); return }
    setSaving(true); setError('')
    try {
      await api.put(`/admin/users/${target.id}/reset-password`, { new_password: resetPwd })
      flash(`Password reset for ${target.prenom} ${target.nom}.`)
      setModal(null)
    } catch (err) {
      setError(err.response?.data?.error || 'Reset failed.')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (u) => {
    const action = u.active !== false ? 'deactivate' : 'activate'
    if (!window.confirm(`${action === 'deactivate' ? 'Deactivate' : 'Re-activate'} ${u.prenom} ${u.nom}?`)) return
    try {
      if (action === 'deactivate') {
        await api.delete(`/admin/users/${u.id}`)
        flash(`${u.prenom} ${u.nom} deactivated.`)
      } else {
        await api.put(`/admin/users/${u.id}/activate`)
        flash(`${u.prenom} ${u.nom} re-activated.`)
      }
      load()
    } catch (err) {
      alert(err.response?.data?.error || 'Action failed.')
    }
  }

  // Stats
  const active   = users.filter(u => u.active !== false)
  const inactive = users.filter(u => u.active === false)
  const roleCounts = {}
  users.forEach(u => { roleCounts[u.role] = (roleCounts[u.role] || 0) + 1 })

  // Filter list
  const baseList = statusTab === 'active' ? active : inactive
  const filtered = baseList.filter(u => {
    if (roleTab !== 'ALL' && u.role !== roleTab) return false
    const q = search.toLowerCase()
    return !q || `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(q)
  })

  return (
    <div style={s.page}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <img src="/icons/bit-logo.png" alt="BIT" style={{width:'36px',height:'36px',objectFit:'contain',borderRadius:'6px',background:'#fff',padding:'3px',flexShrink:0}} />
          <span style={s.logoText}>Academic Manager</span>
        </div>
        <nav style={s.nav}>
          <div style={{...s.navItem,...s.navActive}}>
            <span className="material-icons" style={s.navIcon}>manage_accounts</span>
            User Management
          </div>
        </nav>
        <div style={s.sidebarBottom}>
          <div style={{width:'36px',height:'36px',borderRadius:'50%',background:'#C8184A',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:700,flexShrink:0}}>
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{color:'#fff',fontSize:'13px',fontWeight:600,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{user?.prenom} {user?.nom}</div>
            <div style={{color:'rgba(255,255,255,0.5)',fontSize:'11px'}}>Administrator</div>
          </div>
          <button style={s.logoutBtn} onClick={logout} title="Logout">
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
            <h1 style={s.pageTitle}>User Management</h1>
            <p style={s.pageSubtitle}>Manage staff accounts — secretaries, directors, department agents</p>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
            <NotificationBell />
            <button style={s.addBtn} onClick={openAdd}>
              <span className="material-icons" style={{fontSize:'18px',marginRight:'6px'}}>person_add</span>
              Add Staff
            </button>
          </div>
        </header>

        {/* Success toast */}
        {successMsg && (
          <div style={s.toast}>
            <span className="material-icons" style={{fontSize:'18px',marginRight:'8px'}}>check_circle</span>
            {successMsg}
          </div>
        )}

        {/* Stats cards */}
        <div style={s.statsRow}>
          <div style={s.statCard}>
            <div style={s.statNum}>{users.length}</div>
            <div style={s.statLabel}>Total Staff</div>
          </div>
          <div style={{...s.statCard, borderTop:'3px solid #10b981'}}>
            <div style={{...s.statNum, color:'#10b981'}}>{active.length}</div>
            <div style={s.statLabel}>Active</div>
          </div>
          <div style={{...s.statCard, borderTop:'3px solid #ef4444'}}>
            <div style={{...s.statNum, color:'#ef4444'}}>{inactive.length}</div>
            <div style={s.statLabel}>Inactive</div>
          </div>
          {STAFF_ROLES.map(r => {
            const m = ROLE_META[r]
            return (
              <div key={r} style={{...s.statCard, borderTop:`3px solid ${m.color}`}}>
                <div style={{...s.statNum, color:m.color}}>{roleCounts[r]||0}</div>
                <div style={s.statLabel}>{m.label}</div>
              </div>
            )
          })}
        </div>

        {/* Active / Inactive toggle */}
        <div style={s.statusToggle}>
          <button
            style={{...s.toggleBtn, ...(statusTab==='active' ? s.toggleActive : {})}}
            onClick={() => setStatusTab('active')}>
            <span style={{...s.statusDot2, background:'#10b981'}} /> Active ({active.length})
          </button>
          <button
            style={{...s.toggleBtn, ...(statusTab==='inactive' ? {...s.toggleActive, background:'#fef2f2', color:'#ef4444', borderColor:'#fecaca'} : {})}}
            onClick={() => setStatusTab('inactive')}>
            <span style={{...s.statusDot2, background:'#ef4444'}} /> Inactive ({inactive.length})
          </button>
        </div>

        {/* Role filter tabs */}
        <div style={s.tabs}>
          <button
            style={{...s.tab, ...(roleTab==='ALL' ? {background:'#0f172a', color:'#fff', borderColor:'#0f172a'} : {})}}
            onClick={() => setRoleTab('ALL')}>
            All roles
          </button>
          {STAFF_ROLES.map(r => {
            const m = ROLE_META[r]
            return (
              <button key={r}
                style={{...s.tab, ...(roleTab===r ? {background:m.bg, color:m.color, borderColor:m.color} : {})}}
                onClick={() => setRoleTab(r)}>
                {m.label}
                {roleCounts[r] ? <span style={{...s.roleCnt, background:m.color+'22', color:m.color}}>{roleCounts[r]}</span> : null}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div style={s.searchRow}>
          <span className="material-icons" style={{fontSize:'18px',color:'#94a3b8',marginRight:'8px'}}>search</span>
          <input style={s.searchInput} value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..." />
          {search && <button style={s.clearSearch} onClick={() => setSearch('')}>✕</button>}
        </div>

        {/* Table */}
        <div style={s.tableCard}>
          {loading ? (
            <div style={s.center}>Loading...</div>
          ) : filtered.length === 0 ? (
            <div style={s.emptyState}>
              <span className="material-icons" style={{fontSize:'40px',color:'#cbd5e1',marginBottom:'8px'}}>manage_accounts</span>
              <div style={{color:'#64748b',fontSize:'14px'}}>
                {statusTab === 'inactive' ? 'No inactive accounts.' : 'No staff accounts found.'}
              </div>
            </div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr style={s.theadRow}>
                  <th style={s.th}>Staff Member</th>
                  <th style={s.th}>Email</th>
                  <th style={s.th}>Role</th>
                  <th style={s.th}>Since</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => {
                  const m = ROLE_META[u.role] || { color:'#94a3b8', bg:'#f8fafc', label:u.role }
                  const isMe = u.id === user?.id
                  return (
                    <tr key={u.id} style={s.tr}>
                      <td style={s.td}>
                        <div style={s.userCell}>
                          <div style={{...s.userAvatar, background:m.bg, color:m.color}}>
                            {u.prenom?.[0]}{u.nom?.[0]}
                          </div>
                          <div>
                            <div style={{fontWeight:600,color:'#0f172a',fontSize:'14px'}}>
                              {u.prenom} {u.nom}
                              {isMe && <span style={s.meBadge}>You</span>}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{...s.td,color:'#64748b',fontSize:'12px'}}>{u.email}</td>
                      <td style={s.td}>
                        <span style={{...s.roleBadge, background:m.bg, color:m.color, borderColor:m.color+'44'}}>
                          {m.label}
                        </span>
                      </td>
                      <td style={{...s.td,color:'#94a3b8',fontSize:'12px'}}>
                        {new Date(u.created_at).toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})}
                      </td>
                      <td style={s.td}>
                        <span style={{...s.statusPill, ...(u.active!==false ? s.pillActive : s.pillInactive)}}>
                          {u.active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td style={s.td}>
                        <div style={{display:'flex',gap:'4px',justifyContent:'flex-end'}}>
                          <button style={s.iconBtn} title="Edit" onClick={() => openEdit(u)}>
                            <span className="material-icons" style={{fontSize:'17px'}}>edit</span>
                          </button>
                          <button style={s.iconBtn} title="Reset password" onClick={() => openReset(u)}>
                            <span className="material-icons" style={{fontSize:'17px'}}>lock_reset</span>
                          </button>
                          {!isMe && (
                            <button
                              style={{...s.iconBtn, color: u.active!==false ? '#ef4444' : '#10b981'}}
                              title={u.active!==false ? 'Deactivate' : 'Re-activate'}
                              onClick={() => handleToggleActive(u)}>
                              <span className="material-icons" style={{fontSize:'17px'}}>
                                {u.active!==false ? 'person_off' : 'how_to_reg'}
                              </span>
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

      {/* ── Add / Edit Modal ── */}
      {(modal === 'add' || modal === 'edit') && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={s.modalBox} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={{...s.modalIcon, background: modal==='add' ? '#fff0f3' : '#f0f9ff'}}>
                <span className="material-icons" style={{color: modal==='add' ? '#C8184A' : '#0ea5e9', fontSize:'20px'}}>
                  {modal==='add' ? 'person_add' : 'edit'}
                </span>
              </div>
              <div>
                <div style={s.modalTitle}>{modal==='add' ? 'Add New Staff' : 'Edit Staff Account'}</div>
                <div style={s.modalSub}>
                  {modal==='add' ? 'Create a new staff account' : `Editing ${target?.prenom} ${target?.nom}`}
                </div>
              </div>
            </div>

            {error && <div style={s.errorMsg}>{error}</div>}

            <form onSubmit={handleSave}>
              <div style={s.formRow}>
                <div style={s.field}>
                  <label style={s.label}>First Name</label>
                  <input style={s.input} value={form.prenom}
                    onChange={e => setForm(p=>({...p,prenom:e.target.value}))} required />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Last Name</label>
                  <input style={s.input} value={form.nom}
                    onChange={e => setForm(p=>({...p,nom:e.target.value}))} required />
                </div>
              </div>

              <div style={s.field}>
                <label style={s.label}>Email</label>
                <input style={s.input} type="email" value={form.email}
                  onChange={e => setForm(p=>({...p,email:e.target.value}))} required />
              </div>

              <div style={s.field}>
                <label style={s.label}>
                  {modal==='edit' ? 'New Password (leave blank to keep)' : 'Password'}
                </label>
                <div style={{position:'relative'}}>
                  <input style={{...s.input,paddingRight:'40px'}}
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={e => setForm(p=>({...p,password:e.target.value}))}
                    required={modal==='add'}
                    placeholder={modal==='edit' ? 'Leave blank to keep current' : ''} />
                  <button type="button" onClick={() => setShowPassword(v=>!v)} style={s.eyeBtn}>
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div style={s.field}>
                <label style={s.label}>Role</label>
                <select style={s.input} value={form.role}
                  onChange={e => setForm(p=>({...p,role:e.target.value}))}>
                  {STAFF_ROLES.map(r => (
                    <option key={r} value={r}>{ROLE_META[r]?.label || r}</option>
                  ))}
                </select>
              </div>

              <div style={s.modalActions}>
                <button type="button" style={s.cancelBtn} onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" style={{...s.saveBtn,opacity:saving?0.7:1}} disabled={saving}>
                  <span className="material-icons" style={{fontSize:'17px',marginRight:'6px'}}>save</span>
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ── */}
      {modal === 'reset' && (
        <div style={s.overlay} onClick={() => setModal(null)}>
          <div style={{...s.modalBox, maxWidth:'400px'}} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <div style={{...s.modalIcon, background:'#fff7ed'}}>
                <span className="material-icons" style={{color:'#f59e0b',fontSize:'20px'}}>lock_reset</span>
              </div>
              <div>
                <div style={s.modalTitle}>Reset Password</div>
                <div style={s.modalSub}>{target?.prenom} {target?.nom}</div>
              </div>
            </div>

            {error && <div style={s.errorMsg}>{error}</div>}

            <form onSubmit={handleReset}>
              <div style={s.field}>
                <label style={s.label}>New Password</label>
                <div style={{position:'relative'}}>
                  <input style={{...s.input,paddingRight:'40px'}}
                    type={showPassword ? 'text' : 'password'}
                    value={resetPwd}
                    onChange={e => setResetPwd(e.target.value)}
                    placeholder="Min. 6 characters"
                    required />
                  <button type="button" onClick={() => setShowPassword(v=>!v)} style={s.eyeBtn}>
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div style={s.modalActions}>
                <button type="button" style={s.cancelBtn} onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" style={{...s.saveBtn,background:'#f59e0b',opacity:saving?0.7:1}} disabled={saving}>
                  <span className="material-icons" style={{fontSize:'17px',marginRight:'6px'}}>lock_reset</span>
                  {saving ? 'Resetting...' : 'Reset Password'}
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
  logoText:     { color:'#C8184A', fontSize:'15px', fontWeight:600 },
  nav:          { flex:1, padding:'16px 12px' },
  navItem:      { display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', borderRadius:'8px', color:'rgba(255,255,255,0.6)', fontSize:'14px', cursor:'pointer', marginBottom:'4px' },
  navActive:    { background:'rgba(200,24,74,0.15)', color:'#fff' },
  navIcon:      { fontSize:'20px' },
  sidebarBottom:{ padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.08)', display:'flex', alignItems:'center', gap:'10px' },
  logoutBtn:    { background:'none', border:'none', color:'rgba(255,255,255,0.4)', cursor:'pointer', padding:'4px', display:'flex', alignItems:'center', flexShrink:0 },
  main:         { flex:1, padding:'32px', overflow:'auto' },
  header:       { display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:'24px', flexWrap:'wrap', gap:'12px' },
  pageTitle:    { fontSize:'24px', fontWeight:700, color:'#0f172a', margin:'0 0 4px' },
  pageSubtitle: { fontSize:'13px', color:'#64748b', margin:0 },
  addBtn:       { display:'flex', alignItems:'center', background:'#C8184A', color:'#fff', border:'none', borderRadius:'8px', padding:'10px 18px', fontSize:'14px', fontWeight:600, cursor:'pointer' },
  toast:        { display:'flex', alignItems:'center', background:'#f0fdf4', border:'1px solid #bbf7d0', borderRadius:'8px', padding:'12px 16px', color:'#166534', fontSize:'13px', marginBottom:'20px' },
  statsRow:     { display:'flex', gap:'12px', marginBottom:'24px', flexWrap:'wrap' },
  statCard:     { background:'#fff', borderRadius:'10px', padding:'16px 20px', minWidth:'90px', borderTop:'3px solid #C8184A', boxShadow:'0 1px 3px rgba(0,0,0,0.05)', flex:'1 1 80px' },
  statNum:      { fontSize:'24px', fontWeight:700, color:'#0f172a', lineHeight:1 },
  statLabel:    { fontSize:'11px', color:'#94a3b8', marginTop:'4px', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.03em' },
  statusToggle: { display:'flex', gap:'8px', marginBottom:'14px' },
  toggleBtn:    { display:'flex', alignItems:'center', gap:'6px', padding:'7px 16px', borderRadius:'8px', border:'1.5px solid #e2e8f0', background:'#fff', fontSize:'13px', color:'#64748b', cursor:'pointer', fontWeight:500 },
  toggleActive: { background:'#f0fdf4', color:'#166534', borderColor:'#86efac' },
  statusDot2:   { width:'8px', height:'8px', borderRadius:'50%', flexShrink:0 },
  tabs:         { display:'flex', gap:'6px', marginBottom:'14px', flexWrap:'wrap' },
  tab:          { padding:'6px 12px', borderRadius:'6px', border:'1.5px solid #e2e8f0', background:'#fff', fontSize:'12px', color:'#64748b', cursor:'pointer', fontWeight:500, display:'flex', alignItems:'center', gap:'4px' },
  roleCnt:      { borderRadius:'10px', padding:'1px 6px', fontSize:'10px', fontWeight:700 },
  searchRow:    { display:'flex', alignItems:'center', background:'#fff', border:'1.5px solid #e2e8f0', borderRadius:'8px', padding:'8px 14px', marginBottom:'16px' },
  searchInput:  { border:'none', outline:'none', fontSize:'14px', color:'#374151', flex:1, background:'transparent' },
  clearSearch:  { background:'none', border:'none', color:'#94a3b8', cursor:'pointer', fontSize:'14px', padding:'2px 6px' },
  tableCard:    { background:'#fff', borderRadius:'12px', boxShadow:'0 1px 3px rgba(0,0,0,0.06)', overflow:'hidden' },
  center:       { padding:'40px', textAlign:'center', color:'#94a3b8' },
  emptyState:   { padding:'60px 20px', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center' },
  table:        { width:'100%', borderCollapse:'collapse' },
  theadRow:     { background:'#f8fafc' },
  th:           { textAlign:'left', padding:'10px 16px', fontSize:'11px', fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:'1px solid #f1f5f9' },
  tr:           { borderBottom:'1px solid #f8fafc', transition:'background 0.1s' },
  td:           { padding:'13px 16px', fontSize:'13px', color:'#374151' },
  userCell:     { display:'flex', alignItems:'center', gap:'10px' },
  userAvatar:   { width:'34px', height:'34px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:700, flexShrink:0 },
  meBadge:      { marginLeft:'6px', fontSize:'10px', background:'#eff6ff', color:'#3b82f6', borderRadius:'10px', padding:'1px 6px', fontWeight:600, verticalAlign:'middle' },
  roleBadge:    { padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:600, border:'1px solid' },
  statusPill:   { padding:'3px 10px', borderRadius:'20px', fontSize:'11px', fontWeight:600 },
  pillActive:   { background:'#dcfce7', color:'#166534' },
  pillInactive: { background:'#fee2e2', color:'#991b1b' },
  iconBtn:      { background:'none', border:'none', color:'#94a3b8', cursor:'pointer', padding:'5px', display:'flex', alignItems:'center', borderRadius:'6px' },
  overlay:      { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 },
  modalBox:     { background:'#fff', borderRadius:'16px', padding:'28px', width:'500px', maxWidth:'92vw', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' },
  modalHeader:  { display:'flex', alignItems:'center', gap:'14px', marginBottom:'22px' },
  modalIcon:    { width:'44px', height:'44px', borderRadius:'10px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 },
  modalTitle:   { fontSize:'17px', fontWeight:700, color:'#0f172a' },
  modalSub:     { fontSize:'12px', color:'#94a3b8', marginTop:'2px' },
  errorMsg:     { background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'8px', padding:'10px 14px', color:'#dc2626', fontSize:'13px', marginBottom:'14px' },
  formRow:      { display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' },
  field:        { marginBottom:'14px' },
  label:        { display:'block', fontSize:'12px', fontWeight:600, color:'#374151', marginBottom:'5px' },
  input:        { width:'100%', padding:'10px 12px', border:'1.5px solid #e2e8f0', borderRadius:'8px', fontSize:'14px', background:'#f8fafc', outline:'none', boxSizing:'border-box', fontFamily:'inherit' },
  eyeBtn:       { position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#94a3b8', display:'flex', alignItems:'center', padding:'4px' },
  modalActions: { display:'flex', gap:'10px', justifyContent:'flex-end', marginTop:'8px', paddingTop:'16px', borderTop:'1px solid #f1f5f9' },
  cancelBtn:    { background:'#f1f5f9', border:'none', borderRadius:'8px', padding:'10px 20px', fontSize:'14px', color:'#374151', cursor:'pointer', fontWeight:500 },
  saveBtn:      { display:'flex', alignItems:'center', background:'#C8184A', color:'#fff', border:'none', borderRadius:'8px', padding:'10px 20px', fontSize:'14px', fontWeight:600, cursor:'pointer' },
}
