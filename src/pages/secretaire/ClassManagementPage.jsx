import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import NotificationBell from '../../components/NotificationBell'

const FILIERE_COLOR = {
  CS: { bg: '#dbeafe', color: '#1d4ed8', label: 'Computer Science' },
  EE: { bg: '#fce7f3', color: '#be185d', label: 'Electrical Eng.'  },
  ME: { bg: '#d1fae5', color: '#065f46', label: 'Mechanical Eng.'  },
}

const NIVEAU_COLOR = {
  L1: { bg: '#f1f5f9', color: '#475569' },
  L2: { bg: '#fef9c3', color: '#854d0e' },
  L3: { bg: '#ede9fe', color: '#5b21b6' },
}

export default function ClassManagementPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [classes, setClasses]         = useState([])
  const [selected, setSelected]       = useState(null)   // selected class id
  const [students, setStudents]       = useState([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [globalSearch, setGlobalSearch] = useState('')
  const [showAddModal, setShowAddModal]     = useState(false)
  const [addForm, setAddForm]               = useState({ nom: '', prenom: '', email: '', password: '' })
  const [addError, setAddError]             = useState('')
  const [addLoading, setAddLoading]         = useState(false)
  const [createdCreds, setCreatedCreds]     = useState(null)  // { student, credentials, className }
  const [removing, setRemoving]             = useState(null)
  const [resettingPwd, setResettingPwd]     = useState(null)  // studentId being reset
  const [resetToast, setResetToast]         = useState('')    // toast message
  const [showChefModal, setShowChefModal]   = useState(false)
  const [chefClassId, setChefClassId]       = useState(null)   // which class we're changing chef for
  const [newChefId, setNewChefId]           = useState('')
  const [changingChef, setChangingChef]     = useState(false)
  const [chefError, setChefError]           = useState('')

  useEffect(() => {
    api.get('/classes')
      .then(res => setClasses(res.data.classes))
      .catch(err => console.error(err.message))
      .finally(() => setLoadingClasses(false))
  }, [])

  const selectClass = async (classId) => {
    if (selected === classId) { setSelected(null); return }
    setSelected(classId)
    setLoadingStudents(true)
    try {
      const res = await api.get(`/classes/${classId}/students`)
      setStudents(res.data.students)
    } catch (err) {
      console.error(err.message)
    } finally {
      setLoadingStudents(false)
    }
  }

  const handleAddStudent = async (e) => {
    e.preventDefault()
    setAddError('')
    setAddLoading(true)
    try {
      const res = await api.post(`/classes/${selected}/students`, {
        nom: addForm.nom,
        prenom: addForm.prenom,
        email: addForm.email,
        password: addForm.password || 'bit2026',
      })
      setStudents(prev => [...prev, res.data.student].sort((a, b) => a.nom.localeCompare(b.nom)))
      setClasses(prev => prev.map(c =>
        c.id === selected ? { ...c, student_count: parseInt(c.student_count) + 1 } : c
      ))
      setAddForm({ nom: '', prenom: '', email: '', password: '' })
      setShowAddModal(false)
      setCreatedCreds({
        student: res.data.student,
        credentials: res.data.credentials,
        className: classes.find(c => c.id === selected)?.nom || '',
      })
    } catch (err) {
      setAddError(err.response?.data?.error || 'Failed to add student.')
    } finally {
      setAddLoading(false)
    }
  }

  const openChefModal = (classId, e) => {
    e.stopPropagation()
    setChefClassId(classId)
    setNewChefId('')
    setChefError('')
    // Load students for that class if not already open
    if (selected !== classId) {
      setSelected(classId)
      setLoadingStudents(true)
      api.get(`/classes/${classId}/students`)
        .then(res => setStudents(res.data.students))
        .catch(err => console.error(err.message))
        .finally(() => setLoadingStudents(false))
    }
    setShowChefModal(true)
  }

  const handleChangeChef = async (e) => {
    e.preventDefault()
    if (!newChefId) { setChefError('Please select a student.'); return }
    const cls       = classes.find(c => c.id === chefClassId)
    const oldChefId = cls?.chef_id || null
    if (parseInt(newChefId) === parseInt(oldChefId)) {
      setChefError('This student is already the chef.')
      return
    }
    if (!confirm(`Make ${students.find(s => s.id === parseInt(newChefId))?.prenom} ${students.find(s => s.id === parseInt(newChefId))?.nom} the new chef de classe?`)) return
    setChangingChef(true)
    setChefError('')
    try {
      const res = await api.put(`/classes/${chefClassId}/chef`, {
        new_chef_id: parseInt(newChefId),
        old_chef_id: oldChefId,
      })
      // Update class list with new chef info
      setClasses(prev => prev.map(c =>
        c.id === chefClassId
          ? { ...c, chef_id: res.data.class.chef_id, chef_nom: res.data.class.chef_nom, chef_prenom: res.data.class.chef_prenom, chef_email: res.data.class.chef_email }
          : c
      ))
      setShowChefModal(false)
    } catch (err) {
      setChefError(err.response?.data?.error || 'Failed to change chef.')
    } finally {
      setChangingChef(false)
    }
  }

  const handleResetPassword = async (studentId) => {
    if (!confirm('Reset this student\'s password to "bit2026"?')) return
    setResettingPwd(studentId)
    try {
      await api.put(`/classes/${selected}/students/${studentId}/reset-password`)
      setResetToast('Password reset to "bit2026"')
      setTimeout(() => setResetToast(''), 3500)
    } catch (err) {
      alert(err.response?.data?.error || 'Reset failed.')
    } finally {
      setResettingPwd(null)
    }
  }

  const handleRemove = async (studentId) => {
    if (!confirm('Remove this student from the class?')) return
    setRemoving(studentId)
    try {
      await api.delete(`/classes/${selected}/students/${studentId}`)
      setStudents(prev => prev.filter(s => s.id !== studentId))
      setClasses(prev => prev.map(c =>
        c.id === selected
          ? { ...c, student_count: Math.max(0, parseInt(c.student_count) - 1) }
          : c
      ))
    } catch (err) {
      alert(err.response?.data?.error || 'Remove failed.')
    } finally {
      setRemoving(null)
    }
  }

  const handleExport = async (classId) => {
    const cls = classes.find(c => c.id === classId)
    try {
      const res = await api.get(`/classes/${classId}/students/export`, { responseType: 'blob' })
      const url  = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      const a    = document.createElement('a')
      a.href     = url
      a.download = `class-${cls?.filiere}-${cls?.niveau}-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
      // Refresh class to show updated list_downloaded_at
      const refresh = await api.get('/classes')
      setClasses(refresh.data.classes)
    } catch (err) {
      alert('Export failed.')
    }
  }

  // Cross-class search
  const searchLower = globalSearch.toLowerCase()
  const searchResults = globalSearch.length > 1
    ? classes.reduce((acc, cls) => {
        // We'd need all students — only show if selected class matches search within selected
        return acc
      }, [])
    : []

  const selectedClass = classes.find(c => c.id === selected)

  return (
    <div style={s.page}>
      {/* Sidebar */}
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <img src="/icons/bit-logo.png" alt="BIT" style={{width:'36px',height:'36px',objectFit:'contain',borderRadius:'6px',background:'#fff',padding:'3px',flexShrink:0}} />
          <span style={s.logoText}>Academic Manager</span>
        </div>
        <nav style={s.nav}>
          <div style={s.navItem} onClick={() => navigate('/secretaire/dashboard')}>
            <span className="material-icons" style={s.navIcon}>dashboard</span>
            Dashboard
          </div>
          <div style={{ ...s.navItem, ...s.navActive }}>
            <span className="material-icons" style={s.navIcon}>school</span>
            Classes
          </div>
          <div style={s.navItem} onClick={() => navigate('/validation')}>
            <span className="material-icons" style={s.navIcon}>task_alt</span>
            Validations
          </div>
        </nav>
        <div style={s.sidebarBottom}>
          <div style={s.userInfo}>
            <div style={s.avatar}>{user?.prenom?.[0]}{user?.nom?.[0]}</div>
            <div>
              <div style={s.userName}>{user?.prenom} {user?.nom}</div>
              <div style={s.userRole}>Secretary Office</div>
            </div>
          </div>
          <button style={s.logoutBtn} onClick={logout}>
            <span className="material-icons" style={{ fontSize: '18px' }}>logout</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={s.main}>
        <header style={s.header}>
          <div>
            <h1 style={s.pageTitle}>Class Management</h1>
            <p style={s.pageSubtitle}>
              {classes.length} classes · {classes.reduce((n, c) => n + parseInt(c.student_count || 0), 0)} students total
            </p>
          </div>
          <NotificationBell />
        </header>

        {/* Search bar */}
        <div style={s.searchWrap}>
          <span className="material-icons" style={s.searchIcon}>search</span>
          <input
            style={s.searchInput}
            placeholder="Search student across all classes..."
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
          />
        </div>

        {/* Reset password toast */}
        {resetToast && (
          <div style={s.toast}>
            <span className="material-icons" style={{fontSize:'18px',marginRight:'8px'}}>lock_reset</span>
            {resetToast}
          </div>
        )}

        {/* Classes grid */}
        {loadingClasses ? (
          <div style={s.loadingWrap}>Loading classes...</div>
        ) : (
          <div style={s.classGrid}>
            {classes.map(cls => {
              const fStyle = FILIERE_COLOR[cls.filiere] || { bg: '#f1f5f9', color: '#475569', label: cls.filiere }
              const nStyle = NIVEAU_COLOR[cls.niveau]   || { bg: '#f1f5f9', color: '#475569' }
              const isOpen = selected === cls.id

              return (
                <div key={cls.id} style={{ ...s.classCard, borderColor: isOpen ? '#C8184A' : 'transparent' }}>
                  {/* Card header */}
                  <div style={s.classCardHeader} onClick={() => selectClass(cls.id)}>
                    <div style={s.classCardTop}>
                      <span style={{ ...s.badge, background: nStyle.bg, color: nStyle.color }}>{cls.niveau}</span>
                      <span style={{ ...s.badge, background: fStyle.bg, color: fStyle.color }}>{fStyle.label}</span>
                    </div>
                    <div style={s.classCardName}>{cls.nom}</div>
                    <div style={s.classCardMeta}>
                      <span style={s.metaItem}>
                        <span className="material-icons" style={s.metaIcon}>people</span>
                        {cls.student_count} students
                      </span>
                      <span style={s.metaItem}>
                        <span className="material-icons" style={s.metaIcon}>person</span>
                        {cls.chef_prenom ? `${cls.chef_prenom} ${cls.chef_nom}` : 'No chef'}
                      </span>
                    </div>
                    <div style={s.classCardActions}>
                      <button
                        style={s.changeChefBtn}
                        onClick={(e) => openChefModal(cls.id, e)}
                        title="Change chef de classe"
                      >
                        <span className="material-icons" style={{ fontSize: '14px', marginRight: '4px' }}>swap_horiz</span>
                        Change Chef
                      </button>
                      <button
                        style={s.exportBtnSmall}
                        onClick={(e) => { e.stopPropagation(); handleExport(cls.id) }}
                        title="Export CSV"
                      >
                        <span className="material-icons" style={{ fontSize: '16px' }}>download</span>
                      </button>
                      <span className="material-icons" style={{ color: '#94a3b8', fontSize: '18px' }}>
                        {isOpen ? 'expand_less' : 'expand_more'}
                      </span>
                    </div>
                  </div>

                  {/* Expanded student list */}
                  {isOpen && (
                    <div style={s.studentSection}>
                      <div style={s.studentSectionHeader}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                          Students in {cls.nom}
                        </span>
                        <button style={s.addBtn} onClick={() => setShowAddModal(true)}>
                          <span className="material-icons" style={{ fontSize: '16px', marginRight: '4px' }}>person_add</span>
                          Add Student
                        </button>
                      </div>

                      {loadingStudents ? (
                        <div style={s.listLoading}>Loading...</div>
                      ) : students.length === 0 ? (
                        <div style={s.emptyList}>No students in this class yet.</div>
                      ) : (
                        <table style={s.table}>
                          <thead>
                            <tr>
                              <th style={s.th}>#</th>
                              <th style={s.th}>Name</th>
                              <th style={s.th}>Email</th>
                              <th style={s.th}>Added</th>
                              <th style={s.th}>Login Info</th>
                              <th style={s.th}></th>
                            </tr>
                          </thead>
                          <tbody>
                            {students
                              .filter(st => globalSearch.length < 2 || `${st.prenom} ${st.nom} ${st.email}`.toLowerCase().includes(searchLower))
                              .map((st, i) => (
                              <tr key={st.id} style={s.tr}>
                                <td style={{ ...s.td, color: '#94a3b8', width: '32px' }}>{i + 1}</td>
                                <td style={s.td}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div style={s.miniAvatar}>
                                      {st.prenom[0]}{st.nom[0]}
                                    </div>
                                    <span style={{ fontWeight: 500 }}>{st.prenom} {st.nom}</span>
                                  </div>
                                </td>
                                <td style={{ ...s.td, color: '#64748b' }}>{st.email}</td>
                                <td style={{ ...s.td, color: '#94a3b8', fontSize: '12px' }}>
                                  {new Date(st.created_at).toLocaleDateString('fr-FR')}
                                </td>
                                <td style={s.td}>
                                  <button
                                    style={s.resetPwdBtn}
                                    onClick={() => handleResetPassword(st.id)}
                                    disabled={resettingPwd === st.id}
                                    title='Reset password to "bit2026"'
                                  >
                                    <span className="material-icons" style={{ fontSize: '14px', marginRight: '4px' }}>lock_reset</span>
                                    {resettingPwd === st.id ? '...' : 'Reset pwd'}
                                  </button>
                                </td>
                                <td style={s.td}>
                                  <button
                                    style={s.removeBtn}
                                    onClick={() => handleRemove(st.id)}
                                    disabled={removing === st.id}
                                    title="Remove from class"
                                  >
                                    {removing === st.id
                                      ? '...'
                                      : <span className="material-icons" style={{ fontSize: '16px' }}>person_remove</span>
                                    }
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}

                      <div style={s.sectionFooter}>
                        <button style={s.exportBtn} onClick={() => handleExport(cls.id)}>
                          <span className="material-icons" style={{ fontSize: '16px', marginRight: '6px' }}>download</span>
                          Export CSV
                        </button>
                        {cls.list_downloaded_at && (
                          <span style={s.downloadInfo}>
                            Last downloaded: {new Date(cls.list_downloaded_at).toLocaleString('fr-FR')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </main>

      {/* Change Chef Modal */}
      {showChefModal && (
        <div style={s.modalBackdrop} onClick={() => setShowChefModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>
                Change Chef — {classes.find(c => c.id === chefClassId)?.nom}
              </h2>
              <button style={s.closeBtn} onClick={() => { setShowChefModal(false); setChefError('') }}>
                <span className="material-icons">close</span>
              </button>
            </div>

            {/* Current chef info */}
            {(() => {
              const cls = classes.find(c => c.id === chefClassId)
              return cls?.chef_prenom ? (
                <div style={s.currentChefBox}>
                  <span className="material-icons" style={{ fontSize: '16px', color: '#6366f1' }}>manage_accounts</span>
                  <span>Current chef: <strong>{cls.chef_prenom} {cls.chef_nom}</strong></span>
                </div>
              ) : (
                <div style={s.currentChefBox}>No chef currently assigned.</div>
              )
            })()}

            <form onSubmit={handleChangeChef}>
              {chefError && <div style={s.errorMsg}>{chefError}</div>}

              <label style={s.label}>Select New Chef (from class students)</label>
              {loadingStudents ? (
                <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px' }}>Loading students...</div>
              ) : students.length === 0 ? (
                <div style={{ color: '#94a3b8', fontSize: '13px', marginBottom: '16px' }}>No students in this class.</div>
              ) : (
                <select
                  style={{ ...s.input, cursor: 'pointer' }}
                  value={newChefId}
                  onChange={e => setNewChefId(e.target.value)}
                  required
                >
                  <option value="">— Select a student —</option>
                  {students.map(st => (
                    <option key={st.id} value={st.id}>
                      {st.prenom} {st.nom} ({st.email})
                    </option>
                  ))}
                </select>
              )}

              <div style={s.passwordNote}>
                <span className="material-icons" style={{ fontSize: '16px', color: '#6366f1' }}>info</span>
                The old chef keeps their account and becomes a student. The new chef logs in with their existing credentials.
              </div>

              <div style={s.modalActions}>
                <button type="button" style={s.cancelBtn} onClick={() => { setShowChefModal(false); setChefError('') }}>
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{ ...s.submitBtn, opacity: changingChef ? 0.7 : 1 }}
                  disabled={changingChef || !newChefId}
                >
                  {changingChef ? 'Changing...' : 'Confirm Change'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Credentials Success Modal */}
      {createdCreds && (
        <div style={s.modalBackdrop} onClick={() => setCreatedCreds(null)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <span className="material-icons" style={{ fontSize: '40px', color: '#10b981' }}>check_circle</span>
              <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '8px 0 4px' }}>
                Account Created Successfully
              </h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
                Share these login credentials with the student
              </p>
            </div>

            <div style={s.credsBox}>
              <div style={s.credsRow}>
                <span style={s.credsLabel}>Student</span>
                <span style={s.credsValue}>{createdCreds.student.prenom} {createdCreds.student.nom}</span>
              </div>
              <div style={s.credsRow}>
                <span style={s.credsLabel}>Class</span>
                <span style={s.credsValue}>{createdCreds.className}</span>
              </div>
              <div style={s.credsDivider} />
              <div style={s.credsRow}>
                <span style={s.credsLabel}>Email</span>
                <span style={{ ...s.credsValue, fontFamily: 'monospace', color: '#1d4ed8' }}>
                  {createdCreds.credentials.email}
                </span>
              </div>
              <div style={s.credsRow}>
                <span style={s.credsLabel}>Password</span>
                <span style={{ ...s.credsValue, fontFamily: 'monospace', color: '#C8184A', fontWeight: 700 }}>
                  {createdCreds.credentials.temporary_password}
                </span>
              </div>
            </div>

            <div style={s.credsWarning}>
              <span className="material-icons" style={{ fontSize: '16px', marginRight: '6px', flexShrink: 0 }}>warning</span>
              Ask the student to change their password on first login.
            </div>

            <div style={s.modalActions}>
              <button style={s.copyBtn} onClick={() => {
                const text = `Email: ${createdCreds.credentials.email}\nPassword: ${createdCreds.credentials.temporary_password}`
                navigator.clipboard.writeText(text).then(() => {
                  alert('Credentials copied to clipboard!')
                })
              }}>
                <span className="material-icons" style={{ fontSize: '16px', marginRight: '6px' }}>content_copy</span>
                Copy Credentials
              </button>
              <button style={s.submitBtn} onClick={() => setCreatedCreds(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Student Modal */}
      {showAddModal && (
        <div style={s.modalBackdrop} onClick={() => setShowAddModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Add Student to {selectedClass?.nom}</h2>
              <button style={s.closeBtn} onClick={() => { setShowAddModal(false); setAddError('') }}>
                <span className="material-icons">close</span>
              </button>
            </div>

            <form onSubmit={handleAddStudent}>
              {addError && <div style={s.errorMsg}>{addError}</div>}

              <label style={s.label}>Last Name</label>
              <input
                style={s.input}
                placeholder="Ouedraogo"
                value={addForm.nom}
                onChange={e => setAddForm(p => ({ ...p, nom: e.target.value }))}
                required
                autoFocus
              />

              <label style={s.label}>First Name</label>
              <input
                style={s.input}
                placeholder="Fatima"
                value={addForm.prenom}
                onChange={e => setAddForm(p => ({ ...p, prenom: e.target.value }))}
                required
              />

              <label style={s.label}>Email</label>
              <input
                style={s.input}
                type="email"
                placeholder="fatima@bit.edu"
                value={addForm.email}
                onChange={e => setAddForm(p => ({ ...p, email: e.target.value }))}
                required
              />

              <label style={s.label}>Password (optional — defaults to "bit2026")</label>
              <input
                style={s.input}
                type="text"
                placeholder="bit2026"
                value={addForm.password}
                onChange={e => setAddForm(p => ({ ...p, password: e.target.value }))}
              />

              <div style={s.passwordNote}>
                <span className="material-icons" style={{ fontSize: '16px', color: '#6366f1' }}>info</span>
                A login account will be created automatically with these credentials.
              </div>

              <div style={s.modalActions}>
                <button type="button" style={s.cancelBtn} onClick={() => { setShowAddModal(false); setAddError('') }}>
                  Cancel
                </button>
                <button type="submit" style={{ ...s.submitBtn, opacity: addLoading ? 0.7 : 1 }} disabled={addLoading}>
                  {addLoading ? 'Adding...' : 'Add Student'}
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
  page:         { display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" },
  sidebar:      { width: '240px', background: '#0F1929', display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0 },
  logo:         { display: 'flex', alignItems: 'center', gap: '10px', padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
  logoIcon:     { background: '#C8184A', color: '#fff', fontWeight: 700, fontSize: '13px', padding: '4px 8px', borderRadius: '6px' },
  logoText:     { color: '#C8184A', fontSize: '15px', fontWeight: 600 },
  nav:          { flex: 1, padding: '16px 12px' },
  navItem:      { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '14px', cursor: 'pointer', marginBottom: '4px' },
  navActive:    { background: 'rgba(200,24,74,0.15)', color: '#fff' },
  navIcon:      { fontSize: '20px' },
  sidebarBottom:{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: '8px' },
  userInfo:     { flex: 1, display: 'flex', alignItems: 'center', gap: '10px' },
  avatar:       { width: '34px', height: '34px', borderRadius: '50%', background: '#C8184A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, flexShrink: 0 },
  userName:     { color: '#fff', fontSize: '13px', fontWeight: 600 },
  userRole:     { color: 'rgba(255,255,255,0.5)', fontSize: '11px' },
  logoutBtn:    { background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: '4px' },
  main:         { flex: 1, padding: '32px', overflow: 'auto' },
  header:       { marginBottom: '20px' },
  pageTitle:    { fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0 },
  pageSubtitle: { fontSize: '14px', color: '#64748b', margin: '4px 0 0' },
  searchWrap:   { position: 'relative', marginBottom: '20px' },
  searchIcon:   { position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '20px' },
  searchInput:  { width: '100%', padding: '10px 12px 10px 40px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', background: '#fff', outline: 'none', boxSizing: 'border-box' },
  loadingWrap:  { textAlign: 'center', color: '#94a3b8', padding: '40px' },
  classGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' },
  classCard:    { background: '#fff', borderRadius: '12px', border: '2px solid transparent', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden', transition: 'border-color 0.15s' },
  classCardHeader: { padding: '16px', cursor: 'pointer' },
  classCardTop: { display: 'flex', gap: '6px', marginBottom: '8px' },
  badge:        { padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 },
  classCardName:{ fontSize: '15px', fontWeight: 700, color: '#0f172a', marginBottom: '8px' },
  classCardMeta:{ display: 'flex', gap: '12px', marginBottom: '8px' },
  metaItem:     { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#64748b' },
  metaIcon:     { fontSize: '14px' },
  classCardActions: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  exportBtnSmall:   { background: '#f1f5f9', border: 'none', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#475569' },
  studentSection:   { borderTop: '1px solid #f1f5f9' },
  studentSectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: '#fafafa' },
  addBtn:       { display: 'flex', alignItems: 'center', background: '#C8184A', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  listLoading:  { padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' },
  emptyList:    { padding: '20px', textAlign: 'center', color: '#94a3b8', fontSize: '14px' },
  table:        { width: '100%', borderCollapse: 'collapse' },
  th:           { textAlign: 'left', padding: '8px 12px', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #f1f5f9' },
  tr:           { borderBottom: '1px solid #f8fafc' },
  td:           { padding: '9px 12px', fontSize: '13px', color: '#374151' },
  miniAvatar:   { width: '26px', height: '26px', borderRadius: '50%', background: '#ede9fe', color: '#5b21b6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, flexShrink: 0 },
  resetPwdBtn:  { display: 'flex', alignItems: 'center', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', padding: '3px 8px', fontSize: '11px', fontWeight: 600, color: '#92400e', cursor: 'pointer' },
  removeBtn:    { background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' },
  toast:        { display: 'flex', alignItems: 'center', background: '#dcfce7', border: '1px solid #86efac', borderRadius: '8px', padding: '10px 16px', color: '#166534', fontSize: '13px', fontWeight: 600, marginBottom: '16px' },
  sectionFooter:{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px', borderTop: '1px solid #f1f5f9' },
  exportBtn:      { display: 'flex', alignItems: 'center', background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', color: '#374151', cursor: 'pointer', fontWeight: 500 },
  downloadInfo:   { fontSize: '11px', color: '#94a3b8' },
  changeChefBtn:  { display: 'flex', alignItems: 'center', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 600, color: '#6366f1', cursor: 'pointer' },
  currentChefBox: { display: 'flex', alignItems: 'center', gap: '8px', background: '#eef2ff', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#4338ca', marginBottom: '16px' },
  modalBackdrop:{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal:        { background: '#fff', borderRadius: '14px', padding: '28px', width: '400px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalHeader:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' },
  modalTitle:   { fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 },
  closeBtn:     { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px', display: 'flex' },
  label:        { display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' },
  input:        { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', background: '#f8fafc', outline: 'none', boxSizing: 'border-box', marginBottom: '14px' },
  passwordNote: { display: 'flex', alignItems: 'center', gap: '6px', background: '#eef2ff', borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: '#4338ca', marginBottom: '20px' },
  errorMsg:     { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', color: '#dc2626', fontSize: '13px', marginBottom: '14px' },
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  cancelBtn:    { background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '14px', color: '#374151', cursor: 'pointer', fontWeight: 500 },
  submitBtn:    { background: '#C8184A', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  credsBox:     { background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '14px' },
  credsRow:     { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' },
  credsLabel:   { fontSize: '12px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' },
  credsValue:   { fontSize: '14px', color: '#0f172a', fontWeight: 500 },
  credsDivider: { borderTop: '1px solid #e2e8f0', margin: '8px 0' },
  credsWarning: { display: 'flex', alignItems: 'center', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#92400e', marginBottom: '16px' },
  copyBtn:      { display: 'flex', alignItems: 'center', background: '#f1f5f9', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', color: '#374151', cursor: 'pointer', fontWeight: 500 },
}
