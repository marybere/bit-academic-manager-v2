import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import NotificationBell from '../../components/NotificationBell'

const TYPES   = ['RELEVE_NOTES', 'ATTESTATION_INSCRIPTION', 'DIPLOME', 'AUTRE']
const FORMATS = ['PDF', 'PAPIER']

const STATUT_STYLE = {
  EN_ATTENTE:    { bg: '#fef9c3', color: '#854d0e', label: 'Pending'     },
  EN_TRAITEMENT: { bg: '#dbeafe', color: '#1d4ed8', label: 'Processing'  },
  APPROUVE:      { bg: '#ede9fe', color: '#5b21b6', label: 'Approved'    },
  PRET:          { bg: '#dcfce7', color: '#166534', label: 'Ready'       },
  RETIRE:        { bg: '#f1f5f9', color: '#475569', label: 'Collected'   },
  REJETE:        { bg: '#fee2e2', color: '#991b1b', label: 'Rejected'    },
}

const TYPE_LABEL = {
  RELEVE_NOTES:            'Transcript',
  ATTESTATION_INSCRIPTION: 'Enrollment Cert.',
  DIPLOME:                 'Diploma',
  AUTRE:                   'Other',
}

export default function SecretaireDashboardPage() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab]                       = useState('all')  // 'all' | 'new' | 'approved' | 'archives'
  const [requests, setRequests]             = useState([])
  const [newRequests, setNewRequests]       = useState([])
  const [approvedRequests, setApprovedRequests] = useState([])
  const [archivedRequests, setArchivedRequests] = useState([])
  const [pendingJustification, setPendingJustification] = useState([])
  const [loading, setLoading]               = useState(true)
  const [filterStatut, setFilterStatut]     = useState('')
  const [filterType, setFilterType]         = useState('')

  // Schedule pickup modal
  const [schedModal, setSchedModal]         = useState(null)  // request object
  const [schedDate, setSchedDate]           = useState('')
  const [schedLoading, setSchedLoading]     = useState(false)

  // Process transcript modal
  const [processModal, setProcessModal]     = useState(null)  // request object
  const [processForm, setProcessForm]       = useState({ statut: 'EN_TRAITEMENT', rendez_vous: '', notes: '' })
  const [processLoading, setProcessLoading] = useState(false)
  const [processError, setProcessError]     = useState('')

  // Forwarding / sending PDF state
  const [actionLoading, setActionLoading]   = useState({})

  const loadAll = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatut) params.set('statut', filterStatut)
      if (filterType)   params.set('type',   filterType)
      const res = await api.get(`/requests?${params}`)
      const all = res.data.requests
      setArchivedRequests(all.filter(r => r.statut === 'RETIRE'))
      setPendingJustification(all.filter(r => r.statut === 'EN_ATTENTE_JUSTIFICATION'))
      setRequests(all.filter(r => r.statut !== 'RETIRE' && r.statut !== 'EN_ATTENTE_JUSTIFICATION'))
      setNewRequests(all.filter(r => r.statut === 'EN_ATTENTE'))
      // Only ATTESTATION/DIPLOME go through departments → show in Approved tab
      setApprovedRequests(all.filter(r => r.statut === 'APPROUVE' && r.type !== 'RELEVE_NOTES'))
    } catch (err) {
      console.error('Load requests error:', err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [filterStatut, filterType])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const timer = setInterval(loadAll, 30000)
    return () => clearInterval(timer)
  }, [filterStatut, filterType])

  const handleForward = async (id) => {
    setActionLoading(prev => ({ ...prev, [id]: 'forward' }))
    try {
      await api.post(`/requests/${id}/forward`)
      loadAll()
    } catch (err) {
      alert(err.response?.data?.error || 'Forward failed.')
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }))
    }
  }

  const handleSendPdf = async (id) => {
    setActionLoading(prev => ({ ...prev, [id]: 'pdf' }))
    try {
      await api.put(`/requests/${id}/send-pdf`)
      loadAll()
    } catch (err) {
      alert(err.response?.data?.error || 'Action failed.')
    } finally {
      setActionLoading(prev => ({ ...prev, [id]: null }))
    }
  }

  const handleSchedule = async () => {
    if (!schedDate) return
    setSchedLoading(true)
    try {
      await api.put(`/requests/${schedModal.id}/schedule`, { rendez_vous: schedDate })
      setSchedModal(null)
      loadAll()
    } catch (err) {
      alert(err.response?.data?.error || 'Schedule failed.')
    } finally {
      setSchedLoading(false)
    }
  }

  const openProcessModal = (r) => {
    setProcessModal(r)
    setProcessForm({ statut: 'EN_TRAITEMENT', rendez_vous: '', notes: r.notes || '' })
    setProcessError('')
  }

  const handleProcessTranscript = async () => {
    setProcessLoading(true)
    setProcessError('')
    try {
      const body = { statut: processForm.statut, notes: processForm.notes || undefined }
      if (processForm.statut === 'PRET' && processModal.format === 'PAPIER' && processForm.rendez_vous) {
        body.rendez_vous = processForm.rendez_vous
      }
      await api.put(`/requests/${processModal.id}/statut`, body)
      setProcessModal(null)
      loadAll()
    } catch (err) {
      setProcessError(err.response?.data?.error || 'Failed to update request.')
    } finally {
      setProcessLoading(false)
    }
  }

  const handleExport = () => {
    const header = 'ID,Student,Class,Type,Format,Status,Date\n'
    const rows = requests.map(r =>
      `${r.id},"${r.prenom} ${r.nom}","${r.classe_nom || ''}","${TYPE_LABEL[r.type] || r.type}","${r.format}","${STATUT_STYLE[r.statut]?.label || r.statut}","${new Date(r.date_demande).toLocaleDateString('fr-FR')}"`
    )
    const csv = header + rows.join('\n')
    const url  = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv' }))
    const a    = document.createElement('a'); a.href = url
    a.download = `requests-${new Date().toISOString().split('T')[0]}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  const stats = {
    total:    requests.length,
    pending:  newRequests.length,
    approved: approvedRequests.length,
    pret:     requests.filter(r => r.statut === 'PRET').length,
  }

  return (
    <div style={s.page}>
      {/* ── Sidebar ── */}
      <aside style={s.sidebar}>
        <div style={s.logo}>
          <img src="/icons/bit-logo.png" alt="BIT" style={{width:'36px',height:'36px',objectFit:'contain',borderRadius:'6px',background:'#fff',padding:'3px',flexShrink:0}} />
          <span style={s.logoText}>Academic Manager</span>
        </div>
        <nav style={s.nav}>
          <div style={{ ...s.navItem, ...s.navActive }}>
            <span className="material-icons" style={s.navIcon}>dashboard</span>Dashboard
          </div>
          <div style={s.navItem} onClick={() => navigate('/secretaire/classes')}>
            <span className="material-icons" style={s.navIcon}>school</span>Classes
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

      {/* ── Main ── */}
      <main style={s.main}>
        {/* Header */}
        <header style={s.header}>
          <div>
            <h1 style={s.pageTitle}>Requests Dashboard</h1>
            <p style={s.pageSubtitle}>
              {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <NotificationBell />
        </header>

        {/* Stats */}
        <div style={s.statsGrid}>
          <StatCard icon="inbox"           label="Total"      value={stats.total}    color="#6366f1" />
          <StatCard icon="hourglass_empty" label="New"        value={stats.pending}  color="#f59e0b" />
          <StatCard icon="verified"        label="Approved"   value={stats.approved} color="#8b5cf6" />
          <StatCard icon="check_circle"    label="Ready"      value={stats.pret}     color="#10b981" />
        </div>

        {/* Tabs */}
        <div style={s.tabs}>
          <button style={{ ...s.tab, ...(tab === 'all'      ? s.tabActive : {}) }} onClick={() => setTab('all')}>
            All Requests
          </button>
          <button style={{ ...s.tab, ...(tab === 'new'      ? s.tabActive : {}) }} onClick={() => setTab('new')}>
            New Requests
            {stats.pending > 0 && <span style={s.tabBadge}>{stats.pending}</span>}
          </button>
          <button style={{ ...s.tab, ...(tab === 'approved' ? s.tabActive : {}) }} onClick={() => setTab('approved')}>
            Approved
            {stats.approved > 0 && <span style={{ ...s.tabBadge, background: '#8b5cf6' }}>{stats.approved}</span>}
          </button>
          <button style={{ ...s.tab, ...(tab === 'pending_just' ? s.tabActive : {}) }} onClick={() => setTab('pending_just')}>
            Pending Justification
            {pendingJustification.length > 0 && <span style={{ ...s.tabBadge, background: '#f59e0b' }}>{pendingJustification.length}</span>}
          </button>
          <button style={{ ...s.tab, ...(tab === 'archives' ? s.tabActive : {}) }} onClick={() => setTab('archives')}>
            Archives
            {archivedRequests.length > 0 && <span style={{ ...s.tabBadge, background: '#64748b' }}>{archivedRequests.length}</span>}
          </button>
        </div>

        {loading ? (
          <div style={s.center}>Loading...</div>
        ) : tab === 'all' ? (
          <>
            {/* Toolbar */}
            <div style={s.toolbar}>
              <div style={s.filterGroup}>
                <div style={s.selectWrap}>
                  <span className="material-icons" style={s.selectIcon}>filter_list</span>
                  <select style={s.select} value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
                    <option value="">All statuses</option>
                    {Object.entries(STATUT_STYLE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div style={s.selectWrap}>
                  <span className="material-icons" style={s.selectIcon}>description</span>
                  <select style={s.select} value={filterType} onChange={e => setFilterType(e.target.value)}>
                    <option value="">All types</option>
                    {TYPES.map(t => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                  </select>
                </div>
                {(filterStatut || filterType) && (
                  <button style={s.clearBtn} onClick={() => { setFilterStatut(''); setFilterType('') }}>
                    <span className="material-icons" style={{ fontSize: '16px', marginRight: '4px' }}>close</span>Clear
                  </button>
                )}
              </div>
              <button style={s.exportBtn} onClick={handleExport}>
                <span className="material-icons" style={{ fontSize: '16px', marginRight: '6px' }}>download</span>Export CSV
              </button>
            </div>
            <AllRequestsTable requests={requests} navigate={navigate} />
          </>
        ) : tab === 'new' ? (
          <NewRequestsTab
            requests={newRequests}
            actionLoading={actionLoading}
            onForward={handleForward}
            onProcess={openProcessModal}
            navigate={navigate}
          />
        ) : tab === 'approved' ? (
          <ApprovedTab
            requests={approvedRequests}
            actionLoading={actionLoading}
            onSchedule={(r) => { setSchedModal(r); setSchedDate('') }}
            onSendPdf={handleSendPdf}
            navigate={navigate}
          />
        ) : tab === 'pending_just' ? (
          <PendingJustificationTab requests={pendingJustification} navigate={navigate} />
        ) : (
          <ArchivesTab requests={archivedRequests} navigate={navigate} />
        )}
      </main>

      {/* ── Process Transcript Modal ── */}
      {processModal && (
        <div style={s.backdrop} onClick={() => setProcessModal(null)}>
          <div style={{ ...s.modal, maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Process Transcript</h2>
              <button style={s.closeBtn} onClick={() => setProcessModal(null)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
              <div style={s.studentAvatar}>{processModal.prenom?.[0]}{processModal.nom?.[0]}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px', color: '#0f172a' }}>{processModal.prenom} {processModal.nom}</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>{processModal.email}</div>
              </div>
              <span style={{ ...s.typeBadge, marginLeft: 'auto', background: '#dbeafe', color: '#1d4ed8' }}>TRANSCRIPT</span>
            </div>
            {processError && <div style={s.errorMsg}>{processError}</div>}
            <label style={s.label}>Status</label>
            <select style={s.input} value={processForm.statut}
              onChange={e => setProcessForm(p => ({ ...p, statut: e.target.value }))}>
              <option value="EN_TRAITEMENT">Processing</option>
              <option value="PRET">Ready</option>
              <option value="RETIRE">Collected</option>
            </select>
            {processForm.statut === 'PRET' && processModal.format === 'PAPIER' && (
              <>
                <label style={s.label}>Pickup Date & Time</label>
                <input type="datetime-local" style={s.input}
                  value={processForm.rendez_vous}
                  onChange={e => setProcessForm(p => ({ ...p, rendez_vous: e.target.value }))} />
              </>
            )}
            {processForm.statut === 'PRET' && processModal.format === 'PDF' && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', fontSize: '13px', color: '#166534' }}>
                <span className="material-icons" style={{ fontSize: '16px', verticalAlign: 'middle', marginRight: '6px' }}>mark_email_read</span>
                Student will be notified to check their email for the PDF.
              </div>
            )}
            <label style={s.label}>Notes (optional)</label>
            <textarea style={{ ...s.input, height: '72px', resize: 'vertical' }}
              value={processForm.notes}
              onChange={e => setProcessForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Any remarks..." />
            <div style={s.modalActions}>
              <button style={s.cancelBtn} onClick={() => setProcessModal(null)}>Cancel</button>
              <button
                style={{ ...s.submitBtn, opacity: processLoading ? 0.7 : 1 }}
                onClick={handleProcessTranscript}
                disabled={processLoading}>
                {processLoading ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Schedule Pickup Modal ── */}
      {schedModal && (
        <div style={s.backdrop} onClick={() => setSchedModal(null)}>
          <div style={{ ...s.modal, maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <h2 style={s.modalTitle}>Schedule Pickup</h2>
              <button style={s.closeBtn} onClick={() => setSchedModal(null)}>
                <span className="material-icons">close</span>
              </button>
            </div>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
              {schedModal.prenom} {schedModal.nom} — {TYPE_LABEL[schedModal.type] || schedModal.type}
            </p>
            <label style={s.label}>Pickup Date & Time</label>
            <input type="datetime-local" style={{ ...s.input, marginBottom: '20px' }}
              value={schedDate} onChange={e => setSchedDate(e.target.value)} required />
            <div style={s.modalActions}>
              <button style={s.cancelBtn} onClick={() => setSchedModal(null)}>Cancel</button>
              <button style={{ ...s.submitBtn, opacity: schedLoading || !schedDate ? 0.7 : 1 }}
                onClick={handleSchedule} disabled={schedLoading || !schedDate}>
                {schedLoading ? 'Scheduling...' : 'Confirm Pickup'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PendingJustificationTab({ requests, navigate }) {
  if (requests.length === 0) return (
    <div style={s.emptyState}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p style={{ color: '#64748b', margin: '8px 0 0' }}>No requests pending justification.</p>
    </div>
  )
  return (
    <div style={s.cardGrid}>
      {requests.map(r => (
        <div key={r.id} style={{ ...s.reqCard, borderLeft: '3px solid #f59e0b' }}>
          <div style={{ display:'flex', alignItems:'center', background:'#fef9c3', color:'#854d0e', borderRadius:'6px', padding:'8px 10px', fontSize:'12px', fontWeight:600, marginBottom:'14px', gap:'6px' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Pending Justification — {r.rejection_service || 'Department'}
          </div>
          <div style={s.studentRow}>
            <div style={s.studentAvatar}>{r.prenom?.[0]}{r.nom?.[0]}</div>
            <div>
              <div style={s.studentName}>{r.prenom} {r.nom}</div>
              <div style={s.studentEmail}>{r.email}</div>
              {r.classe_nom && <div style={s.studentClass}>{r.classe_nom}</div>}
            </div>
          </div>
          {r.rejection_reason && (
            <div style={{ background:'#fef2f2', borderRadius:'6px', padding:'8px 10px', marginBottom:'10px' }}>
              <div style={{ fontSize:'11px', fontWeight:600, color:'#991b1b', marginBottom:'2px' }}>Rejection reason:</div>
              <div style={{ fontSize:'12px', color:'#7f1d1d' }}>{r.rejection_reason}</div>
            </div>
          )}
          <div style={s.reqMeta}>
            <div style={s.metaItem}>
              <span className="material-icons" style={{ fontSize:'14px', color:'#94a3b8' }}>description</span>
              {TYPE_LABEL[r.type] || r.type}
            </div>
            <div style={s.metaItem}>
              <span className="material-icons" style={{ fontSize:'14px', color:'#94a3b8' }}>calendar_today</span>
              {new Date(r.date_demande).toLocaleDateString('fr-FR')}
            </div>
          </div>
          <div style={s.cardActions}>
            <button style={s.manageBtn} onClick={() => navigate(`/secretaire/request/${r.id}`)}>
              <span className="material-icons" style={{ fontSize:'15px', marginRight:'4px' }}>open_in_new</span>View Details
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function ArchivesTab({ requests, navigate }) {
  const [search, setSearch] = useState('')
  const [filterClass, setFilterClass] = useState('')

  const classes = [...new Set(requests.map(r => r.classe_nom).filter(Boolean))]

  const filtered = requests.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !q ||
      r.nom?.toLowerCase().includes(q) ||
      r.prenom?.toLowerCase().includes(q) ||
      r.email?.toLowerCase().includes(q) ||
      String(r.id).includes(q)
    const matchClass = !filterClass || r.classe_nom === filterClass
    return matchSearch && matchClass
  })

  if (requests.length === 0) return (
    <div style={s.emptyState}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5">
        <path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/>
      </svg>
      <p style={{ color: '#64748b', margin: '8px 0 0' }}>No archived requests yet.</p>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input type="text" placeholder="Search by name, email or ID..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '100%', padding: '9px 12px 9px 34px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', background: '#fff' }} />
        </div>
        <select value={filterClass} onChange={e => setFilterClass(e.target.value)}
          style={{ padding: '9px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '13px', background: '#fff', outline: 'none', minWidth: '160px' }}>
          <option value="">All classes</option>
          {classes.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <span style={{ fontSize: '13px', color: '#64748b', whiteSpace: 'nowrap' }}>
          {filtered.length} record{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      <div style={s.tableCard}>
        <table style={s.table}>
          <thead>
            <tr style={s.theadRow}>
              <th style={s.th}>#</th>
              <th style={s.th}>Student</th>
              <th style={s.th}>Class</th>
              <th style={s.th}>Type</th>
              <th style={s.th}>Format</th>
              <th style={s.th}>Submitted</th>
              <th style={s.th}>Collected</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: '#94a3b8', fontSize: '14px' }}>
                No results for "{search}"
              </td></tr>
            ) : filtered.map(r => (
              <tr key={r.id} style={s.tr}>
                <td style={{ ...s.td, color: '#94a3b8', fontSize: '12px' }}>#{r.id}</td>
                <td style={s.td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ ...s.miniAvatar, background: '#f1f5f9', color: '#475569' }}>{r.prenom?.[0]}{r.nom?.[0]}</div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '13px' }}>{r.prenom} {r.nom}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{r.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ ...s.td, fontSize: '12px', color: '#64748b' }}>{r.classe_nom || '—'}</td>
                <td style={s.td}><span style={s.typeBadge}>{TYPE_LABEL[r.type] || r.type}</span></td>
                <td style={{ ...s.td, fontSize: '12px', color: '#64748b' }}>{r.format}</td>
                <td style={{ ...s.td, fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                  {new Date(r.date_demande).toLocaleDateString('fr-FR')}
                </td>
                <td style={{ ...s.td, fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                  {r.updated_at ? new Date(r.updated_at).toLocaleDateString('fr-FR') : '—'}
                </td>
                <td style={s.td}>
                  <button style={s.manageBtn} onClick={() => navigate(`/secretaire/request/${r.id}`)}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AllRequestsTable({ requests, navigate }) {
  if (requests.length === 0) return (
    <div style={s.emptyState}>
      <span className="material-icons" style={{ fontSize: '48px', color: '#cbd5e1' }}>inbox</span>
      <p style={{ color: '#64748b', margin: '8px 0 0' }}>No requests found.</p>
    </div>
  )
  return (
    <div style={s.tableCard}>
      <table style={s.table}>
        <thead>
          <tr style={s.theadRow}>
            <th style={s.th}>#</th><th style={s.th}>Student</th><th style={s.th}>Class</th>
            <th style={s.th}>Type</th><th style={s.th}>Format</th><th style={s.th}>Date</th>
            <th style={s.th}>Status</th><th style={s.th}></th>
          </tr>
        </thead>
        <tbody>
          {requests.map(r => {
            const ss = STATUT_STYLE[r.statut] || { bg: '#f1f5f9', color: '#475569', label: r.statut }
            return (
              <tr key={r.id} style={s.tr}>
                <td style={{ ...s.td, color: '#94a3b8', fontSize: '12px' }}>#{r.id}</td>
                <td style={s.td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={s.miniAvatar}>{r.prenom?.[0]}{r.nom?.[0]}</div>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: '13px' }}>{r.prenom} {r.nom}</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>{r.email}</div>
                    </div>
                  </div>
                </td>
                <td style={{ ...s.td, fontSize: '12px', color: '#64748b' }}>{r.classe_nom || '—'}</td>
                <td style={s.td}><span style={s.typeBadge}>{TYPE_LABEL[r.type] || r.type}</span></td>
                <td style={{ ...s.td, fontSize: '12px', color: '#64748b' }}>{r.format}</td>
                <td style={{ ...s.td, fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap' }}>
                  {new Date(r.date_demande).toLocaleDateString('fr-FR')}
                </td>
                <td style={s.td}>
                  <span style={{ ...s.statusBadge, background: ss.bg, color: ss.color }}>{ss.label}</span>
                </td>
                <td style={s.td}>
                  <button style={s.manageBtn} onClick={() => navigate(`/secretaire/request/${r.id}`)}>
                    <span className="material-icons" style={{ fontSize: '16px', marginRight: '4px' }}>open_in_new</span>Manage
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function NewRequestsTab({ requests, actionLoading, onForward, onProcess, navigate }) {
  if (requests.length === 0) return (
    <div style={s.emptyState}>
      <span className="material-icons" style={{ fontSize: '56px', color: '#cbd5e1' }}>done_all</span>
      <p style={{ color: '#64748b', margin: '12px 0 0', fontSize: '15px', fontWeight: 600 }}>All caught up!</p>
      <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: '14px' }}>No new student requests pending.</p>
    </div>
  )
  return (
    <div style={s.cardGrid}>
      {requests.map(r => {
        const isTranscript = r.type === 'RELEVE_NOTES'
        return (
          <div key={r.id} style={{ ...s.reqCard, borderLeft: isTranscript ? '3px solid #3b82f6' : '3px solid #C8184A' }}>
            <div style={s.reqCardTop}>
              <span style={s.reqId}>#{r.id}</span>
              <span style={{ ...s.typeBadge, background: isTranscript ? '#dbeafe' : '#fee2e2', color: isTranscript ? '#1d4ed8' : '#991b1b' }}>
                {TYPE_LABEL[r.type] || r.type}
              </span>
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
                <span className="material-icons" style={{ fontSize: '14px', color: '#94a3b8' }}>
                  {r.format === 'PDF' ? 'picture_as_pdf' : 'article'}
                </span>
                {r.format}
              </div>
              <div style={s.metaItem}>
                <span className="material-icons" style={{ fontSize: '14px', color: '#94a3b8' }}>calendar_today</span>
                {new Date(r.date_demande).toLocaleDateString('fr-FR')}
              </div>
            </div>
            {r.notes && (
              <div style={s.notesBox}>
                <span className="material-icons" style={{ fontSize: '14px', color: '#6366f1', marginRight: '6px', flexShrink: 0 }}>notes</span>
                <span style={{ fontSize: '12px', color: '#4338ca' }}>{r.notes}</span>
              </div>
            )}
            {isTranscript ? (
              <div style={{ background: '#eff6ff', borderRadius: '6px', padding: '6px 10px', marginBottom: '4px', fontSize: '11px', color: '#1d4ed8', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-icons" style={{ fontSize: '14px' }}>info</span>
                Secretary processes directly — no department approval needed
              </div>
            ) : (
              <div style={{ background: '#fff7ed', borderRadius: '6px', padding: '6px 10px', marginBottom: '4px', fontSize: '11px', color: '#9a3412', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="material-icons" style={{ fontSize: '14px' }}>account_tree</span>
                Requires CAISSE → IT → LABORATOIRE approval
              </div>
            )}
            <div style={s.cardActions}>
              <button style={s.manageBtn} onClick={() => navigate(`/secretaire/request/${r.id}`)}>
                <span className="material-icons" style={{ fontSize: '15px', marginRight: '4px' }}>open_in_new</span>View
              </button>
              {isTranscript ? (
                <button style={{ ...s.processBtn }} onClick={() => onProcess(r)}>
                  <span className="material-icons" style={{ fontSize: '15px', marginRight: '4px' }}>edit_note</span>
                  Process Transcript
                </button>
              ) : (
                <button
                  style={{ ...s.forwardBtn, opacity: actionLoading[r.id] ? 0.7 : 1 }}
                  onClick={() => onForward(r.id)}
                  disabled={!!actionLoading[r.id]}>
                  <span className="material-icons" style={{ fontSize: '15px', marginRight: '4px' }}>send</span>
                  {actionLoading[r.id] === 'forward' ? 'Forwarding...' : 'Forward to Depts'}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ApprovedTab({ requests, actionLoading, onSchedule, onSendPdf, navigate }) {
  if (requests.length === 0) return (
    <div style={s.emptyState}>
      <span className="material-icons" style={{ fontSize: '56px', color: '#cbd5e1' }}>verified</span>
      <p style={{ color: '#64748b', margin: '12px 0 0', fontSize: '15px', fontWeight: 600 }}>No approved requests</p>
      <p style={{ color: '#94a3b8', margin: '4px 0 0', fontSize: '14px' }}>Approved requests will appear here after all departments validate.</p>
    </div>
  )
  return (
    <div style={s.cardGrid}>
      {requests.map(r => (
        <div key={r.id} style={{ ...s.reqCard, borderLeft: '3px solid #8b5cf6' }}>
          <div style={s.approvedBanner}>
            <span className="material-icons" style={{ fontSize: '16px', marginRight: '6px' }}>verified</span>
            Fully Approved — Action Required
          </div>
          <div style={s.reqCardTop}>
            <span style={s.reqId}>#{r.id}</span>
            <span style={s.typeBadge}>{TYPE_LABEL[r.type] || r.type}</span>
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
              <span className="material-icons" style={{ fontSize: '14px', color: '#94a3b8' }}>
                {r.format === 'PDF' ? 'picture_as_pdf' : 'article'}
              </span>
              {r.format}
            </div>
            <div style={s.metaItem}>
              <span className="material-icons" style={{ fontSize: '14px', color: '#94a3b8' }}>calendar_today</span>
              {new Date(r.date_demande).toLocaleDateString('fr-FR')}
            </div>
          </div>
          <div style={s.validBadges}>
            {['CAISSE', 'IT', 'LABORATOIRE'].map(svc => (
              <span key={svc} style={s.validBadge}>✓ {svc}</span>
            ))}
          </div>
          <div style={s.cardActions}>
            {r.format === 'PAPIER' ? (
              <button
                style={{ ...s.scheduleBtn, opacity: actionLoading[r.id] ? 0.7 : 1 }}
                onClick={() => onSchedule(r)}
                disabled={!!actionLoading[r.id]}>
                <span className="material-icons" style={{ fontSize: '15px', marginRight: '4px' }}>event</span>
                Schedule Pickup
              </button>
            ) : (
              <button
                style={{ ...s.pdfBtn, opacity: actionLoading[r.id] ? 0.7 : 1 }}
                onClick={() => onSendPdf(r.id)}
                disabled={!!actionLoading[r.id]}>
                <span className="material-icons" style={{ fontSize: '15px', marginRight: '4px' }}>email</span>
                {actionLoading[r.id] === 'pdf' ? 'Sending...' : 'Send PDF'}
              </button>
            )}
            <button style={s.manageBtn} onClick={() => navigate(`/secretaire/request/${r.id}`)}>
              <span className="material-icons" style={{ fontSize: '15px', marginRight: '4px' }}>open_in_new</span>View
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={s.statCard}>
      <div style={{ ...s.statIcon, background: color + '18', color }}>
        <span className="material-icons">{icon}</span>
      </div>
      <div>
        <div style={s.statValue}>{value}</div>
        <div style={s.statLabel}>{label}</div>
      </div>
    </div>
  )
}

const s = {
  page:         { display: 'flex', minHeight: '100vh', background: '#f8fafc', fontFamily: "'Inter', sans-serif" },
  sidebar:      { width: '240px', background: '#0F1929', display: 'flex', flexDirection: 'column', padding: '24px 0', flexShrink: 0 },
  logo:         { display: 'flex', alignItems: 'center', gap: '10px', padding: '0 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.08)' },
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
  header:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' },
  pageTitle:    { fontSize: '24px', fontWeight: 700, color: '#0f172a', margin: 0 },
  pageSubtitle: { fontSize: '14px', color: '#64748b', margin: '4px 0 0', textTransform: 'capitalize' },
  newBtn:       { display: 'flex', alignItems: 'center', background: '#C8184A', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  statsGrid:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' },
  statCard:     { background: '#fff', borderRadius: '12px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  statIcon:     { width: '44px', height: '44px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  statValue:    { fontSize: '22px', fontWeight: 700, color: '#0f172a' },
  statLabel:    { fontSize: '12px', color: '#64748b', marginTop: '2px' },
  tabs:         { display: 'flex', gap: '4px', marginBottom: '16px', background: '#f1f5f9', borderRadius: '10px', padding: '4px' },
  tab:          { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', background: 'none', border: 'none', borderRadius: '7px', padding: '9px 14px', fontSize: '13px', fontWeight: 500, color: '#64748b', cursor: 'pointer' },
  tabActive:    { background: '#fff', color: '#0f172a', fontWeight: 600, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' },
  tabBadge:     { background: '#C8184A', color: '#fff', borderRadius: '10px', fontSize: '10px', fontWeight: 700, minWidth: '16px', height: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' },
  center:       { textAlign: 'center', color: '#94a3b8', padding: '60px' },
  toolbar:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '10px', flexWrap: 'wrap' },
  filterGroup:  { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
  selectWrap:   { position: 'relative' },
  selectIcon:   { position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', fontSize: '18px', pointerEvents: 'none' },
  select:       { appearance: 'none', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '8px 12px 8px 34px', fontSize: '13px', background: '#fff', color: '#374151', outline: 'none', cursor: 'pointer', minWidth: '140px' },
  clearBtn:     { display: 'flex', alignItems: 'center', background: '#fee2e2', color: '#991b1b', border: 'none', borderRadius: '6px', padding: '7px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  exportBtn:    { display: 'flex', alignItems: 'center', background: '#fff', border: '1.5px solid #e2e8f0', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: 500, color: '#374151', cursor: 'pointer' },
  tableCard:    { background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', overflow: 'hidden' },
  emptyState:   { background: '#fff', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', padding: '60px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
  table:        { width: '100%', borderCollapse: 'collapse' },
  theadRow:     { background: '#f8fafc' },
  th:           { textAlign: 'left', padding: '11px 14px', fontSize: '11px', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', borderBottom: '1px solid #f1f5f9', whiteSpace: 'nowrap' },
  tr:           { borderBottom: '1px solid #f8fafc' },
  td:           { padding: '12px 14px', fontSize: '13px', color: '#374151' },
  miniAvatar:   { width: '30px', height: '30px', borderRadius: '50%', background: '#ede9fe', color: '#5b21b6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 },
  typeBadge:    { background: '#f1f5f9', color: '#475569', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' },
  statusBadge:  { padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 600, whiteSpace: 'nowrap' },
  manageBtn:    { display: 'flex', alignItems: 'center', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', fontWeight: 500, color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap' },
  cardGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' },
  reqCard:      { background: '#fff', borderRadius: '12px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  approvedBanner:{ display: 'flex', alignItems: 'center', background: '#ede9fe', color: '#5b21b6', borderRadius: '6px', padding: '6px 10px', fontSize: '12px', fontWeight: 600, marginBottom: '14px' },
  reqCardTop:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' },
  reqId:        { fontSize: '12px', color: '#94a3b8', fontWeight: 600 },
  studentRow:   { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' },
  studentAvatar:{ width: '40px', height: '40px', borderRadius: '50%', background: '#ede9fe', color: '#5b21b6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, flexShrink: 0 },
  studentName:  { fontSize: '14px', fontWeight: 600, color: '#0f172a' },
  studentEmail: { fontSize: '12px', color: '#64748b', marginTop: '1px' },
  studentClass: { fontSize: '11px', color: '#94a3b8', marginTop: '1px' },
  reqMeta:      { display: 'flex', gap: '16px', marginBottom: '10px' },
  metaItem:     { display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#64748b' },
  notesBox:     { display: 'flex', alignItems: 'flex-start', background: '#eef2ff', borderRadius: '6px', padding: '8px 10px', marginBottom: '10px' },
  validBadges:  { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' },
  validBadge:   { background: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 600 },
  cardActions:  { display: 'flex', gap: '8px', marginTop: '12px' },
  forwardBtn:   { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#C8184A', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  processBtn:   { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  scheduleBtn:  { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  pdfBtn:       { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#10b981', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  backdrop:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal:        { background: '#fff', borderRadius: '14px', padding: '28px', width: '440px', maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' },
  modalHeader:  { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' },
  modalTitle:   { fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: 0 },
  closeBtn:     { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', padding: '4px' },
  label:        { display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' },
  input:        { width: '100%', padding: '10px 12px', border: '1.5px solid #e2e8f0', borderRadius: '8px', fontSize: '14px', background: '#f8fafc', outline: 'none', boxSizing: 'border-box', marginBottom: '14px', fontFamily: 'inherit' },
  errorMsg:     { background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', padding: '8px 12px', color: '#dc2626', fontSize: '13px', marginBottom: '14px' },
  modalActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' },
  cancelBtn:    { background: '#f1f5f9', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '14px', color: '#374151', cursor: 'pointer', fontWeight: 500 },
  submitBtn:    { background: '#C8184A', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
}
