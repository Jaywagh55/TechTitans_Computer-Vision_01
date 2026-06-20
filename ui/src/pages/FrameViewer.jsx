import { useState, useEffect, useCallback } from 'react'
import { VIDEOS, loadFrameList, laserStatusColor, laserStatusLabel } from '../api/data.js'

const s = {
  page: { padding: 24, display: 'flex', flexDirection: 'column', gap: 16, height: 'calc(100vh - 53px)', overflow: 'hidden' },
  controls: {
    background: '#161b2e', border: '1px solid #2a3050', borderRadius: 12, padding: '14px 20px',
    display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', flexShrink: 0,
  },
  label: { fontSize: 12, color: '#64748b' },
  select: {
    background: '#0f1117', border: '1px solid #2a3050', borderRadius: 8,
    color: '#e2e8f0', padding: '6px 12px', fontSize: 13, cursor: 'pointer',
  },
  viewToggle: { display: 'flex', gap: 6 },
  toggleBtn: (active) => ({
    padding: '5px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    background: active ? 'rgba(125,211,252,0.15)' : '#0f1117',
    color: active ? '#7dd3fc' : '#475569',
    border: `1px solid ${active ? 'rgba(125,211,252,0.3)' : '#2a3050'}`,
  }),
  content: { flex: 1, display: 'flex', gap: 16, overflow: 'hidden' },
  thumbnailPanel: {
    width: 200, flexShrink: 0, background: '#161b2e',
    border: '1px solid #2a3050', borderRadius: 12, overflow: 'auto', padding: 8,
  },
  thumb: (active) => ({
    borderRadius: 6, overflow: 'hidden', marginBottom: 6, cursor: 'pointer',
    border: `2px solid ${active ? '#7dd3fc' : 'transparent'}`,
    transition: 'border-color 0.15s',
  }),
  thumbImg: { width: '100%', display: 'block' },
  thumbLabel: {
    background: '#0f1117', padding: '3px 6px', fontSize: 10, color: '#475569',
    display: 'flex', justifyContent: 'space-between',
  },
  mainViewer: { flex: 1, display: 'flex', flexDirection: 'column', gap: 12 },
  compareRow: { flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, overflow: 'hidden' },
  singleView: { flex: 1, overflow: 'hidden' },
  imgPanel: {
    background: '#161b2e', border: '1px solid #2a3050', borderRadius: 12,
    overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column',
  },
  imgHeader: {
    padding: '8px 14px', borderBottom: '1px solid #2a3050',
    fontSize: 12, fontWeight: 600, color: '#94a3b8',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
  },
  imgBody: { flex: 1, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 },
  img: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 6 },
  metaBar: {
    background: '#161b2e', border: '1px solid #2a3050', borderRadius: 12,
    padding: '12px 20px', display: 'flex', gap: 24, flexShrink: 0, flexWrap: 'wrap',
  },
  metaItem: { display: 'flex', flexDirection: 'column', gap: 2 },
  metaLabel: { fontSize: 11, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: (color) => ({ fontSize: 15, fontWeight: 700, color: color || '#e2e8f0' }),
  navBtns: { display: 'flex', gap: 8, marginLeft: 'auto' },
  navBtn: {
    padding: '5px 14px', background: '#0f1117', border: '1px solid #2a3050',
    borderRadius: 6, color: '#94a3b8', cursor: 'pointer', fontSize: 13,
  },
  empty: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontSize: 14 },
}

