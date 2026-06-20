import { useState, useCallback, useEffect } from "react"

const s = {
  wrap: { padding: 16 },
  controls: { display: "flex", alignItems: "center", gap: 12, marginBottom: 12, flexWrap: "wrap" },
  label: { fontSize: 12, color: "#64748b" },
  slider: { flex: 1, minWidth: 120, accentColor: "#7dd3fc" },
  frameNum: { fontSize: 13, fontWeight: 600, color: "#7dd3fc", fontFamily: "monospace", minWidth: 80, textAlign: "right" },
  viewToggle: { display: "flex", gap: 4 },
  toggleBtn: (active) => ({
    padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: "pointer",
    background: active ? "rgba(125,211,252,0.15)" : "#0f1117",
    color: active ? "#7dd3fc" : "#475569",
    border: `1px solid ${active ? "rgba(125,211,252,0.3)" : "#2a3050"}`,
  }),
  compareRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  singleView: {},
  imgPanel: {
    background: "#0a0e1a", border: "1px solid #2a3050", borderRadius: 8,
    overflow: "hidden",
  },
  imgHeader: {
    padding: "6px 12px", borderBottom: "1px solid #2a3050",
    fontSize: 11, fontWeight: 600, color: "#94a3b8",
  },
  imgBody: { padding: 8, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200 },
  img: { maxWidth: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 4 },
  navBtns: { display: "flex", gap: 6, marginLeft: 8 },
  navBtn: {
    padding: "4px 10px", background: "#0f1117", border: "1px solid #2a3050",
    borderRadius: 6, color: "#94a3b8", cursor: "pointer", fontSize: 12,
  },
}

export function FrameViewer({ totalFrames, preUrl, postUrl }) {
  const [idx, setIdx] = useState(0)
  const [view, setView] = useState("compare")
  const max = Math.max(0, (totalFrames || 1) - 1)

  const go = useCallback((delta) => {
    setIdx(i => Math.max(0, Math.min(max, i + delta)))
  }, [max])

  useEffect(() => {
    const h = (e) => {
      if (e.key === "ArrowRight") go(1)
      if (e.key === "ArrowLeft") go(-1)
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [go])

  const renderPanel = (type) => (
    <div style={s.imgPanel}>
      <div style={s.imgHeader}>
        {type === "pre" ? "Pre-Processing (CLAHE)" : "Post-Processing (Annotated)"}
      </div>
      <div style={s.imgBody}>
        <img
          key={`${type}-${idx}`}
          src={type === "pre" ? preUrl(idx) : postUrl(idx)}
          alt={`${type} frame ${idx}`}
          style={s.img}
          onError={e => { e.target.style.opacity = 0.3 }}
        />
      </div>
    </div>
  )

  return (
    <div style={s.wrap}>
      <div style={s.controls}>
        <span style={s.label}>Frame:</span>
        <input
          type="range" min={0} max={max} value={idx}
          onChange={e => setIdx(Number(e.target.value))}
          style={s.slider}
        />
        <span style={s.frameNum}>#{idx} / {max}</span>
        <div style={s.viewToggle}>
          {[["compare","Side by Side"],["pre","Pre"],["post","Post"]].map(([v,l]) => (
            <button key={v} style={s.toggleBtn(view===v)} onClick={() => setView(v)}>{l}</button>
          ))}
        </div>
        <div style={s.navBtns}>
          <button style={s.navBtn} onClick={() => go(-10)}>«10</button>
          <button style={s.navBtn} onClick={() => go(-1)}>‹</button>
          <button style={s.navBtn} onClick={() => go(1)}>›</button>
          <button style={s.navBtn} onClick={() => go(10)}>10»</button>
        </div>
      </div>
      {view === "compare" && <div style={s.compareRow}>{renderPanel("pre")}{renderPanel("post")}</div>}
      {view === "pre" && <div style={s.singleView}>{renderPanel("pre")}</div>}
      {view === "post" && <div style={s.singleView}>{renderPanel("post")}</div>}
    </div>
  )
}