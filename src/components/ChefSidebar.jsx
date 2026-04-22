import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'

const NAV_ITEMS = [
  { label: 'Dashboard',   path: '/chef/dashboard',      icon: 'dashboard'    },
  { label: 'Attendance',  path: '/chef/attendance',     icon: 'fact_check'   },
  { label: 'History',     path: '/chef/history',        icon: 'history'      },
  { label: 'My Requests', path: '/chef/requests',       icon: 'description'  },
  { label: 'New Request', path: '/chef/requests/new',   icon: 'add_circle'   },
]

export default function ChefSidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [classInfo, setClassInfo] = useState(null)

  useEffect(() => {
    if (user?.classe_id) {
      api.get(`/classes/${user.classe_id}/info`)
        .then(res => setClassInfo(res.data.classe))
        .catch(() => {})
    }
  }, [user?.classe_id])

  return (
    <aside style={s.sidebar}>
      {/* Logo */}
      <div style={s.logo}>
        <img
          src="/icons/bit-logo.png" alt="BIT"
          style={{ width:'36px', height:'36px', objectFit:'contain', borderRadius:'6px', background:'#fff', padding:'3px', flexShrink:0 }}
        />
        <span style={s.logoText}>Academic Manager</span>
      </div>

      {/* Nav */}
      <nav style={s.nav}>
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname === item.path
          return (
            <div
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{ ...s.navItem, ...(isActive ? s.navActive : {}) }}
            >
              <span className="material-icons" style={s.navIcon}>{item.icon}</span>
              {item.label}
            </div>
          )
        })}
      </nav>

      {/* Profile */}
      <div style={s.profile}>
        <div style={s.avatar}>
          {user?.prenom?.[0]}{user?.nom?.[0]}
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={s.profileName}>{user?.prenom} {user?.nom}</div>
          <div style={s.profileRole}>
            {classInfo
              ? `Class Rep — ${classInfo.filiere} ${classInfo.niveau}`
              : 'Class Representative'
            }
          </div>
        </div>
        <button onClick={logout} title="Logout" style={s.logoutBtn}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </aside>
  )
}

const s = {
  sidebar:     { width:'240px', background:'#0F1929', display:'flex', flexDirection:'column', flexShrink:0, minHeight:'100vh' },
  logo:        { display:'flex', alignItems:'center', gap:'10px', padding:'20px 20px 16px', borderBottom:'1px solid rgba(255,255,255,0.08)' },
  logoText:    { color:'#C8184A', fontSize:'15px', fontWeight:600 },
  nav:         { flex:1, padding:'16px 12px' },
  navItem:     { display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', borderRadius:'8px', color:'rgba(255,255,255,0.6)', fontSize:'14px', cursor:'pointer', marginBottom:'4px', transition:'background 0.15s' },
  navActive:   { background:'rgba(200,24,74,0.15)', color:'#fff' },
  navIcon:     { fontSize:'20px' },
  profile:     { display:'flex', alignItems:'center', gap:'10px', padding:'16px 20px', borderTop:'1px solid rgba(255,255,255,0.08)' },
  avatar:      { width:'38px', height:'38px', borderRadius:'50%', background:'#C8184A', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:700, flexShrink:0 },
  profileName: { fontSize:'13px', fontWeight:700, color:'#fff', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  profileRole: { fontSize:'11px', color:'rgba(255,255,255,0.50)', marginTop:'2px', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' },
  logoutBtn:   { background:'none', border:'none', color:'rgba(255,255,255,0.40)', cursor:'pointer', padding:'4px', display:'flex', alignItems:'center', flexShrink:0 },
}