export default function FrameViewer() {
  const [selectedVideo, setSelectedVideo] = useState(VIDEOS[0].id)
  const [frames, setFrames] = useState([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('compare') // 'compare' | 'pre' | 'post'

  useEffect(() => {
    setLoading(true)
    setCurrentIdx(0)
    loadFrameList(selectedVideo, 600).then(f => {
      setFrames(f)
      setLoading(false)
    })
  }, [selectedVideo])

  const current = frames[currentIdx]
  const lc = laserStatusColor(current?.laser)

  const go = useCallback((delta) => {
    setCurrentIdx(i => Math.max(0, Math.min(frames.length - 1, i + delta)))
  }, [frames.length])

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'ArrowRight') go(1)
      if (e.key === 'ArrowLeft') go(-1)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [go])

  const renderImgPanel = (type) => (
    <div style={s.imgPanel}>
      <div style={s.imgHeader}>
        <span>{type === 'pre' ? '🔵 Pre-Processing (CLAHE Enhanced)' : '🟢 Post-Processing (Annotated)'}</span>
        <span style={{ color: '#475569' }}>Frame #{current?.index ?? '—'}</span>
      </div>
      <div style={s.imgBody}>
        {current ? (
          <img
            key={type === 'pre' ? current.pre : current.post}
            src={type === 'pre' ? current.pre : current.post}
            alt={`${type} frame ${current.index}`}
            style={s.img}
            onError={e => { e.target.style.opacity = 0.3; e.target.alt = 'Not yet generated' }}
          />
        ) : (
          <div style={{ color: '#475569', fontSize: 13 }}>No frame selected</div>
        )}
      </div>
    </div>
  )

  return (
    <div style={s.page}>
      {/* Controls */}
      <div style={s.controls}>
        <div>
          <div style={s.label}>Video</div>
          <select style={s.select} value={selectedVideo} onChange={e => setSelectedVideo(e.target.value)}>
            {VIDEOS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </div>
        <div>
          <div style={s.label}>View Mode</div>
          <div style={s.viewToggle}>
            {[['compare','Side by Side'],['pre','Pre Only'],['post','Post Only']].map(([v,l]) => (
              <button key={v} style={s.toggleBtn(view===v)} onClick={() => setView(v)}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#475569' }}>
          {frames.length} frames loaded · Use ← → keys to navigate
        </div>
      </div>

      <div style={s.content}>
        {/* Thumbnail strip */}
        <div style={s.thumbnailPanel}>
          {loading ? (
            <div style={{ color: '#475569', fontSize: 12, padding: 12, textAlign: 'center' }}>Loading frames…</div>
          ) : (
            frames.map((f, i) => (
              <div key={f.index} style={s.thumb(i === currentIdx)} onClick={() => setCurrentIdx(i)}>
                <img src={f.post} alt={`frame ${f.index}`} style={s.thumbImg}
                  onError={e => { e.target.style.display = 'none' }} />
                <div style={s.thumbLabel}>
                  <span>#{f.index}</span>
                  <span style={{ color: laserStatusColor(f.laser) }}>●</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Main viewer */}
        <div style={s.mainViewer}>
          {/* Image panels */}
          {view === 'compare' && <div style={s.compareRow}>{renderImgPanel('pre')}{renderImgPanel('post')}</div>}
          {view === 'pre' && <div style={s.singleView}>{renderImgPanel('pre')}</div>}
          {view === 'post' && <div style={s.singleView}>{renderImgPanel('post')}</div>}

          {/* Metadata bar */}
          <div style={s.metaBar}>
            <div style={s.metaItem}>
              <span style={s.metaLabel}>Frame Index</span>
              <span style={s.metaValue()}>{current?.index ?? '—'}</span>
            </div>
            <div style={s.metaItem}>
              <span style={s.metaLabel}>Stones Detected</span>
              <span style={s.metaValue('#7dd3fc')}>{current?.stones ?? '—'}</span>
            </div>
            <div style={s.metaItem}>
              <span style={s.metaLabel}>Laser Status</span>
              <span style={s.metaValue(lc)}>{laserStatusLabel(current?.laser)}</span>
            </div>
            <div style={s.metaItem}>
              <span style={s.metaLabel}>Stone Sizes</span>
              <span style={s.metaValue()}>{current?.sizes?.join(', ') || '—'}</span>
            </div>
            <div style={s.navBtns}>
              <button style={s.navBtn} onClick={() => go(-10)}>«10</button>
              <button style={s.navBtn} onClick={() => go(-1)}>‹ Prev</button>
              <button style={s.navBtn} onClick={() => go(1)}>Next ›</button>
              <button style={s.navBtn} onClick={() => go(10)}>10»</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
