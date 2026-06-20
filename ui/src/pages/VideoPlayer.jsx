import { useState, useRef, useEffect } from "react"
import { VIDEOS } from "../api/data.js"

const s = {
  page: { padding: 24, display: "flex", flexDirection: "column", gap: 16 },
  tabs: { display: "flex", gap: 8, flexWrap: "wrap" },
  tab: (active) => ({
    padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
    background: active ? "rgba(125,211,252,0.12)" : "#161b2e",
    color: active ? "#7dd3fc" : "#475569",
    border: `1px solid ${active ? "rgba(125,211,252,0.3)" : "#2a3050"}`,
  }),
  videoBox: { background: "#161b2e", border: "1px solid #2a3050", borderRadius: 12, overflow: "hidden" },
  videoHeader: {
    padding: "12px 20px", borderBottom: "1px solid #2a3050",
    display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8,
  },
  videoTitle: { fontSize: 15, fontWeight: 600, color: "#e2e8f0" },
  videoMeta: { fontSize: 12, color: "#475569" },
  videoWrap: { padding: 16, background: "#000", display: "flex", justifyContent: "center", minHeight: 120 },
  video: { width: "100%", maxHeight: "68vh", borderRadius: 8, outline: "none" },
  infoGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, padding: 20 },
  infoItem: { background: "#0f1117", borderRadius: 8, padding: "12px 16px" },
  infoLabel: { fontSize: 11, color: "#475569", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  infoVal: { fontSize: 14, fontWeight: 600, color: "#e2e8f0" },
  uploadBtn: {
    display: "inline-flex", alignItems: "center", gap: 8,
    padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
    background: "rgba(125,211,252,0.1)", color: "#7dd3fc",
    border: "1px solid rgba(125,211,252,0.25)",
  },
  noteBadge: {
    padding: "10px 16px",
    background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)",
    borderRadius: 8, fontSize: 12, color: "#fbbf24", lineHeight: 1.6,
  },
  warnBox: {
    padding: "12px 16px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: 8, fontSize: 12, color: "#fca5a5", lineHeight: 1.7,
  },
}

const VIDEO_INFO = {
  test_video:   { resolution: "1920x1080", fps: "30", frames: "5,676",  file: "test_video_annotated.mp4" },
  test_video_2: { resolution: "1920x1080", fps: "30", frames: "~6,500", file: "test_video_2_annotated.mp4" },
}

export default function VideoPlayer() {
  const [selected, setSelected] = useState(VIDEOS[0].id)
  const [videoSrc, setVideoSrc] = useState(null)
  const [videoError, setVideoError] = useState(false)
  const [loading, setLoading] = useState(false)
  const [localOverride, setLocalOverride] = useState({})
  const fileRef = useRef(null)

  const info = VIDEO_INFO[selected] || {}

  // Try fetching from publicDir
  useEffect(() => {
    const override = localOverride[selected]
    if (override) { setVideoSrc(override); setVideoError(false); return }
    setVideoSrc(null); setVideoError(false); setLoading(true)
    fetch(`/outputs/annotated_videos/${info.file}`)
      .then(r => { if (!r.ok) throw new Error(); return r.blob() })
      .then(b => { setVideoSrc(URL.createObjectURL(b)); setLoading(false) })
      .catch(() => { setVideoError(true); setLoading(false) })
  }, [selected, localOverride])

  const handleLocalFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    setLocalOverride(prev => ({ ...prev, [selected]: url }))
  }

  return (
    <div style={s.page}>
      <div style={s.tabs}>
        {VIDEOS.map(v => (
          <button key={v.id} style={s.tab(selected === v.id)} onClick={() => setSelected(v.id)}>
            {v.label}
          </button>
        ))}
      </div>

      <div style={s.videoBox}>
        <div style={s.videoHeader}>
          <span style={s.videoTitle}>{VIDEOS.find(v=>v.id===selected)?.label} — Annotated Output</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={s.videoMeta}>{info.resolution} · {info.fps} fps</span>
            <label style={s.uploadBtn}>
              Browse local file
              <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }} onChange={handleLocalFile} />
            </label>
          </div>
        </div>

        <div style={s.videoWrap}>
          {loading && <div style={{ color: "#475569", padding: 40, fontSize: 13, alignSelf: "center" }}>Loading video...</div>}
          {videoSrc && (
            <video key={videoSrc} style={s.video} controls>
              <source src={videoSrc} type="video/mp4" />
            </video>
          )}
          {!loading && !videoSrc && !videoError && null}
        </div>

        {videoError && (
          <div style={s.warnBox}>
            <b>Cannot stream video automatically</b> — the <code>mp4v</code> codec is not browser-compatible.<br />
            Click <b>"Browse local file"</b> above and select the file from:<br />
            <code style={{ color: "#7dd3fc" }}>RIRS/outputs/annotated_videos/{info.file}</code>
          </div>
        )}
      </div>

      <div style={{ background: "#161b2e", border: "1px solid #2a3050", borderRadius: 12, overflow: "hidden" }}>
        <div style={{ padding: "12px 20px", borderBottom: "1px solid #2a3050", fontSize: 13, fontWeight: 700, color: "#7dd3fc" }}>
          Processing Details
        </div>
        <div style={s.infoGrid}>
          {[
            ["Resolution", info.resolution],
            ["Frame Rate", `${info.fps} fps`],
            ["Total Frames", info.frames],
            ["Stack", "YOLOv8n + CLAHE + HSV Laser"],
            ["Output File", info.file],
          ].map(([label, val]) => (
            <div key={label} style={s.infoItem}>
              <div style={s.infoLabel}>{label}</div>
              <div style={s.infoVal}>{val}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={s.noteBadge}>
        Overlays: cyan boxes = stone detections · size labels in mm · laser status badge (top-right) · stone count (top-left) · yellow line = laser fiber
      </div>
    </div>
  )
}