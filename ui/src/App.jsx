import { Routes, Route, NavLink, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard.jsx'
import FrameViewer from './pages/FrameViewer.jsx'
import VideoPlayer from './pages/VideoPlayer.jsx'
import UploadVideo from './pages/UploadVideo.jsx'
import { useJob } from './api/JobContext.jsx'

const NAV_LINKS = [
  { to: '/', label: 'Dashboard', icon: '\u2b1b' },
  { to: '/frames', label: 'Frame Viewer', icon: '\ud83d\uddbc' },
  { to: '/player', label: 'Video Player', icon: '\u25b6' },
  { to: '/upload', label: 'Upload Video', icon: '\u2b06' },
]

const styles = {
  layout: { display: 'flex', minHeight: '100vh', flexDirection: 'row' },
  sidebar: {
    width: 220, background: '#161b2e', borderRight: '1px solid #2a3050',
    display: 'flex', flexDirection: 'column', padding: '0', flexShrink: 0,
  },
  logo: { padding: '20px 20px 16px', borderBottom: '1px solid #2a3050' },
  logoTitle: { fontSize: 15, fontWeight: 700, color: '#7dd3fc', letterSpacing: 0.5 },
  logoSub: { fontSize: 11, color: '#64748b', marginTop: 3 },
  nav: { padding: '12px 8px', flex: 1 },
  navLink: (active) => ({
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '9px 12px', borderRadius: 8, marginBottom: 3,
    fontSize: 13, fontWeight: 500, cursor: 'pointer',
    background: active ? 'rgba(125,211,252,0.1)' : 'transparent',
    color: active ? '#7dd3fc' : '#94a3b8',
    border: active ? '1px solid rgba(125,211,252,0.2)' : '1px solid transparent',
    transition: 'all 0.15s', textDecoration: 'none',
  }),
  badge: {
    fontSize: 9, background: '#22c55e', color: '#fff',
    borderRadius: 4, padding: '1px 5px', fontWeight: 700, marginLeft: 'auto',
  },
  topbar: {
    padding: '14px 24px', borderBottom: '1px solid #1e2535',
    background: '#0f1117', display: 'flex', alignItems: 'center', gap: 12,
  },
  topbarTitle: { fontSize: 14, color: '#cbd5e1', fontWeight: 600 },
  topbarSub: { fontSize: 12, color: '#475569', marginLeft: 'auto' },
}

export default function App() {
  const loc = useLocation()
  const { job } = useJob()
  const isProcessing = job && ['uploading', 'queued', 'processing'].includes(job.status)
  const titles = {
    '/': 'Dashboard \u2014 Video Analysis & Team',
    '/frames': 'Frame Viewer \u2014 Pre & Post Processing',
    '/player': 'Video Player \u2014 Annotated Outputs',
    '/upload': 'Upload Video \u2014 External Video Inference',
  }
  return (
    <div style={styles.layout}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>
          <div style={styles.logoTitle}>RIRS AI Assistant</div>
          <div style={styles.logoSub}>Kidney Stone Detection v1.0</div>
        </div>
        <nav style={styles.nav}>
          {NAV_LINKS.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} end={to === '/'}
              style={({ isActive }) => styles.navLink(isActive)}>
              <span>{icon}</span>
              <span>{label}</span>
              {to === '/' && <span style={styles.badge}>LIVE</span>}
              {to === '/upload' && isProcessing && (
                <span style={{
                  fontSize: 10, background: '#a78bfa', color: '#fff',
                  borderRadius: 4, padding: '1px 6px', fontWeight: 700, marginLeft: 'auto',
                }}>{Math.round(job.progress)}%</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: '12px 16px', borderTop: '1px solid #2a3050', fontSize: 11, color: '#334155' }}>
          YOLOv8n \u00b7 CLAHE \u00b7 HSV Laser
        </div>
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={styles.topbar}>
          <span style={styles.topbarTitle}>{titles[loc.pathname] || 'RIRS AI'}</span>
          <span style={styles.topbarSub}>Intraoperative Endoscopy Analysis</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/frames" element={<FrameViewer />} />
            <Route path="/player" element={<VideoPlayer />} />
            <Route path="/upload" element={<UploadVideo />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}